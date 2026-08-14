# Phase 1.13: 프로덕션 런타임 & 스케줄러 트리거 재설계

**상태**: 🔄 진행 중
**우선순위**: ⭐⭐⭐ (P0)
**의존성**: Phase 1.9 완료 (archived, matchRate 100%)

---

## 개요

### 배경

현재 배포 타깃이 `onRequest` cold-start Cloud Functions라, 프로덕션에서 두 가지가 동작하지 않는다:

- `BaseScheduler`의 in-process `setTimeout` 스케줄러(`BaseScheduler.ts:119-121`) → 응답 후 CPU 동결로 4시간 타이머가 발화하지 않는다.
- 봇이 gateway WebSocket에 의존 → dmSender(`dmSender.ts:117/122` `getDiscordReady` + `client.users.fetch`)가 서버리스 틱과 비호환이다.

또한 스케줄러가 사용자 요청용 3-tier 캐시 경로(`recruitService.getRecruitList`)를 호출해, TTL 없는 Firestore canonical doc이 항상 히트하면서 **실제 크롤(Step4)에 도달하지 못해 변경 감지가 무의미**해진다.

Phase 1.9는 이 때문에 "로컬 검증 한정"으로 축소되었고(startup wiring + 로컬 DUMMY 스케줄러 + ready 게이트 + env rename + emulator DM E2E), 실 CRAWL·프로덕션 구동은 Phase 1.10으로 이월됐다.

### 목표

런타임을 재설계하여 서버리스 환경에서 크롤→diff→알림 파이프라인이 성립하도록 **코드까지 완성 + 로컬 검증**한다. 실배포·실 CRAWL 활성화·프로덕션 E2E는 Phase 1.10으로 이월한다.

### 범위

