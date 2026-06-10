# Phase 1.8: Discord DM 발송 유틸리티

**상태**: 🔄 진행 중
**우선순위**: ⭐⭐⭐ (P0)
**의존성**: 없음 (`NOTIFICATION_SEND` 이벤트 계약은 1.7에서 정의 완료)

---

## 개요

### 배경
Phase 1.7의 `NotificationService.notifyNewRecruits()`는 매칭된 구독자별로
`NOTIFICATION_SEND` 이벤트(`{ userId, jobs: Job[], settings }`)를 발행하는 데서
멈췄다(= 의도된 이벤트 경계). **현재 이 이벤트를 소비하는 핸들러가 없어 DM이
실제로 전송되지 않는다.** 1.7 설계 주석과 메모리(`dm-e2e-test-phase-sequence`)는
"실제 DM 발송 = 1.8, startup wiring = 1.9"로 경계를 명시했다.

> **병목 노드(Bottleneck Node) 인식 — CTO Lead 게이트 반영.**
> 1.8은 후속 4개 Phase(1.9·1.10·2.1·2.2)가 모두 의존하는 노드다. 특히 2.1(에러
> 리포트)·2.2(관리자 공지)는 **관리자 DM에 `sendNotificationDM`을 재사용**한다.
> 따라서 이번에 정의하는 **`sendNotificationDM` 시그니처가 4개 후속 Phase의 계약**이
> 된다 → 단순 동작보다 **인터페이스(시그니처) 안정성이 최우선**이며, design 단계의
> 1순위 안건은 "시그니처 고정"이다.

### 목표
`NOTIFICATION_SEND` → **실제 Discord DM 전송**까지 연결한다.
- 포맷 무관 DM 전송기(`sendNotificationDM`) 구현 — 재시도·rate limit·에러 처리 포함.
- `NOTIFICATION_SEND` 소비 핸들러로 임베드 빌드 → DM 전송 → `NOTIFICATION_SENT` 발행.
- 핸들러 등록 연결(`registerEventHandlers`)까지. **startup 호출·client 로그인은 1.9 위임.**

### 범위

| 포함 | 제외 |
|------|------|
| `dmSender.ts` (전송 + 재시도 + 429 대기 + DM차단 처리) | client 로그인 / `registerAllEventHandlers()` startup 호출 (→ 1.9) |
| `NOTIFICATION_SEND` 소비 핸들러 + `NOTIFICATION_SENT` 발행 | 런타임 E2E 검증 (→ 1.9 통합) |
| 알림 전용 임베드 빌더 + jobLink 공용 헬퍼(DRY) | 교차 사용자 throttle/중앙 큐 (대규모 구독자 시 재검토) |
| `registerEventHandlers`에 등록 연결 1줄 | 신규 이벤트 타입 정의 (기존 타입 재사용) |
| `providers/CLAUDE.md` dmSender 예시 드리프트 정정 (§문서 정합성) | 부하/비용 실측 (→ 1.9 E2E 이월) |

---

## 요구사항

### 기능 요구사항
1. **`sendNotificationDM(userId, { embeds?, content? })`** — 기존 `client` 싱글톤으로
   `users.fetch` → `user.send`. **완성된 `embeds`를 받아 보내는 포맷 무관 전송기**
   (포맷을 시그니처에 박지 않음 — 후속 Phase 재사용 계약).
2. **재시도/Rate Limit** — 최대 3회. 429는 `retry_after` 대기 후 재시도, 일시적 오류는
   짧은 backoff. 구독자 간 간격은 discord.js v14 REST 내장 큐에 위임.
3. **에러 처리** — 50007(DM 차단/공유 길드 없음)은 재시도 없이 graceful skip,
   10013(Unknown User)은 재시도 없이 실패. 결과를 `DmSendResult`로 반환.
4. **발송 로그** — `providerLogger`(LogSource `provider`)로 성공(userId/소요 시간)·
   skip·실패 사유 기록. **`console.log` 금지(1.11 컨벤션).**
5. **알림 임베드 빌더** — `notificationMessageEmbed(jobs)` ("🔔 새로운 채용 공고").
6. **소비 핸들러** — `NOTIFICATION_SEND` 구독 → 임베드 빌드 → DM 전송 → `NOTIFICATION_SENT` 발행.

