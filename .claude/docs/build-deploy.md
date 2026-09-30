# 빌드, 배포, 실행 (Build / Deploy / Run)

## 사전 요구사항
- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)
- Redis Server
- Discord Bot Token

## 작업 디렉토리
모든 명령은 `functions/` 디렉토리에서 실행.
```bash
cd functions
```

## 설치
```bash
npm install
cp .env.example .env  # 환경 변수 설정
```

## 로컬 실행
```bash
npm run dev      # 개발 서버 (hot reload)
npm run serve    # 빌드 후 에뮬레이터 실행
```

## 빌드
```bash
npm run build    # 프로덕션 빌드
```

## 배포 토폴로지 (E안 · 2-프로세스 하이브리드)

Phase 1.10부터 봇은 **두 개의 독립 프로세스**로 나뉘어 배포된다. 두 프로세스는
서로 직접 통신하지 않고 **공유 Redis(Upstash) + Firestore로만 협업**한다.

| 프로세스 | 역할 | 실행 대상 | 엔트리 | 트리거 |
|----------|------|-----------|--------|--------|
| **A · 게이트웨이** | discord.js WS 로그인 + 인터랙션(슬래시 커맨드·버튼 등) 수신 | Oracle Cloud x86 Micro VM (무료 티어) + pm2 상주 | `lib/app/gateway.js` | WS 상주 (HTTP 리슨 없음 · WS-only) |
| **B · 스케줄러** | `onSchedule` → `syncRecruits` → REST DM 발송 (알림 체인 전체가 이 프로세스 안에서 완결) | Firebase Functions (`asia-northeast3`) | `lib/app/scheduler.js` (`package.json` `main`) | `recruitSchedule_sria` / `recruitSchedule_temp` |

> **설계 근거**: DM 발송은 `providers/discord/dmSender.ts`가 REST(`rest.post`)를 사용하므로
> 알림 체인 전체가 스케줄러/Functions 프로세스 내부에서 완결된다. WS 게이트웨이는 구독
> 인터랙션 전용이다. 이 경계를 깨지 않는 것이 E안의 핵심이다.

> ⚠️ **main 전환의 부작용(의도됨)**: `package.json` `main`이 `lib/app/index.js`(onRequest
> 게이트웨이) → `lib/app/scheduler.js`로 바뀌면서, 기존 onRequest(`default`) HTTP 함수는
> Functions에서 **더 이상 배포되지 않는다**. 게이트웨이는 프로세스 A(VM + pm2)가 대체한다.
> `app/index.ts`는 참조/로컬 호환 목적으로만 유지된다.

### B · 스케줄러 배포 (Firebase Functions)
```bash
cd functions
npm run deploy   # firebase deploy --only functions
```
배포되는 함수: `recruitSchedule_sria`, `recruitSchedule_temp` (스케줄 트리거만).
`firebase.json`의 predeploy는 `npm run build`만 강제한다(lint는 repo-wide 스타일 debt로 별도 lint-cleanup 태스크로 분리 — todo.md).

### A · 게이트웨이 배포 (Oracle Cloud VM + pm2)
```bash
# VM에서 (최초 1회)
git clone <repo> && cd functions
npm ci
npm run build

# pm2로 상주 실행
pm2 start lib/app/gateway.js --name sria-gateway
pm2 startup            # 부팅 시 자동 기동 스크립트 설치
pm2 save               # 현재 프로세스 목록 스냅샷 → 재부팅 후 자동 부활
```
게이트웨이는 **WS-only**다 — 인바운드 HTTP 서버(`app.listen`)를 띄우지 않는다(인터랙션은 WS 수신, discord.js WS 연결이 프로세스를 상주시킴). 따라서 인바운드 `/health` 엔드포인트도 없다. 상시 프로세스 모니터링은 pull(인바운드) 대신 **push 방식**(Phase 1.13): [A] isReady() 게이팅 dead-man's-switch heartbeat(아웃바운드) + [B] WS/Redis 이상 시 관리자 DM. (설계: 메모리 `monitoring-eventbus-observer-channels`)

## Discord 명령어 등록
```bash
npm run register:commands
```

## 환경 변수 매트릭스

프로세스별 필요한 환경변수. 코드 실제 사용 기준(CTO 감사 반영)이며,
CLAUDE.md의 일부 표기(`FIREBASE_PROJECT_ID`)는 오기다 — 코드는 아래 `FB_*`를 사용한다.

| 변수 | 게이트웨이(VM) | 스케줄러(Functions) | 비고 |
|------|:---:|:---:|------|
| `DISCORD_BOT_TOKEN` | ✅ (WS login) | ✅ (REST DM) | 두 프로세스 모두 필요 |
| `DISCORD_CLIENT_ID` | ✅ | — | 커맨드 등록/인터랙션 |
| `ADMIN_USER_ID` | ✅ | ✅ | 관리자 알림 |
| `REDIS_URL` | ✅ | ✅ | 공유 캐시(Upstash). **O-2**: 코드는 `REDIS_URL`만 사용하며 `REDIS_PASSWORD`는 미사용 — Upstash 인증은 `rediss://<user>:<password>@host:port` URL에 내장된다(`rediss://` = TLS) |
| `FB_PROJECT_ID` | ✅ | ✅ | **O-1**: 코드(`initFirebaseApp.ts`)는 명시적 cert로 `FB_PROJECT_ID` / `FB_CLIENT_EMAIL` / `FB_PRIVATE_KEY`를 사용. `FIREBASE_PROJECT_ID`(CLAUDE.md 표기)는 미사용 |
| `FB_CLIENT_EMAIL` | ✅ | ✅ | 서비스 계정 이메일 |
| `FB_PRIVATE_KEY` | ✅ | ✅ | 서비스 계정 개인키 (`\n` → 개행 치환) |
| `FB_*` (그 외) | ✅ | ✅ | `FB_TYPE`, `FB_PRIVATE_KEY_ID`, `FB_CLIENT_ID`, `FB_AUTH_URI`, `FB_TOKEN_URI`, `FB_AUTH_PROVIDER_X509_CERT_URL`, `FB_CLIENT_X509_CERT_URL`, `FB_UNIVERSE_DOMAIN` |
| `HUGGINGFACE_API_KEY` | — | — | Phase 4 AI (미도입) |

> ⚠️ **후속(Phase 1.13 · 사용자 실행) — Secret Manager**: Functions 프로덕션에서
> `FB_PRIVATE_KEY` / `DISCORD_BOT_TOKEN` 같은 시크릿은 dotenv(`.env`)가 아니라
> **Firebase/GCP Secret Manager**로 주입해야 한다. `.env`는 로컬·VM용이며, Functions
> 프로덕션 시크릿 주입은 이번 iterate 범위가 아니다(문서 경고만). VM(게이트웨이)은
> `.env` 파일 또는 pm2 ecosystem env로 관리 가능하다.
