# Phase 1.14 설계서: 프로덕션 배포·운영 (production-deploy)

**상태**: 🔄 진행 중
**기반 문서**: `docs/phase-1-14/01-plan.md`
**ADR 정본**: `docs/archive/phase-1-10/07-deploy-architecture-decision.md`

---

## 0. 이 설계서의 성격 — (C) 코드 설계 vs (U) 운영 시퀀스

> **⚠️ Design Validator·독자 필독**: 본 Phase는 **의도적으로 코드 변경이 소수**다. E안 배포 배선은 Phase 1.10/1.13에서 이미 코드로 완성돼 정적 analyze를 통과했다(matchRate 99.3%/100%). 1.14의 핵심 가치는 **실 프로덕션 배포와 실환경 검증(운영 절차)**에 있으며, 코드로 남은 것은 상시 가동에 필요한 견고성 보강 **O-3·O-5 두 건뿐**이다.

이에 따라 본 설계서는 두 성격의 작업을 명시적으로 구분한다.

| 구분 | 정의 | 본 설계서에서의 위치 | 담당 |
|------|------|--------------------|------|
| **(C) 코드 설계** | Claude(Backend Expert)가 코드로 구현하고 tsc/build·로컬 검증으로 판정 가능 | §2 상세 설계 (O-3, O-5) | do 단계에서 Backend Expert 위임 |
| **(U) 운영 시퀀스** | 실 배포·시크릿 주입·VM 프로비저닝·실 Discord 상호작용 등 Claude 대행 불가 | §4.2 실배포 7단계, §6.2 (U) 검증 | 사용자 실행 (Claude는 절차·체크리스트 제공) |

**따라서 "코드 설계가 부재"한 것이 아니라, 이 Phase의 설계 대상 자체가 대부분 운영 절차**다. §2의 코드 설계(O-3/O-5)는 이 Phase에서 유일하게 코드로 남은 항목을 온전히 다룬다.

---

## 1. 아키텍처 설계

### 1.1 배포 토폴로지 — 하이브리드 2-프로세스 (E안)

두 프로세스는 **직접 통신하지 않고 공유 Redis(Upstash) + Firestore로만 협업**한다. `EventBus`는 각 프로세스 **내부 전용**(in-process EventEmitter)이며 크로스 프로세스 메시징이 아니다.

```
┌───────────────────────────────────┐        ┌────────────────────────────────────┐
│ 프로세스 B: 스케줄러              │        │ 프로세스 A: 게이트웨이             │
│ Firebase Functions (Blaze)        │        │ Oracle Cloud x86 Micro VM + pm2    │
│ 진입점: lib/app/scheduler.js       │        │ 진입점: lib/app/gateway.js          │
│ (main = lib/app/scheduler.js)     │        │ (pm2 start lib/app/gateway.js)     │
│                                   │        │                                    │
│ onSchedule 트리거                 │        │ discord.js WS 상주 (WS-only)       │
│  ├ recruitSchedule_sria           │        │  ├ 슬래시 커맨드 인터랙션          │
│  └ recruitSchedule_temp           │        │  ├ 버튼 인터랙션                   │
│ → SchedulerManager.runRecruitOnce │        │  └ 구독 UI                         │
│ → sync → diff → REST DM           │        │ 인바운드 HTTP 없음(포트 미개방)    │
│   (dmSender.ts, 함수 내부 완결)   │        │ pm2 startup + save (재부팅 부활)   │
│                                   │        │                                    │
│ EventBus: 프로세스 내부 전용      │        │ EventBus: 프로세스 내부 전용       │
└──────────────────┬────────────────┘        └────────────────┬───────────────────┘
                   │                                           │
                   └─────────────┬──────────────┬──────────────┘
                                 ▼              ▼
                       공유 Redis (Upstash    Firestore (관리형)
                       rediss:// TLS)         users/{}/notifications 등
```

