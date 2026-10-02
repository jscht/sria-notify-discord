# Phase 1.14: 프로덕션 배포·운영 (production-deploy)

**상태**: 🔄 진행 중
**우선순위**: ⭐⭐⭐ (P0)
**의존성**: Phase 1.10 (archived, 매치율 99.3%), Phase 1.13 (archived, 매치율 100%) — 둘 다 충족
**feature id**: `phase-1-14-production-deploy`

---

## 개요

### 배경

Phase 1.10/1.13에서 E안(하이브리드 2-프로세스) 배포 배선을 **코드로 완성**했으나(정적 analyze 통과, matchRate 99.3%/100%), 다음이 이월된 상태다:

- **실제 프로덕션 배포**: Functions deploy(스케줄러) + Oracle VM/pm2(게이트웨이) 미수행
- **실환경 검증**: 실 onSchedule 발화, 게이트웨이 인터랙션 왕복, 실 DM 수신(U-1~U-4) 미검증
- **운영 갭**: CTO 운영감사에서 도출된 O-3~O-9 미해소

코드 matchRate와 별개로 **"실배포 성립성"**(실제 프로덕션에서 런타임이 성립하는지)이 확보되지 않았다. 특히 O-4(Secret Manager)가 미해결이면 코드를 모두 고쳐도 prod 배포가 런타임에 실패한다.

### 목표

E안을 실제 프로덕션에 배포하고, 실환경에서 **sync → diff → DM 완결** + **인터랙션 왕복**을 검증한다. 운영 갭(O-3~O-9)을 해소하여 두 프로세스가 프로덕션에서 안정적으로 상시 가동되게 한다.

### 범위

| 포함 | 제외 |
|------|------|
| O-3(Redis 재연결)·O-5(seedCollection exit) 코드 수리 | 모니터링(A/B·MonitoringService+채널) → Phase 2.1/2.2 |
| O-4(Secret Manager)·O-6/O-9(구독자 시드·슬래시커맨드 prod 등록) 운영 절차 | lint-cleanup (별도 todo 태스크) |
| E안 실배포 (Functions deploy + Oracle VM + pm2) | scheduler factory refactor (별도 todo 태스크) |
| 실환경 검증 U-1~U-4 (onSchedule 발화·인터랙션 왕복·실 DM) | O-7 timeZone 강제 적용 (인터벌 유지 시 무해, 선택) |

> 모니터링(A=생존감시/B=이상감지)은 배포가 선행돼야 감시 대상이 존재하므로 Phase 2.1이 1.14에 의존한다. 따라서 본 Phase에서 제외한다.

---

## 요구사항

### 기능 요구사항

1. **O-3 Redis 재연결 (코드)**: Redis client에 `on("error")` 핸들러 + reconnectStrategy 추가. 상시 게이트웨이가 Upstash idle 연결 끊김 시 크래시/플래핑하지 않고 재연결하도록 한다. (모니터링 [B] 이상감지의 신호원이기도 하므로 향후 2.2의 기반)
2. **O-5 seedCollection process.exit 재검토 (코드)**: `initFirebaseApp`가 cold init마다 `seedCollection`을 호출하고 실패 시 `process.exit(1)`로 인스턴스를 죽이는 경로를 재검토·완화한다.
3. **O-4 Secret Manager 주입 (운영, 🔴 선행 필수)**: Functions 프로덕션 시크릿(`FB_PRIVATE_KEY`/`DISCORD_BOT_TOKEN`)을 Firebase/GCP Secret Manager로 주입한다(dotenv는 prod에서 무효). 함수 정의에 시크릿 바인딩.
4. **O-6/O-9 구독자 시드 + 슬래시커맨드 prod 등록 (운영)**: 게이트웨이 live 후 `npm run register:commands`로 슬래시커맨드를 prod에 등록 → 구독 인터랙션으로 구독자 시드를 확보(= DM 대상 존재 보장).
5. **E안 실배포 (운영)**: 스케줄러 = `firebase deploy`(Functions, Blaze 전환 필요) / 게이트웨이 = Oracle x86 Micro VM(Always Free) 프로비저닝 + pm2 상주.
6. **실환경 검증 U-1~U-4 (운영)**: 실 onSchedule 트리거 발화, 게이트웨이 인터랙션(슬래시·버튼) 왕복, 에뮬·실 2-run E2E 실 DM 수신을 확인한다.

### 비기능 요구사항