### 비기능 요구사항
- **인터페이스 안정성(최우선)**: `sendNotificationDM` 시그니처는 1.9/1.10/2.1/2.2의 계약 →
  embeds 기반 포맷 무관 형태로 design에서 먼저 고정.
- **성능/비용**: 핸들러는 emitter 안정성을 위해 내부 try-catch(재throw 금지).
  순차 발송 시 `setTimeout` 블로킹이 함수 실행시간·비용에 영향 → §리스크 명시, 실측 1.9 이월.
- **호환성**: 기존 `recruitMessageEmbed` 동작 동일 유지(헬퍼 추출 리팩터링만).
- **에러 처리**: providers 계층은 graceful degradation, 조율은 events 계층 핸들러가 담당.

---

## 기술 스택 (프로젝트 고정)

| 항목 | 기술 |
|------|------|
| Runtime | Firebase Functions (Node.js) |
| Language | TypeScript (strict mode) |
| Messaging | discord.js 14.x |
| Event System | EventBus (Singleton) |
| Logging | SystemLogger (`providerLogger`, LogSource `provider`) |

---

## 구현 전략

### 접근 방식
**전송기 1개 / 포맷 N개** 분리. `sendNotificationDM`은 완성된 `embeds`만 받아 전송·재시도·에러
처리에 집중하고, 용도별 임베드 빌더를 따로 둔다. 향후 proxyError(1.10)·broadcast(2.2)·
관리자 에러(2.1) DM은 빌더만 추가하면 같은 전송기로 발송된다.
소비 핸들러는 1.7 `NotificationEventHandler` 패턴(내부 try-catch + `registerXHandlers`)과 대칭.

### 영향 받는 파일
| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `providers/discord/utils/dmSender.ts` | 신규 | `sendNotificationDM` — 전송·재시도·429대기·에러처리, `DmSendResult` 반환 |
| `providers/discord/builder/embeds/notificationMessageEmbed.ts` | 신규 | `notificationMessageEmbed(jobs)` 알림 포맷 |
| `providers/discord/builder/embeds/jobLink.ts` | 신규 | `extractJobId` / `formatJobTitleLink` 공용 헬퍼 (DRY 추출) |
| `events/bus/handlers/NotificationSendHandler.ts` | 신규 | `registerNotificationSendHandlers()` — `NOTIFICATION_SEND` 소비 → DM → `NOTIFICATION_SENT` |
| `events/bus/utils/registerEventHandlers.ts` | 수정 | 등록 호출 1줄 추가 (startup 호출은 1.9 유지) |
| `providers/discord/builder/embeds/recruitMessageEmbed.ts` | 수정 | private `extractJobId` 제거 → `jobLink.ts` 헬퍼 사용 |
| `functions/src/providers/CLAUDE.md` | 수정 | dmSender 예시 드리프트 정정 (§문서 정합성) |

### 의존성 분석
- **재사용**: `NotificationSendEvent`/`NotificationSentEvent`(types.ts), `client`(client.ts),
  `providerLogger`(systemLogger), `recruitMessageEmbed` 링크 로직.
- **계층 규칙**: dmSender(providers) → services/features 참조 금지. 조율은 events 핸들러.
- **후속 의존(계약 소비자)**: 1.9(startup wiring + 스케줄러 재활성화), 1.10(proxyError DM),
  2.1(관리자 에러 DM), 2.2(broadcast DM) — **모두 `sendNotificationDM` 시그니처 재사용**.

### 문서 정합성 (CTO Lead 지적 #2 — 드리프트 정정)
`functions/src/providers/CLAUDE.md`의 dmSender 예시가 확정 결정과 **모순**되어 정정 대상:
- 예시 시그니처가 `sendNotificationDM(userId, { title, recruits, ... })` — **포맷이 시그니처에 박혀 있음**
  → 확정 결정(포맷 무관 `{ embeds }`)과 충돌. 예시를 embeds 기반으로 교체.
- 예시가 `console.log` 사용 → 1.11 컨벤션 위반. `providerLogger`로 교체.
- 정정 시점: do 단계에서 코드와 함께 갱신(코드-문서 동시 수정 원칙).

---

## 위임 계획 (CTO Lead 게이트 반영)