- **프로세스 B (스케줄러)**: `onSchedule`(`recruitSchedule_sria` / `recruitSchedule_temp`) → `SchedulerManager.runRecruitOnce(source)` → 수집·diff → DM은 REST(`dmSender.ts`)로 **함수 내부에서 완결**(게이트웨이 WS 불필요). `initFunctionProviders()`(Firebase + Redis + Discord REST)로 부트스트랩. 유휴 비용 0(serverless).
- **프로세스 A (게이트웨이)**: discord.js WS 로그인 상주 → 인터랙션(슬래시·버튼) 수신 전용. `bootstrapGateway()` → `initGatewayProviders()`(Firebase + Redis + Discord WS login). 인바운드 HTTP·포트 개방 없음(WS heartbeat로 이벤트 루프 유지). pm2로 상시 가동·재부팅 부활.
- **공유 계층**: prod Redis = Upstash `rediss://`(TLS). Firestore = 관리형. 두 프로세스가 같은 캐시·구독자 문서를 읽고 쓴다.

### 1.2 레이어 매핑

본 Phase의 코드 변경(C)은 **provider 계층 2개 파일에 국한**된다. 상위 서비스·라우트·EventBus·타입은 변경 없음.

| 프로젝트 레이어 | 변경 내용 |
|----------------|----------|
| Providers (`functions/src/providers/redis/client/connection.ts`) | **O-3**: `socket.reconnectStrategy` + `on("error")` 핸들러 추가 (§2.1) |
| Providers (`functions/src/providers/firebase/seeds/seedCollection.ts`) | **O-5**: `process.exit(1)` 제거 → 로깅 후 degradation (§2.2) |
| Common Utils (`functions/src/common/utils/systemError.ts`) | 변경 없음 — 기존 팩토리(`redisError`/`firestoreError`/`critical`) 사용만 |
| Services / EventBus / Routes / Types | **변경 없음** (계약 불변 — §3) |
| 진입점 (`app/scheduler.ts`·`app/gateway.ts`) | **변경 없음** — 배선은 1.10/1.13에서 완료. 본 Phase는 배포·검증 |
| 운영 설정 (Secret Manager·Blaze·Oracle VM·pm2·슬래시커맨드 등록) | **코드 아님** — §4.2 운영 시퀀스(U) |

### 1.3 컴포넌트 다이어그램 — O-3/O-5 위치

```
[initFunctionProviders / initGatewayProviders]  (양쪽 cold init)
        │
        ├─→ [initFirebaseApp] ─→ [seedCollection]   ← O-5: exit 제거, log-and-continue
        │
        └─→ [initRedis] ─→ [RedisManager.initialize] ─→ [redisConnection]
                                                              │
                                              createClient({ url, socket:{ reconnectStrategy } })  ← O-3
                                              client.on("error", …)  ← O-3: 크래시 흡수
                                              client.on("ready", …)  (기존 유지)
```

---

## 2. 상세 설계 (코드 C — Backend Expert 자문 반영)

> 아래 두 항목은 do 단계에서 **Backend Expert**가 구현한다. 본 절은 Backend Expert 자문을 반영한 **설계안**이며 코드 구현물이 아니다.

### 2.1 O-3 — Redis 재연결 (`socket.reconnectStrategy` + `on("error")`)

**파일**: `functions/src/providers/redis/client/connection.ts`

**문제**: 현재 `createClient`에 `on("error")` 핸들러가 없다. node-redis v4는 연결 이상 시 `error` 이벤트를 emit하는데, 리스너가 없으면 Node가 이를 **unhandled `error` event**로 간주해 프로세스를 크래시시킨다. 상시 게이트웨이(프로세스 A)가 Upstash idle 연결 끊김마다 크래시/플래핑할 위험. 재연결 전략도 부재.

**설계 (node-redis v4 시그니처 기준)**:

`socket.reconnectStrategy: (retries: number, cause: Error) => number | Error` — 지수 백오프 + 상한 + jitter + 상한 도달 시 포기(무한 재시도 아님).