- **가용성**: 게이트웨이(프로세스 A)는 pm2로 상시 가동, idle 끊김에도 자동 재연결.
- **호환성**: 기존 코드와의 하위 호환성 유지. O-3/O-5 수정은 로컬 DUMMY E2E 동작을 깨지 않아야 함.
- **에러 처리**: SystemError 패턴 준수. Redis 재연결·seedCollection 실패는 SystemLogger로 로깅.
- **보안**: 시크릿은 코드/저장소에 노출 금지, Secret Manager 경유.

---

## 기술 스택 (프로젝트 고정)

| 항목 | 기술 |
|------|------|
| Runtime | Firebase Functions (Node.js) — 스케줄러 프로세스 B |
| Gateway Runtime | Oracle Cloud x86 Micro VM (Always Free) + pm2 — 프로세스 A |
| Language | TypeScript (strict mode) |
| Database | Firestore (관리형) |
| Cache | Redis (prod = Upstash, `rediss://` TLS URL) |
| Messaging | discord.js (게이트웨이 WS) + REST DM(`providers/discord/dmSender.ts`) |
| Event System | EventBus (프로세스 내부 전용, 크로스 프로세스 통신 아님) |
| Secret | Firebase/GCP Secret Manager |
| Error Handling | SystemError + errorHandler |
| Logging | SystemLogger |

---

## E안 토폴로지 (ADR 정본)

> ADR 정본: `docs/archive/phase-1-10/07-deploy-architecture-decision.md`

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│ 프로세스 B: 스케줄러         │        │ 프로세스 A: 게이트웨이        │
│ Firebase Functions (Blaze)  │        │ Oracle x86 Micro VM + pm2    │
│                             │        │                              │
│ onSchedule                  │        │ discord.js WS 상주           │
│  ├ recruitSchedule_sria     │        │  ├ 슬래시 커맨드 인터랙션    │
│  └ recruitSchedule_temp     │        │  ├ 버튼 인터랙션             │
│ → crawlAndDiff → diff       │        │  └ 구독 UI                   │
│ → REST DM (dmSender.ts)     │        │ pm2 start lib/app/gateway.js │
│   (함수 내부 완결)          │        │  + startup + save            │
└──────────────┬──────────────┘        └───────────────┬──────────────┘
               │                                        │
               └──────────┬──────────────┬──────────────┘
                          ▼              ▼
                 공유 Redis(Upstash)   Firestore(관리형)
```

- **프로세스 B(스케줄러)**: `onSchedule` 트리거(`recruitSchedule_sria` / `recruitSchedule_temp`) → Firebase Functions 배포. DM은 REST(`providers/discord/dmSender.ts`)라 **함수 내부에서 완결**(게이트웨이 WS 불필요).
- **프로세스 A(게이트웨이)**: discord.js WS + 인터랙션 UI → Oracle Cloud x86 Micro VM(Always Free) + pm2 상주.
- **협업**: 공유 Redis(prod=Upstash `rediss://`) + Firestore. EventBus는 **각 프로세스 내부 전용**(크로스 프로세스 아님).
- **진입점**: `functions/package.json` main = `lib/app/scheduler.js`. 게이트웨이 = `functions/src/app/gateway.ts`(+`bootstrapGateway.ts`).

---

## §위임 계획 (CTO Lead 승인안)

| 영역 | 위임 대상 | 근거 | 예상 산출물 |
|------|----------|------|-------------|
| plan.md 작성 (2-프로세스 배포·운영 총괄) | **Integration Lead 단독** | E안 = 스케줄러(Functions) ↔ 게이트웨이(VM)를 공유 Redis/Firestore로 잇는 인프라 조율 성격 | 본 `01-plan.md` |
| design.md 작성 (차기) | **Integration Lead 단독** | plan 연속성. O-6/O-9는 운영 절차라 Discord Agent 별도 불요 | `02-design.md` (design 단계) |
| O-3/O-5 코드 수리 (차기) | **Backend Expert** (do 단계 위임 예정) | Redis client·`initFirebaseApp` 수정 — 데이터/인프라 계층 | do 단계 코드 |

---

## 운영 갭 원장 — (C)/(U) 분류표

작업을 **(C) Claude 실행 가능**과 **(U) 사용자만 가능**으로 분류한다(`review-process.md` 0단계 기준). 외부 시스템 실 상호작용·실 배포·과금 노출은 (U)로 둔다.

### (C) 코드 — Claude (do 단계에서 Backend Expert 위임 예정)

