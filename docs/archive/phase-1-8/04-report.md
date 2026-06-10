# Phase 1.8 완료 보고서: Discord DM 발송 유틸리티

**상태**: 🔍 검토 중
**작성일**: 2026-06-10
**PDCA 사이클**: plan → design → do → analyze → report

---

## 1. 요약

### 1.1 개요
| 항목 | 내용 |
|------|------|
| 기능명 | Discord DM 발송 유틸리티 |
| Phase | 1.8 |
| 시작일 | 2026-06-09 |
| 완료일 | 2026-06-10 |
| 최종 매치율 | 100% |
| 반복 횟수 | 1회 (갭 0건, iterate 없음) |

### 1.2 목표 달성

| 목표 | 달성 | 비고 |
|------|------|------|
| `sendNotificationDM` 시그니처 포맷 무관 고정 (후속 4개 Phase 계약) | ✅ | `sendNotificationDM(userId, {embeds?,content?}): Promise<DmSendResult>` |
| `sendNotificationDM` 구현 (재시도 3회 + 429 ms 대기 + 50007/10013 처리) | ✅ | 에러 코드별 분기 로직 완성 |
| `notificationMessageEmbed` + `jobLink` 헬퍼 | ✅ | 공고 포맷 통합, 링크 DRY 추출 |
| `NOTIFICATION_SEND` 핸들러 → DM → `NOTIFICATION_SENT` 발행 | ✅ | EventBus 패턴 1.7 대칭 |
| `registerEventHandlers` 등록 연결 (startup 호출은 1.9) | ✅ | 1.9 경계 준수 |
| `providers/CLAUDE.md` 드리프트 정정 | ✅ | embeds 기반 + `providerLogger` |
| TypeScript 컴파일 성공 (baseline 외 새 에러 0건) | ✅ | tsc 통과 |
| 기존 기능(recruitMessageEmbed) 정상 동작 | ✅ | 순수 추출, 출력 동일 |

---

## 2. 구현 요약

### 2.1 주요 변경사항

1. **`sendNotificationDM` 전송기** — Discord API rate limit·에러 처리 통합
   - 최대 3회 재시도, rate limit은 **ms 단위 대기**(`*1000` 보정 없음)
   - 50007(DM 차단) graceful skip, 10013(Unknown User) 실패, default 미지 코드 재시도 후 실패
   - 결과를 `DmSendResult`로 반환(성공/skip/실패 구분), throw 없이 흡수(graceful degradation)
   - `providerLogger` 성공(info)/skip(warn)/실패(error) 기록

2. **임베드 빌더 통합** — 알림 전용 및 공용 헬퍼
   - `notificationMessageEmbed(jobs)`: "🔔 새로운 채용 공고", **상위 3개 + 외 N건**
   - `jobLink.ts`: `extractJobId`/`formatJobTitleLink` 공용 헬퍼 (recruitMessageEmbed 동일 동작 유지)

3. **이벤트 핸들러** — NOTIFICATION_SEND 소비 → DM → NOTIFICATION_SENT 발행
   - 1.7 try-catch/재throw 금지 패턴 대칭, `globalLogger`

4. **등록 연결** — `registerEventHandlers`에 1줄 추가
   - startup 호출·client 로그인은 1.9 위임 (경계 준수)

### 2.2 파일 변경 목록

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `providers/discord/utils/dmSender.ts` | 신규 | `sendNotificationDM` + `DmSendResult`/`DmPayload` |
| `providers/discord/builder/embeds/notificationMessageEmbed.ts` | 신규 | 알림 전용 임베드 빌더 |
| `providers/discord/builder/embeds/jobLink.ts` | 신규 | 링크 추출/포맷 공용 헬퍼 |
| `providers/discord/builder/embeds/recruitMessageEmbed.ts` | 수정 | private `extractJobId` 제거 → `jobLink` import |
| `events/bus/handlers/NotificationSendHandler.ts` | 신규 | NOTIFICATION_SEND 소비 핸들러 |
| `events/bus/utils/registerEventHandlers.ts` | 수정 | 핸들러 등록 1줄 추가 |
| `providers/CLAUDE.md` | 수정 | dmSender 예시 드리프트 정정 |

**총 산출물**: 7파일 (신규 5 + 수정 2)

---

## 3. 갭 분석 이력

### 3.1 분석 결과 요약

| 분석 회차 | 매치율 | 갭 수 | Critical | 조치 |
|----------|--------|-------|---------|------|
| 1차 (최종) | 100% | 0건 | 0건 | report 진행 |

**상세 매치율**: Structural 8/8(100%) · Functional 13/13(100%) · Contract 11/11(100%)

### 3.2 코드 품질 (Code Analyzer)