```typescript
// 상수 (모듈 스코프)
const RECONNECT_BASE_DELAY_MS = 200;
const RECONNECT_MAX_DELAY_MS = 10_000;   // 재시도 간격 상한 10초
const RECONNECT_MAX_RETRIES = 20;        // 상한 도달 시 포기(누적 약 3분)

// (retries) => number(대기 ms) | Error(포기)
function buildReconnectStrategy(): (retries: number) => number | Error {
  return (retries) => {
    if (retries > RECONNECT_MAX_RETRIES) {
      return new Error("Redis reconnect attempts exhausted");
    }
    const exp = Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_BASE_DELAY_MS * 2 ** retries);
    const jitter = exp * (0.8 + Math.random() * 0.4); // ±20%
    return Math.floor(jitter);
  };
}

const client: RedisClientType = createClient({
  url: ENV.REDIS_URL,
  socket: { reconnectStrategy: buildReconnectStrategy() },
});

client.on("ready", () => globalLogger.info("redis connected.")); // 기존 유지
client.on("error", (err: Error) => {
  // 흡수만 하고 rethrow 금지 — 리스너 존재 자체가 크래시를 막는다.
  SystemError.redisError("Redis client error (auto-recovering)", err, { phase: "runtime" });
});
```

**핵심 로직 방침**:
- **크래시 방지 1차 목적**: `on("error")` 리스너 추가만으로 달성된다(Node가 리스너 있으면 크래시 안 함). 기존 크래시 원인이 바로 이 리스너 부재.
- **에러 흡수 원칙**: 핸들러 안에서 절대 `throw`/rethrow하지 않는다. 재연결 중 발생하는 에러는 회복 가능한 노이즈이므로 `SystemError.redisError`(FAILURE, recoverable)로 흡수.
- **중복 로깅 방지**: `SystemError` 생성자가 자동 로깅(`this.log()`)하므로 핸들러에서 별도 `globalLogger` 호출을 겹치지 않는다.
- **백오프 근거**: Upstash `rediss://` idle 끊김은 정상 범주 → 짧은 backoff(base 200ms)로 빠르게 회복. 단, 네트워크 영구 장애 시 무한 재시도는 상시 프로세스에서 리소스 낭비·로그 폭주 → 20회(~3분) 후 포기해 상위 모니터링이 CRITICAL을 감지하게 위임.

**재연결 영구 실패(상한 도달) 시 동작**:
- `reconnectStrategy`가 `Error` 반환 → client는 재연결 중단·`isReady=false`로 고정. 이때도 `on("error")`가 흡수하므로 **프로세스는 죽지 않는다**.
- **게이트웨이(상시)**: 프로세스 유지. `SystemError.critical("Redis 재연결 영구 실패", err)`로 격상 로깅 → 향후 모니터링(Phase 2.1/2.2, `monitoring-eventbus-observer-channels` 설계)이 감지. Discord WS는 Redis와 독립이므로 봇 전체를 죽일 이유 없음.
- **스케줄러(Functions onSchedule)**: 단발 실행 → 해당 invocation의 Redis 의존 작업만 실패(캐시 miss 취급) 처리하고 함수는 정상 종료. Functions 플랫폼 자체 재시도에 위임.
- **공통 원칙**: 재연결 로직 어디에서도 `process.exit` 호출 금지(양쪽 프로세스 공통).

**에러 처리**:
- `SystemError.redisError()` / `SystemError.critical()` 팩토리 사용(둘 다 `systemError.ts`에 존재 확인 — L247, L422). 생성자 자동 로깅으로 SystemLogger 연계.

**기존 동작 보존**:
- `on("ready")` 로그·정상 연결 경로·반환 시그니처(`Promise<RedisClientType | null>`) 전부 무변화. `socket.reconnectStrategy` + `on("error")` 추가만으로 정상 흐름 영향 없음.
- 로컬 DUMMY E2E(단발 스케줄러, 로컬 redis)는 연결이 끊길 상황이 없어 `reconnectStrategy` 미호출 → 부작용 없음.