| ID | 심각도 | 항목 | 내용 | 분류 근거 |
|----|--------|------|------|-----------|
| O-3 | 🟡 | Redis 재연결 | Redis client에 `on("error")` + reconnectStrategy 부재 → 상시 게이트웨이가 Upstash idle 끊김 시 크래시/플래핑. 재연결 로직 추가 | 코드 수정 + tsc/build로 Claude 판정 가능 |
| O-5 | 🟡 | seedCollection exit | `initFirebaseApp`가 cold init마다 `seedCollection` 호출, 실패 시 `process.exit(1)`로 인스턴스 킬 → 재검토·완화 | 코드 수정 + 로컬 검증으로 Claude 판정 가능 |
| O-7 | 🟢 (선택) | onSchedule timeZone | 현재 인터벌이라 무해. 시각 cron 전환 시에만 `Asia/Seoul` 지정 필요 | 코드 수정, 다만 현행 무해라 선택 |
| — | 🟢 (선택) | lint predeploy 복구 | lint-cleanup(별도 todo) 완료 후 `firebase.json` predeploy에 `npm run lint` 재추가 검토 | lint-cleanup 선행 의존, 별도 태스크 |

### (U) 운영 — 사용자만 가능 (Claude 대행 불가)

| ID | 심각도 | 항목 | 내용 | 분류 근거 |
|----|--------|------|------|-----------|
| O-4 | 🔴 | Secret Manager | Functions 프로덕션 시크릿(`FB_PRIVATE_KEY`/`DISCORD_BOT_TOKEN`)을 GCP/Firebase Secret Manager로 주입(dotenv 무효). `firebase functions:secrets:set ...` + 함수 정의 바인딩. **미해결 시 코드 다 고쳐도 실 prod 배포 런타임 실패 — 최우선 선행 절차** | GCP 콘솔·시크릿 자격증명 필요, Claude 대행 불가 |
| O-6/O-9 | 🟡 | 구독자 시드 + 슬래시커맨드 prod 등록 | 게이트웨이 live + `npm run register:commands` 선행돼야 구독 인터랙션 발생 → DM 대상 존재 보장 | 실 게이트웨이 기동·실 Discord 등록 필요 |
| — | — | E안 실배포 | 스케줄러 = `firebase deploy`(Functions, Blaze 전환 필요) / 게이트웨이 = Oracle x86 Micro VM 프로비저닝 + pm2 상주 | 실 배포·VM 프로비저닝·과금, Claude 대행 불가 |
| U-1 | — | 게이트웨이 슬래시 인터랙션 왕복 | 실 게이트웨이에서 슬래시 커맨드 왕복 확인 | 실 Discord 상호작용 필요 |
| U-2 | — | 게이트웨이 버튼 인터랙션 왕복 | 실 게이트웨이에서 버튼 인터랙션 왕복 확인 | 실 Discord 상호작용 필요 |
| U-3 | — | 실 onSchedule 트리거 발화 | 프로덕션 스케줄 주기에서 실제 onSchedule 발화 확인 | 실 배포 환경 필요 |
| U-4 | — | 에뮬·실 2-run E2E 실 DM 수신 | 에뮬레이터 및 실환경 2-run E2E에서 실 DM 수신(= todo R4/R5) | 실 DM 전송·수신 필요 |

---

## 이미 해소됨 (참고 — 재작업 불요)

| ID | 처리 |
|----|------|
| O-1 env 표기 | `build-deploy.md` 정정 완료 |
| O-2 REDIS_PASSWORD 미사용 | `build-deploy.md` 정정 완료 |
| O-8 헬스체크 | 게이트웨이 WS-only → push 모니터링(2.1/2.2)으로 대체 |
| O-10 firestore 인덱스 | 이미 존재 |

---

## 실배포 순서 (권장 실행 순서)

> 순서 근거: O-4가 선행되지 않으면 이후 `firebase deploy`가 런타임에 실패한다. 게이트웨이가 live 되어야(4단계) 슬래시커맨드 등록(5)·구독자 시드(6)가 성립하고, 그래야 U-1~U-4 검증(7)의 대상이 존재한다.