| 포함 | 제외 |
|------|------|
| §1 런타임 결정 (C안 하이브리드 확정) | 실배포 (gateway Cloud Run + 함수) → 1.10 |
| 진입점 분리 (gateway / 함수 부트스트랩) — 코드 | 실 CRAWL 활성화 (`recruitMode: CRAWL`) → 1.10 |
| `setTimeout` → `onSchedule` 전환 — 코드 (정적) | onSchedule 실발화 검증 → 1.10 |
| dmSender gateway → REST 전용 (계약 불변) | REST 실전송·프로덕션 E2E → 1.10 |
| 틱 완결 파이프라인 (크롤→diff→알림 await) | `crawlService.ts:28` DUMMY 버그(#6) → 1.10 이월 |
| 스케줄러 전용 `crawlAndDiff(mode)` 분리 | 인터랙션 HTTP 전환 (C안은 gateway 유지 → 불필요) |
| EventBus/durable 경계 방침 명시 (design §1) | durable bus(Firestore 트리거) 실제 배선 → 2.1/2.2 |

---

## 요구사항

### 기능 요구사항

1. **§1 런타임 결정 — C안 하이브리드 확정**: 인터랙션 수신은 gateway 상시 프로세스 유지, 크롤·알림은 serverless(onSchedule). design §1에 트레이드오프·비용·계약 영향을 고정한다.
2. **진입점 분리**: `app/index.ts`를 gateway 부트스트랩 / 함수 부트스트랩으로 분리 — gateway는 스케줄러를 시작하지 않고, 함수는 gateway 연결을 열지 않는다(각자 필요한 것만 init).
3. **스케줄러 트리거 전환**: `BaseScheduler`의 `setTimeout` 루프 → `onSchedule`(Cloud Scheduler) 코드로 전환. 실제 발화 검증은 Phase 1.10 배포에서.
4. **dmSender REST 전환**: discord.js 클라이언트(gateway) 의존 → REST 전용. `DmPayload`/`DmSendResult` 계약 불변 유지 (1.9/1.10/2.1/2.2 공유 계약). `getDiscordReady` gateway 게이트 제거는 계약 외 내부 변경으로만.
5. **틱 완결 파이프라인**: 한 번의 스케줄 실행이 크롤→diff→알림까지 await 완결되도록 보장 (EventBus #2 내부 완결).
6. **스케줄러 크롤 경로 재설계 — `crawlAndDiff(mode)` 분리**: Redis/Firestore 읽기 우회 → 강제 크롤 → `setRecruitList` diff(Redis hash 기준) → `RECRUIT_NEW`. 사용자 요청 경로(`getRecruitList` 3-tier)는 보존(회귀 방지).

### 비기능 요구사항

- **성능**: 틱 완결 파이프라인의 순차 발송 블로킹 비용은 인지만 하고 실측은 1.10 E2E로 이월.
- **호환성**: `DmPayload`/`DmSendResult` 계약 불변. `getRecruitList` 3-tier 경로 무회귀. 인터랙션 수신 코드 무변경.
- **에러 처리**: SystemError 패턴 준수. dmSender는 providers 계층 규칙대로 throw 금지·결과 흡수 반환.

---

## 기술 스택 (프로젝트 고정)

| 항목 | 기술 |
|------|------|
| Runtime | Firebase Functions (Node.js) + gateway 상시 프로세스(Cloud Run min-instance, 배포는 1.10) |
| Language | TypeScript (strict mode) |
| Database | Firestore |
| Messaging | discord.js (gateway=인터랙션 수신 / REST=DM 발송) |
| Event System | EventBus (Singleton, 프로세스-로컬) + durable bus(Firestore 트리거, 2.1/2.2 배선) |
| Scheduler | onSchedule (Cloud Scheduler) |
| Error Handling | SystemError + errorHandler |
| Logging | SystemLogger |

---

## 구현 전략

### 접근 방식 — C안 하이브리드

```
① Gateway 프로세스 (상시·slim)          ② Serverless 함수 (scale-to-zero)
   ├─ discord.js Client (WebSocket)         ├─ onSchedule (4h) → crawlAndDiff
   ├─ onInteraction (슬래시/버튼/모달)       │    └─ RECRUIT_NEW→NOTIFICATION_SEND
   │   ← 재작성 0 (현행 유지)                │       →dmSender(REST)→NOTIFICATION_SENT
   └─ EventBus #1 (프로세스 로컬)           └─ EventBus #2 (프로세스 로컬)
              │                                        ▲
              └──────► ③ Firestore 트리거 ◄───────────┘
                       (크로스-프로세스만, 2.1/2.2에서 배선)
```

- **인터랙션은 gateway 유지** → HTTP Interactions 전환에 따르는 Ed25519 서명검증·3초 응답·cold start UX 문제를 회피(재작성 0).
- **크롤·알림은 serverless** → 크롤(Playwright, 무거움)을 온디맨드로 격리, scale-to-zero로 상시 크롤 비용 회피.
- **크로스-프로세스 이벤트는 Firestore 트리거**(DB-as-bus) — 기록 저장 방침과 정합(2.1 에러 로그가 저장=발행). 인트라-프로세스(크롤→DM)는 EventBus 그대로.

### 영향 받는 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `app/index.ts` | 수정 | 진입점 분리 (gateway / 함수 부트스트랩) |
| `crawlers/schedulers/base/BaseScheduler.ts` | 수정 | `setTimeout` 루프 격리, onSchedule 전환 |
| `crawlers/schedulers/RecruitScheduler.ts` | 수정 | `getRecruitList` → `crawlAndDiff` 경로 전환 |
| `services/recruitService.ts` (또는 신규 모듈) | 수정/신규 | `crawlAndDiff(mode)` 신설, 3-tier 경로 보존 |
| `providers/discord/utils/dmSender.ts` | 수정 | gateway → REST 전용 (계약 불변) |
| `providers/discord/client.ts` | 수정 | REST 클라이언트 분리/추가 |
| onSchedule 진입점 (신규) | 신규 | Cloud Scheduler 트리거 함수 |

> 정확한 파일 경계·신설 위치는 design 단계에서 확정.

### 의존성 분석

- **선행**: Phase 1.9(startup wiring·로컬 E2E 방식) 완료 — 본 Phase의 로컬 검증이 1.9 방식 재사용.
- **후속**: Phase 1.10(proxy + 실 CRAWL + 실배포 + 프로덕션 E2E)이 본 Phase 산출물을 전제로 배포·실발화. Phase 2.1/2.2가 durable bus(Firestore 트리거) 배선을 처음 필요로 함.

---

## 성공 기준

- [ ] §1 런타임 결정(C안)이 design §1에 트레이드오프·비용·계약 영향과 함께 고정됨
- [ ] 진입점 분리·onSchedule·dmSender REST·`crawlAndDiff`·틱 완결 파이프라인이 코드로 완성되고 정적 analyze 통과
- [ ] `DmPayload`/`DmSendResult` 계약 불변 확인
- [ ] `getRecruitList` 3-tier 경로 무회귀 확인
- [ ] 인터랙션 수신 코드 무변경 확인
- [ ] 로컬 DUMMY E2E에서 REST DM 수신 + `crawlAndDiff` diff 발행 확인
- [ ] TypeScript 컴파일 성공 (`npx tsc --noEmit`)
- [ ] 실배포·실 CRAWL·프로덕션 E2E는 범위 밖 (→ Phase 1.10)

---

## 리스크 및 고려사항

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| §1 런타임 결정이 #2·#3을 강결합 | 🔴 높음 | design §1을 CTO 승인으로 잠근 뒤 do 진입 (§1이 do 게이트) |
| EventBus 프로세스-로컬화 (C안 프로세스 분리) | 🔴 높음 | 인트라-프로세스는 EventBus 유지. 크로스-프로세스는 Firestore 트리거로 가는 방향을 design §1 계약에 명시, 실제 배선은 2.1/2.2 예약 |
| `DmPayload`/`DmSendResult` 계약 파손 | 🟡 중간 | REST 전환은 계약 외 내부 변경으로만. analyze Contract 차원 필수 검증. 소비자(NotificationSendHandler, 2.1/2.2) 회귀 점검 |
| `crawlAndDiff` 신설 시 `getRecruitList` 회귀 | 🟡 중간 | 두 경로가 `setRecruitList`(Redis hash diff) 공유 — 사용자 경로 보존, diff 정합성 유지 |
| onSchedule 실발화·REST 실전송·서명 무관 실 CRAWL 미검증 | 🟡 중간 | 1.13은 코드+정적/로컬 한정. 실발화 검증은 1.10 배포로 이월(감수된 스코프), report에 명시 |
| gateway 상시 프로세스 비용·인프라(Cloud Run) | 🟡 중간 | slim 프로세스(인터랙션 수신 전용). 실배포·인프라 프로비저닝은 1.10 |

---

## 위임 계획 (CTO Lead 승인 완료)

| 영역 | 위임 대상 | 근거 | 예상 산출물 |
|------|----------|------|-------------|
| §1 런타임 결정(C안) + #0 진입점 분리 + #2 onSchedule + #4 파이프라인 + #5 crawlAndDiff | **Integration Lead** (primary, design.md 작성) | provider orchestration + 런타임이 스케줄러·dmSender 양쪽 계약 지배 | design §1 고정안 + onSchedule/진입점/crawlAndDiff 코드 |
| #3 dmSender REST 전환 | **Discord Agent** (co-author, REST 섹션) | discord.js REST 도메인, "DM 발송" 트리거 | REST 전용 `sendNotificationDM` (계약 불변) |
| #5 Redis hash diff 정합성 | **Backend Expert** (Integration Lead가 위임) | 데이터 계층 diff 엔진 정합 | hash 생성·비교 정합성 확보 |

**design.md 작성**: Integration Lead(primary) + Discord Agent(co-author, dmSender REST 섹션).

---

*작성일: 2026-08-04*
*시드: .claude/phases/phase-1-core.md*