**후속 검토(범위 밖 명시)**: 연결 후 재연결 실패로 `isReady=false`가 된 dead-client를 캐시 스토어가 감지해 Firestore 폴백/스킵으로 degrade하는 경로는 O-3 범위 밖(현 `redisConnection()`은 **최초 연결 실패 시에만** null 반환). 캐시 계층 후속 태스크로 분리.

### 2.2 O-5 — seedCollection `process.exit(1)` 완화

**파일**: `functions/src/providers/firebase/seeds/seedCollection.ts` (+ 호출측 `initFirebaseApp.ts` 계약 확인)

**문제**: `seedCollection`의 catch가 `process.exit(1)`로 인스턴스를 죽인다. `initFirebaseApp`이 이를 **fire-and-forget**(await 없이)으로 호출하므로, 일시적 Firestore 오류가 **무관한 시점에 비동기로 터져** 인스턴스를 죽이는 비결정적 크래시가 된다. Functions는 cold start마다 seed가 돌아 스케줄 tick 유실 위험, 상시 게이트웨이도 seed 실패로 인터랙션이 중단될 수 있다.

**판단**: `seedCollection`은 기본 컬렉션 존재를 보장하는 **idempotent 초기화**이며, 앱 핵심(캐시 read/DM)은 seed 성공에 **하드 의존하지 않는다**. 누락 컬렉션/문서는 read-miss 시 폴백 경로가 이미 존재(`firestore-recruit-backup-time-based-deferred`와 동일 원칙).

**설계 (권장안: `process.exit` 완전 제거 → 로깅 후 정상 `return`)**:

```typescript
export async function seedCollection(init: boolean = false) {
  const db = getFirestore();
  try {
    await Promise.all([
      initConnectionCollection(db, init),
      initRecruitCollection(db, init),
    ]);
    globalLogger.info("✅ 초기화 작업 완료!"); // 정상 경로 무변화
  } catch (error) {
    // exit/throw 없음 — 로깅 후 정상 반환(swallow)
    SystemError.firestoreError(
      "초기화 컬렉션 시드 실패 (계속 진행)",
      error instanceof Error ? error : undefined,
      { init },
    );
  }
}
```

**호출측(`initFirebaseApp.ts`) 계약 변화**:
- **그대로 fire-and-forget 유지** — 오히려 exit 제거로 "await 안 하는데 나중에 exit(1)이 터지는" 위험 조합이 근본적으로 사라진다. 별도 await/try-catch 추가 불필요.
- 확인 결과 `seedCollection` 호출부는 `initFirebaseApp.ts` **1곳뿐**(별도 CLI/시드 스크립트 진입점 없음) → "최초 배포(seed=true)만 exit 유지" 같은 분기 불필요. **무조건 log-and-continue로 통일**.

**중요(함정)**: catch에서 로깅 후 **절대 `throw`(rethrow) 금지** — 호출부가 await하지 않으므로 rethrow하면 unhandled promise rejection이 되어 Node가 또 다른 경로로 프로세스를 죽인다. 반드시 흡수(swallow) + 로깅만.

**에러 처리**:
- `SystemError.firestoreError()` 사용(`systemError.ts` L260 존재 확인) — `category: FIRESTORE`, `level: FAILURE`로 분류·자동 로깅. `recoverable: false` 기본값은 "이 시드 작업 자체에 재시도 로직이 없다"는 분류일 뿐 프로세스 생존과 무관 → 그대로 사용.

**기존 정상 동작 보존 검증안**:
- `Promise.all` 성공 경로(`✅ 초기화 작업 완료!` 로그)·`init` 파라미터 시그니처·`initConnectionCollection`/`initRecruitCollection` 호출 방식 전부 무변화. **try/catch의 실패 처리 부분만 교체**.
- 로컬에서 정상 Firestore(에뮬레이터) 연결 시 seed가 정상 완료돼 로그가 동일하게 출력됨을 확인(§6.1).

