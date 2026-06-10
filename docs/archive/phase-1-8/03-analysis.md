# Phase 1.8 갭 분석: Discord DM 발송 유틸리티

**상태**: 🔍 검토 중
**분석일**: 2026-06-10
**설계서**: `docs/phase-1-8/02-design.md` (rate limit ms 정정 완료본)

---

## 1. 갭 분석 (Gap Detector)

설계 ↔ 구현 7파일. 확정 결정(I-2 rate limit ms / I-3 타입 변경 없음 / I-4 상위 3개+외 N건)은 의도된 설계로 간주하여 일치 판정.

### 1.1 Structural (가중치 0.2)

| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| S1 | §2.1 `dmSender.ts` 신규 — `sendNotificationDM`+`DmPayload`+`DmSendResult` export | 3개 export 존재 | ✅ | `providers/discord/utils/dmSender.ts` |
| S2 | §2.3 `jobLink.ts` 신규 — `extractJobId`+`formatJobTitleLink` | 2개 export 존재 | ✅ | `builder/embeds/jobLink.ts` |
| S3 | §2.2 `notificationMessageEmbed.ts` 신규 | 존재 | ✅ | `builder/embeds/notificationMessageEmbed.ts` |
| S4 | §2.4 `recruitMessageEmbed.ts` — private `extractJobId` 제거, 헬퍼 import | private 제거 + `formatJobTitleLink` import | ✅ | `builder/embeds/recruitMessageEmbed.ts` |
| S5 | §2.5 `NotificationSendHandler.ts` 신규 — `registerNotificationSendHandlers()` | 존재 | ✅ | `events/bus/handlers/NotificationSendHandler.ts` |
| S6 | §2.6 `registerEventHandlers.ts` — 등록 호출 1줄 | line 55 등록 + import 추가 | ✅ | `events/bus/utils/registerEventHandlers.ts` |
| S7 | §5.1 `providers/CLAUDE.md` 드리프트 정정 | embeds 기반+`providerLogger`로 정정 | ✅ | `providers/CLAUDE.md` |
| S8 | §1.1/§3.2 types.ts 변경 없음 (신규 이벤트 타입 금지) | 기존 타입 그대로, 신규 0건 | ✅ | `events/bus/types.ts` |

### 1.2 Functional (가중치 0.4)

| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| F1 | §2.1 재시도 최대 3회 | `MAX_ATTEMPTS=3`, `while(attempts<3)` | ✅ | dmSender.ts |
| F2 | §2.1 50007 → graceful skip + `warn` | `skipped:true,reason:"dm_disabled"`+`.warn` 즉시 return | ✅ | dmSender.ts |
| F3 | §2.1 10013 → 실패 + `error` | `reason:"unknown_user"`+`.error` 즉시 return | ✅ | dmSender.ts |
| F4 | §2.1 rate limit ms 대기 (`*1000` 금지) | `getRateLimitWaitMs`→ms 그대로 `sleep`, `*1000` 없음 | ✅ | dmSender.ts |
| F5 | §2.1 rate limit 감지 — RateLimitError(code 없음)→retryAfter/timeToReset→status/name fallback | ms 추출 후 `status===429\|\|name` fallback(1000ms) | ✅ | dmSender.ts |
| F6 | §2.1 default 미지 코드 → 선형 backoff 재시도 | `sleep(BASE_BACKOFF_MS*attempts)` | ✅ | dmSender.ts |
| F7 | §2.1/§5 providerLogger info/warn/error, console.log 0건 | 매핑 정확, console 0건 | ✅ | dmSender.ts |
| F8 | §2.5 NOTIFICATION_SEND 소비→임베드→DM→NOTIFICATION_SENT 발행 | `onEvent`→빌드→`sendNotificationDM`→`emitEvent` | ✅ | NotificationSendHandler.ts |
| F9 | §2.2/§2.5 빈 배열 방어 | `if(jobs.length===0) return;` | ✅ | NotificationSendHandler.ts |
| F10 | §2.5 1.7 패턴 대칭 — try-catch+재throw 금지, `globalLogger` | 재throw 없음 | ✅ | NotificationSendHandler.ts |
| F11 | §2.4 recruitMessageEmbed 동작 동일 (순수 추출) | 링크만 헬퍼 교체, 출력 로직 동일 | ✅ | recruitMessageEmbed.ts |
| F12 | §2.2 상위 3개+외 N건 (I-4) | `slice(0,3)`+`length>=6` 시 "외 N건" | ✅ | notificationMessageEmbed.ts |
| F13 | §2.5 NOTIFICATION_SENT.success — skip도 false | `success:result.ok` | ✅ | NotificationSendHandler.ts |

### 1.3 Contract (가중치 0.4)

| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| C1 | §2.1 ⭐ `sendNotificationDM(userId, {embeds?,content?}): Promise<DmSendResult>` 포맷 무관 고정 | 시그니처 정확 일치, title/recruits 미박힘 | ✅ | dmSender.ts |
| C2 | §2.1 `DmPayload` 형태 | 동일 | ✅ | dmSender.ts |
| C3 | §2.1 `DmSendResult` 6필드 | 동일 | ✅ | dmSender.ts |
| C4 | §3.2 NotificationSentEvent 기존 타입 유지 (I-3) | types.ts 그대로 | ✅ | types.ts |
| C5 | §3.2 NOTIFICATION_SENT 페이로드 매핑 | timestamp/source/userId/jobCount/success/error? 준수 | ✅ | NotificationSendHandler.ts |
| C6 | §2.5 skip은 success=false + error 미부여 (I-3) | 조건부 spread로 skip 시 error 미부여 | ✅ | NotificationSendHandler.ts |
| C7 | §2.2 `notificationMessageEmbed(jobs): APIEmbed` | 동일, `Job.value` 사용 | ✅ | notificationMessageEmbed.ts |
| C8 | §2.3 `extractJobId`/`formatJobTitleLink` 시그니처 | 동일 | ✅ | jobLink.ts |
| C9 | §1.1 providers → services/features 참조 금지 | 위반 없음 | ✅ | dmSender.ts |
| C10 | §2.6 1.9 경계 — startup 호출·client.login 미추가 | 등록만, startup/login 코드 없음 | ✅ | registerEventHandlers.ts |
| C11 | §2.1 client 싱글톤 직접 import | `@/providers/discord/client` | ✅ | dmSender.ts |