> CTO Lead 위임안 채택. 주 1(Discord Agent) + 보조 1(Integration Lead)로 압축.
> 근거: `sendNotificationDM`이 4개 후속 Phase 계약이므로 인터페이스 안정성 우선 →
> 도메인 전담 에이전트 분리가 방어적. 접점은 `sendNotificationDM` 시그니처 1개뿐이라
> design에서 이를 먼저 고정하면 두 영역 병렬 작업 가능.

| 영역 | 위임 대상 | 근거 | 예상 산출물 |
|------|----------|------|-------------|
| `dmSender.ts` 전송 유틸 (rate limit·429·50007·재시도) | **Discord Agent** | discord.js 14 REST/DMChannel·에러코드·rate limit 도메인, `providers/discord/**` | 포맷 무관 전송기 + 발송 로그(providerLogger) |
| 알림 전용 임베드 빌더 + jobLink 헬퍼 | **Discord Agent** | EmbedBuilder 도메인, 전송기와 동일 에이전트가 포맷 작성 | `Job[]→APIEmbed` 빌더, 공용 링크 헬퍼 |
| `NOTIFICATION_SEND` 소비 핸들러 + `NOTIFICATION_SENT` 발행 | **Integration Lead** | 이벤트 핸들러 = services↔providers 조율 계층, 1.7 try-catch/재throw 금지 패턴 유지 | 신규 핸들러 + 등록 함수 |
| 등록 연결 검증 (1.9 startup 경계 유지) | **Integration Lead** | EventBus 배선, 1.9 경계 침범 방지 게이트 | 연결 확인 (startup 호출 금지) |

> **병렬화 전제**: design에서 `sendNotificationDM` 시그니처 고정 → Discord/Integration 영역 동시 진행.

---

## 성공 기준

- [ ] `sendNotificationDM` 시그니처가 embeds 기반 포맷 무관으로 고정 (후속 4개 Phase 계약)
- [ ] `sendNotificationDM` 구현 (재시도 3회 + 429 `retry_after` 대기 + 50007/10013 처리)
- [ ] `notificationMessageEmbed` + `jobLink` 헬퍼 (recruitMessageEmbed 동작 동일 유지)
- [ ] `NOTIFICATION_SEND` 핸들러가 DM 전송 후 `NOTIFICATION_SENT` 발행
- [ ] `registerEventHandlers`에 등록 연결 (startup 호출은 1.9)
- [ ] `providers/CLAUDE.md` dmSender 예시 드리프트 정정 (embeds + providerLogger)
- [ ] TypeScript 컴파일 성공 (baseline 외 새 에러 0건)
- [ ] 기존 기능(`recruitMessageEmbed`) 정상 동작 확인

---

## 리스크 및 고려사항 (CTO Lead 게이트 반영)

| # | 리스크 | 영향도 | 대응 방안 |
|---|--------|--------|----------|
| 1 | `sendNotificationDM` 시그니처가 2.1/2.2까지 4개 Phase 계약 → 오설계 시 광범위 재작업 | 🟡 중 | design 1순위로 시그니처 고정(embeds 기반). `providers/CLAUDE.md` 모순 정정 |
| 2 | startup 미배선 → 정적 analyze만 가능, 실제 DM 전송 검증 불가 (1.9 병목) | 🟡 중 | analyze는 정적 매치율로 종결, 런타임 검증 1.9 명시 이월(`dm-e2e-test-phase-sequence`) |
| 3 | 순차 발송 시 `setTimeout` 블로킹이 함수 실행시간·비용에 영향 | 🟢 저 | DM 단위 재시도 결정 유지, 부하 한계를 design §리스크 명시 + 실측 1.9 E2E 이월 |
| 4 | 컨벤션 위반(console.log/LogSource) — `providers/CLAUDE.md` 예시가 console.log 사용 중 | 🟢 저 | 위임 시 providerLogger 명시, analyze에서 Code Analyzer가 검출 |
| 5 | 헬퍼 추출로 recruitMessageEmbed 동작 변경 | 🟢 저 | 순수 추출(동작 동일 보장), 컴파일 + 시각 확인 |

---

*작성일: 2026-06-09*
*시드: .claude/phases/phase-1-core.md*
*게이트: CTO Lead plan 위임안 반영 (시그니처 계약 격상 / 문서 드리프트 정정 / 2-에이전트 위임 / 부하 리스크 명시)*