---

## 3. 데이터 설계 — 계약 불변 확인

본 Phase의 코드 변경(O-3/O-5)은 **데이터 계약·스키마에 영향을 주지 않는다**. 견고성(재연결·degradation) 보강만 수행.

### 3.1 DM 계약 (불변)

| 계약 | 상태 | 근거 |
|------|------|------|
| `DmPayload { embeds?, content? }` | **불변** | O-3/O-5는 provider 초기화·연결 계층 → dmSender 시그니처 무관 |
| `DmSendResult { ok, skipped?, reason?, errorCode?, durationMs, attempts }` | **불변** | 동일 |

### 3.2 Redis 키 / Firestore 문서 (불변)

| 대상 | 영향 | 근거 |
|------|------|------|
| Redis 키 스키마 (`recruit`, `recruit_hash`, `requestLimit`) | **없음** | O-3은 client **연결 옵션**만 변경, 키·값 스키마 무관 |
| Firestore 컬렉션 (`users/{}/notifications`, recruit/connection seed) | **없음** | O-5는 seed **실패 처리**만 변경, 문서 구조·필드 무변화 |

### 3.3 이벤트 페이로드 (불변)

EventBus 이벤트 타입·페이로드 변경 없음. EventBus는 프로세스 내부 전용이며 본 Phase에서 신규 이벤트를 추가하지 않는다.

---

## 4. 구현 순서

### 4.1 코드 (C) — do 단계, Backend Expert 위임

| 순서 | 작업 | 파일 | 설계 참조 | 판정 |
|------|------|------|----------|------|
| C-1 | O-3 Redis 재연결: `reconnectStrategy` + `on("error")` | `providers/redis/client/connection.ts` | §2.1 | tsc/build + 로컬 DUMMY E2E 무손상 |
| C-2 | O-5 seedCollection exit 완화: `process.exit` 제거 → log-and-continue | `providers/firebase/seeds/seedCollection.ts` | §2.2 | tsc/build + 정상 seed 로그 확인 |

> 순서 근거: C-1(재연결)과 C-2(seed 완화)는 독립적이나, 둘 다 provider 초기화 견고성 항목이라 함께 처리한다. 순서 의존성 없음.

### 4.1b 배포 직전 품질 게이트 (Q — lint-cleanup, A안 결정 2026-09-30)

> **사용자 결정(A안, 2026-09-30)**: 배포본을 lint 통과 상태로 내보낸다. 코드(C-1/C-2) 완료 **후**, 실배포(U-P3 `firebase deploy`) **전**에 수행한다.

| 순서 | 작업 | 산출물 | 근거 |
|------|------|--------|------|
| Q-1 | lint-cleanup: 잔여 485 errors 정리 (~440 `eslint --fix` 자동 + ~15 수동) | 별도 `chore` 커밋/PR | O-3/O-5 신규 코드까지 포함해 정리하려면 C-1/C-2 **뒤** |
| Q-2 | lint predeploy 복구: `firebase.json` predeploy에 `npm run lint` 재추가 | 설정 변경 | Q-1 완료 전제 — 미정리 상태로 켜면 deploy 차단 |