---

## 2. 매치율 산출

| 카테고리 | 일치/전체 | 점수 |
|----------|----------|------|
| Structural (×0.2) | 8/8 | 100% |
| Functional (×0.4) | 13/13 | 100% |
| Contract (×0.4) | 11/11 | 100% |
| **종합 매치율** | **32/32** | **100%** |

### 산출 공식
```
종합 매치율 = Structural × 0.2 + Functional × 0.4 + Contract × 0.4
            = 100 × 0.2 + 100 × 0.4 + 100 × 0.4 = 100.0%
```

---

## 3. 갭 목록

### 3.1 미구현 항목

| # | 카테고리 | 설계 섹션 | 갭 내용 | 우선순위 |
|---|----------|----------|--------|---------|
| — | — | — | **갭 없음 (32/32 완전일치)** | — |

🔴 Critical 갭: **0건**

### 3.2 설계 차이

| # | 설계 내용 | 실제 구현 | 판단 |
|---|----------|----------|------|
| 1 | §2.1 pseudo-code에 fallback 상수 없음 | `FALLBACK_RATE_LIMIT_MS=1000`(ms) 추가 | 허용 — 설계 본문 "fallback 순으로 감지" 의도와 정합, ms 단위라 버그 아님 |

---

## 4. 코드 품질 분석 (Code Analyzer)

### 4.1 이슈 목록

| # | 심각도 | 카테고리 | 파일:라인 | 이슈 내용 | 제안 |
|---|--------|----------|----------|----------|------|
| 1 | 🟡 | DRY | `notificationMessageEmbed.ts` ↔ `recruitMessageEmbed.ts` | 공고 1줄 렌더링 포맷(번호+날짜/D-Day/상태)이 두 임베드에 잔존 중복(링크는 jobLink로 통합됨) | 입력 타입(`Job` vs `RecruitData`)·출력 포맷 차이로 **강제 통합 비권장** — Info 수준 |
| 2 | 🟡 | 품질 | `recruitMessageEmbed.ts:28-31` | 필드 value 템플릿 리터럴에 선행 공백·개행 잔존 (기존 코드) | 1.8 범위 밖 기존 결함, 회귀 위험 시 별도 처리 |
| 3 | 🟢 | 품질 | `dmSender.ts:59-62` | `getErrorCode` unknown 캐스팅 (strict 안전) | `DiscordAPIError` instanceof 분기 고려 — 변경 불필요 |
| 4 | 🟢 | 품질 | `dmSender.ts:114-186` | 분기별 `Date.now()-startedAt`/return 객체 boilerplate | 각 분기 의도 명확 — 유지 권장 |
| 5 | 🟢 | 컨벤션 | `registerEventHandlers.ts` (기존부) | 기존 `as any`·이모지 로그 잔존 (1.8 신규 라인은 깨끗) | 본 Phase 범위 밖 |

### 4.2 컨벤션 준수

| 항목 | 상태 | 비고 |
|------|------|------|
| SystemLogger 사용 (console.log 금지) | ✅ | dmSender providerLogger, 핸들러 globalLogger. console 0건 |
| LogSource 타입 제약 (provider) | ✅ | providerLogger 프리셋 |
| 네이밍 규칙 (camel/Pascal/UPPER_SNAKE) | ✅ | 일관 |
| JSDoc (public API) | ✅ | 전 public 함수 한국어 JSDoc |
| import 정리 | ✅ | external→@/internal→relative→type 순 |
| 계층 규칙 (providers→services/features 금지) | ✅ | 위반 없음 |
| 타입 안전성 (strict) | ✅ | 통과 |
| EventBus 패턴 (제네릭·루프 없음) | ✅ | onEvent/emitEvent 제네릭, 다른 이벤트 발행으로 루프 없음 |

### 4.3 요약

- 🔴 Critical: **0건**
- 🟡 Warning: **2건** (둘 다 기존 코드 영역 잔여 중복/포맷, 강제 통합 시 회귀 위험 → Info 준함)
- 🟢 Info: **3건**

---

## 5. 다음 단계 분기

✅ **매치율 100% (≥ 90%) AND 🔴 Critical 0건** → `/pdca report 1.8` 진행 가능

- CTO Lead 게이트: 매치율 ≥ 90% AND Critical 0건 → **호출 생략** (skill 규칙, 비용 절감)
- 런타임 검증: 실제 DM 전송 E2E는 §6.1대로 **1.9 startup wiring 이월** (`dm-e2e-test-phase-sequence` 메모리 경계) → 본 analyze는 **정적 매치율로 종결**
- archive 트리거 조건(매치율 ≥ 90%) 충족

---

*분석일: 2026-06-10*
*참고: docs/phase-1-8/02-design.md*