| 심각도 | 개수 | 내용 |
|--------|------|------|
| 🔴 Critical | 0건 | — |
| 🟡 Warning | 2건 | W1: notificationMessageEmbed ↔ recruitMessageEmbed 필드 포맷 잔여 중복(강제 통합 비권장); W2: recruitMessageEmbed 필드라인 들여쓰기(기존 코드, 1.8 범위 밖) |
| 🟢 Info | 3건 | 관찰 용도 |

**핵심 확정 사항** (의도된 설계):
- **I-2**: rate limit 단위 = ms (discord.js 14.17.3 타입 정의 직접 검증, design pseudo-code `*1000` 버그 발견 → design.md 정정). RateLimitError는 `code` 없음 → `getRateLimitWaitMs` fallback.
- **I-3**: `NotificationSentEvent` 타입 변경 없음 (skip은 success=false + error 미부여, 관측은 `providerLogger.warn` — 이벤트 계약 보존, YAGNI)
- **I-4**: 상위 3개 + 외 N건 (notificationMessageEmbed)
- 에러 분류: `error.code` switch (50007 skip→warn / 10013 실패→error / rate limit 재시도 / default 미지 코드 재시도 후 error)

---

## 4. 검토 사항

**참고 문서**: [review-process.md](../../.claude/rules/review-process.md)

> ⚠️ 피드백 수신 시 즉시 반영하지 않음 → 수정 계획 제시 → 사용자 승인 → 진행

### 4.1 코드 리뷰
- [x] 핵심 로직 구현 확인 (설계 §2.1~§2.6 모두 일치)
- [x] 타입 안전성 확인 (tsc 통과, strict 준수)
- [x] 에러 처리 확인 (50007/10013/rate limit/미지 코드 분기)

### 4.2 기능 테스트
- [x] TypeScript 컴파일 성공 (baseline 외 새 에러 0건)
- [x] 기존 기능 정상 동작 (recruitMessageEmbed 순수 추출, 출력 동일)
- [ ] **실제 DM 전송 E2E** ← **1.9 startup wiring 이월** (메모리: `dm-e2e-test-phase-sequence`, `phase-1-8-deferred-to-1-9`)

### 4.3 문서화
- [x] JSDoc 주석 확인 (모든 public 함수 한국어 주석)
- [x] 관련 문서 업데이트 (`providers/CLAUDE.md` 드리프트 정정, `02-design.md` rate limit 단위 정정)

---

## 5. 피드백 반영 내역

<!-- 리뷰 대기 중 — 피드백 수신 시 기록 -->

---

## 6. Process Improvement

### 6.1 잘된 점
- **시그니처 우선 고정**: 후속 4개 Phase 계약을 design 단계에서 선언 → Discord/Integration 병렬 작업 전제 확보
- **do 단계 실타입 검증이 설계 버그 발견**: I-2에서 discord.js 14.17.3 타입 확인으로 design pseudo-code의 ms/초 단위 버그를 조기 교정
- **경계 준수**: 1.9 startup/client.login 미추가로 단계별 책임 분명, 런타임 E2E 명시적 이월(메모리 기록)

### 6.2 개선할 점
- **Warning 잔여**: W1(필드 포맷 중복)은 입력 타입(`Job` vs `RecruitData`) 차이로 강제 통합 비권장 → 차기 리팩터링 시 타입 추상화 검토. W2(들여쓰기)는 기존 코드라 회귀 위험으로 1.8에서 미수정.

### 6.3 다음 Phase 제안 / 이월 사항

| 제안 | 관련 Phase | 우선순위 | 상태 |
|------|-----------|---------|------|
| 런타임 E2E (실제 DM 전송·50007 skip·rate limit 검증) | 1.9 | P0 | 메모리 `phase-1-8-deferred-to-1-9` 기록 |
| Warning W1/W2 (필드 포맷 DRY·들여쓰기) | 1.9 또는 차기 리팩터링 | P2 | 강제 통합 회피(회귀 위험), recruitMessageEmbed 수정 시 동반 정리 |

---

## 7. 다음 단계

1. [ ] 사용자 피드백 확인 및 승인
2. [ ] `/pdca archive 1.8` 실행 (문서 아카이브)
3. [ ] `/pdca cleanup` 실행 (status JSON 정리 + memory 초기화)
4. [ ] Git 커밋(논리 단위) + push + PR 생성 (base dev) — archive/cleanup 변경 포함
5. [ ] PR 머지 → dev 동기화 → `/pdca next`

---

*작성일: 2026-06-10*
*참고: 01-plan.md, 02-design.md, 03-analysis.md*
*메모리: `dm-e2e-test-phase-sequence` (1.9 E2E 경계), `phase-1-8-deferred-to-1-9` (후속 작업 추적)*