> **위치 근거**: Q는 **C 뒤 · U-P3 앞**. predeploy lint는 deploy 시점에 돌므로 그 전에 485건이 정리돼야 배포가 막히지 않는다. lint-cleanup은 diff가 커 O-3/O-5 기능 커밋과 **분리**(별도 chore PR — `todo.md` #4·메모리 `eslint-predeploy-latent-debt`).

> **보류(미설계) — O-7 onSchedule timeZone**: 현재 스케줄이 인터벌(`sriaConfig.schedule="every 4 hours"` / `tempConfig.schedule="every 30 minutes"`)이라 timeZone은 **효과 없는 죽은 설정**이다. "매일 특정 시각 발송" 같은 **시각 지정 cron으로 전환할 때만** `Asia/Seoul`이 필요하다. 그 제품 요구가 생기기 전까지 **본 Phase 미포함**(사용자 결정 2026-09-30).

### 4.2 운영 (U) — 실배포 7단계 시퀀스 (사용자 실행)

> **순서 근거**: O-4(시크릿)가 선행되지 않으면 이후 `firebase deploy`가 런타임에 실패한다(dotenv는 prod 무효). 게이트웨이가 live(4)돼야 슬래시커맨드 등록(5)·구독자 시드(6)가 성립하고, 그래야 U-1~U-4 검증(7)의 대상이 존재한다. **각 단계는 선행 완료를 전제로만 진행**한다.

| 순서 | 작업 | 명령/절차 | 게이트 |
|------|------|----------|--------|
| **U-P1** | **O-4 Secret Manager 주입** 🔴 선행 필수 | `firebase functions:secrets:set FB_PRIVATE_KEY` / `firebase functions:secrets:set DISCORD_BOT_TOKEN` + 함수 정의에 시크릿 바인딩 | 미완료 시 이후 배포 런타임 실패 → **여기서 멈춤** |
| **U-P2** | Blaze 종량제 전환 | Firebase 콘솔에서 Blaze 전환(onSchedule/egress 필수) | 과금 노출 — **사용자 승인 사항** |
| **U-P3** | 스케줄러 배포 (프로세스 B) | `firebase deploy` (Functions: `recruitSchedule_sria`/`recruitSchedule_temp`) | U-P1·U-P2 **및 Q(lint-cleanup+predeploy 복구)** 완료 전제 — predeploy lint가 여기서 돎 |
| **U-P4** | 게이트웨이 프로비저닝 (프로세스 A) | Oracle x86 Micro VM 프로비저닝 → `pm2 start lib/app/gateway.js` → `pm2 startup` → `pm2 save` | VM 가용성(§5) |
| **U-P5** | 슬래시커맨드 prod 등록 (O-9) | `npm run register:commands` | U-P4(게이트웨이 live) 전제 |
| **U-P6** | 구독자 시드 확보 (O-6) | 실 Discord에서 구독 인터랙션 수행 → 구독자 문서 생성(= DM 대상 존재 보장) | U-P5 전제 |
| **U-P7** | 실환경 검증 U-1~U-4 | §6.2 체크리스트 | U-P3~U-P6 완료 전제 |

---

## 5. 리스크 및 대응

| 리스크 | 심각도 | 대응 |
|--------|--------|------|
| **O-4 미해결 시 실배포 런타임 실패** | 🔴 | 최우선 **선행 게이트**로 배치(U-P1). 시크릿 주입 확인 전 `firebase deploy` 금지. dotenv는 prod 무효이므로 Secret Manager 경유 필수 |
| **Oracle x86 Micro VM 가용성 뽑기**(capacity 고갈) | ⚠️ | 대체안 — 유료 소형 인스턴스 또는 타 리전 시도. 게이트웨이는 WS-only라 스펙 요구가 낮아 대체 용이 |
| **Blaze 종량제 전환 과금** | ⚠️ | 과금 노출 → **사용자 승인 사항**(U-P2). 예산 알림·상한 설정 권장 |
| O-3 재연결 영구 실패 시 캐시 계층 dead-client | 🟢 | 본 Phase는 크래시 방지·격상 로깅까지(§2.1). Firestore 폴백 degrade는 캐시 계층 후속 태스크로 분리 |
| 검증 대부분 (U) 의존 → 사용자 실행 부담 | ⚠️ | (C)/(U) 분류(§0)로 사전 고지. (U) 항목별 실행 방법을 §6.2·do/report에서 명시 |

---

## 6. 테스트 / 검증 계획

### 6.1 (C) Claude 판정 가능 — 정적 + 단위 검증

| 검증 항목 | 방법 | 기대 결과 |
|----------|------|----------|
| 전체 컴파일 무손상 | `npx tsc --noEmit` / `npm run build` | 에러 없음 |
| O-3 로컬 DUMMY E2E 무손상 | `RUN_SCHEDULER_ONCE=true node lib/app/scheduler.js`(로컬 redis) | 정상 연결·sync 완료, `reconnectStrategy` 미호출(끊김 없음) |
| O-3 `on("error")` 흡수 | 단위 검증: 잘못된 `REDIS_URL`로 연결 시 프로세스가 **크래시하지 않고** `redisError` 로깅 후 재연결 시도 관찰 | unhandled error 크래시 없음 |
| O-3 상한 포기 동작 | `reconnectStrategy`가 retries > 20에서 `Error` 반환하는지(순수 함수 단위 검증) | 21회째 `Error` 반환 |
| O-5 정상 seed 무변화 | Firestore 에뮬레이터로 정상 seed 실행 | `✅ 초기화 작업 완료!` 로그, 기존과 동일 |
| O-5 실패 시 degradation | seed에서 강제 오류 주입 시 `process.exit` 없이 `firestoreError` 로깅 후 프로세스 계속 | 인스턴스 생존, 로깅만 |

### 6.2 (U) 사용자만 가능 — 실환경 운영 검증 체크리스트

> 실 Discord 상호작용·실 배포 환경·실 DM 전송이 필요해 Claude 대행 불가. do/report 단계에서 실행 방법을 사용자에게 제시하고 결과를 보고받는다(`review-process.md` 0단계 (U) 절차).

| ID | 검증 항목 | 방법 | 기대 결과 |
|----|----------|------|----------|
| **U-1** | 게이트웨이 슬래시 인터랙션 왕복 | 실 게이트웨이(pm2)에서 슬래시 커맨드 실행 | 인터랙션 응답 정상 수신 |
| **U-2** | 게이트웨이 버튼 인터랙션 왕복 | 실 게이트웨이에서 버튼 클릭 | 버튼 핸들러 응답 정상 |
| **U-3** | 실 onSchedule 트리거 발화 | 프로덕션 스케줄 주기에서 `recruitSchedule_sria`/`_temp` 발화 관찰(Functions 로그) | 스케줄 tick 실행·sync 완료 |
| **U-4** | 에뮬·실 2-run E2E 실 DM 수신 | 에뮬레이터 및 실환경 2-run E2E(= todo R4/R5): 1-run 수집·2-run diff → 구독자에게 실 DM | 실 DM 수신, diff 기반 알림 도착 |

> 추가 상시성 확인: U-P4 이후 pm2 재부팅 부활(`pm2 startup`+`save`), O-3 재연결(Upstash idle 끊김 후 자동 회복)은 실환경 장기 관찰 항목으로 report 단계에서 사용자 확인.

---

## 7. 코딩 컨벤션 체크리스트 (do 단계 준수)

- [ ] camelCase 변수/함수, PascalCase 클래스/인터페이스/타입
- [ ] `globalLogger`/`providerLogger` 사용 (`console.log` 금지)
- [ ] `SystemError` 팩토리 준수 (`redisError`/`firestoreError`/`critical`) — 생성자 자동 로깅으로 중복 로깅 회피
- [ ] `on("error")` 핸들러는 throw/rethrow 금지 (흡수만)
- [ ] `seedCollection` catch는 swallow + 로깅만 (rethrow·exit 금지)
- [ ] `process.exit` 신규 도입 금지 (양쪽 프로세스 공통 원칙)
- [ ] JSDoc 주석 (public/신규 함수 — `buildReconnectStrategy` 등)
- [ ] 한국어 주석 (필요 시)

---

*작성일: 2026-09-30*
*작성: Integration Lead (총괄) + Backend Expert (§2 O-3/O-5 코드 설계 자문)*
*기반: docs/phase-1-14/01-plan.md*
*ADR 정본: docs/archive/phase-1-10/07-deploy-architecture-decision.md*