1. **O-4 Secret Manager 주입** (🔴 선행 필수) — `firebase functions:secrets:set FB_PRIVATE_KEY` / `DISCORD_BOT_TOKEN` + 함수 정의 바인딩
2. **Blaze 종량제 전환** — onSchedule/egress 사용을 위해 필수 (과금 노출, 사용자 승인 사항)
3. **`firebase deploy`** — 스케줄러 Functions(프로세스 B) 배포
4. **Oracle VM 프로비저닝 + pm2 게이트웨이 상주** — 프로세스 A: `pm2 start lib/app/gateway.js` + `pm2 startup` + `pm2 save`
5. **`npm run register:commands`** — 슬래시커맨드 prod 등록 (O-9)
6. **구독 인터랙션으로 구독자 시드** — DM 대상 확보 (O-6)
7. **U-1~U-4 실환경 검증** — onSchedule 발화 / 인터랙션 왕복 / 2-run E2E 실 DM

---

## 구현 전략

### 접근 방식

- **코드(C)와 운영(U)을 분리 진행**: do 단계에서 O-3/O-5 코드 수정을 Backend Expert에 위임하고, 운영(U) 절차는 사용자 실행 체크리스트로 제공한다.
- **실배포 순서를 게이트로 사용**: O-4(시크릿)를 최우선 선행 게이트로 두고, 이후 단계는 선행 완료를 전제로만 진행한다.
- **검증은 실환경 우선**: 정적 analyze는 이미 통과했으므로, 본 Phase의 핵심 가치는 (U) 실환경 검증(U-1~U-4)에 있다.

### 영향 받는 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `functions/src/providers/redis/` (client) | 수정 | O-3: `on("error")` + reconnectStrategy 추가 |
| `functions/src/providers/firebase/` (`initFirebaseApp`) | 수정 | O-5: seedCollection 실패 시 `process.exit(1)` 경로 재검토 |
| `firebase.json` (predeploy) | 수정 (선택) | lint-cleanup 완료 후 `npm run lint` 재추가 |
| `functions/src/app/scheduler.ts` (onSchedule 정의) | 수정 (선택) | O-7: 시각 cron 전환 시 `timeZone: "Asia/Seoul"` |

> 실배포·시크릿 주입·VM 프로비저닝은 코드 변경이 아닌 운영 절차이므로 파일 변경 없음.

### 의존성 분석

- **선행 의존**: Phase 1.10(E안 배포 배선 코드), Phase 1.13(2-프로세스 토폴로지) — 둘 다 archived 충족.
- **후속 의존**: Phase 2.1(생존감시)·2.2(이상감지) 모니터링이 본 Phase(배포)에 의존한다. 배포가 완료돼야 감시 대상(상시 프로세스)이 존재.
- **외부 의존**: GCP Secret Manager, Blaze 요금제, Oracle Cloud Always Free VM, Upstash Redis.

---

## 성공 기준

- [ ] O-3 Redis 재연결 로직 추가 후 TypeScript 컴파일 성공 + 로컬 DUMMY E2E 정상
- [ ] O-5 seedCollection 실패 시 인스턴스 킬 경로 완화, 기존 동작 유지
- [ ] O-4 시크릿이 Secret Manager로 주입되어 실 prod 배포 런타임 성공
- [ ] 두 프로세스(스케줄러 Functions + 게이트웨이 VM)가 프로덕션에서 상시 가동
- [ ] 실 스케줄 주기에서 sync → diff → DM 완결 (U-3, U-4)
- [ ] 인터랙션(슬래시/버튼)이 실 게이트웨이에서 왕복 (U-1, U-2)
- [ ] 슬래시커맨드 prod 등록 + 구독자 시드 확보로 DM 대상 존재 보장 (O-6/O-9)
- [ ] 시크릿·구독자 시드·Redis 재연결이 실환경에서 안정

---

## 리스크 및 고려사항

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| O-4 미해결 시 실배포 런타임 실패 | 🔴 | 최우선 선행 절차로 배치(실배포 순서 1단계). 시크릿 주입 확인 전 `firebase deploy` 진행 금지 |
| Oracle x86 Micro VM 가용성 뽑기(capacity 고갈) | ⚠️ | 대체안 확보 — 유료 소형 인스턴스 또는 타 리전 시도 여지 |
| Blaze 종량제 전환 필수(onSchedule/egress) | ⚠️ | 과금 노출 — 사용자 승인 사항. 예산 알림·상한 설정 권장 |
| 검증 대부분 (U) 의존 → 사용자 실행 부담 | ⚠️ | (C)/(U) 분류표로 사전 고지. (U) 항목별 실행 방법을 do/report 단계에서 명시 제공 |

---

*작성일: 2026-09-30*
*시드: .claude/phases/phase-1-core.md (Phase 1.14 절, L416-438)*
*ADR 정본: docs/archive/phase-1-10/07-deploy-architecture-decision.md*
