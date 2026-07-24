# Phase 1.9 완료 보고서: 알림 파이프라인 startup wiring + 로컬 E2E

**상태**: ✅ 완료 (사용자 승인 2026-07-24)
**작성일**: 2026-07-24
**PDCA 사이클**: plan → design → do → analyze → iterate(#1) → report

---

## 1. 요약

### 1.1 개요
| 항목 | 내용 |
|------|------|
| 기능명 | 알림 파이프라인 startup wiring + 로컬 E2E |
| Phase | 1.9 |
| 시작일 | 2026-06-11 |
| 완료일 | 2026-07-24 |
| 최종 매치율 | 100% |
| 반복 횟수 | 1 (임베드 UX iterate) |

### 1.2 목표 달성

| 목표 | 달성 | 비고 |
|------|------|------|
| 핸들러 등록 startup 연결 (`registerAllEventHandlers`) | ✅ | `app/index.ts` eager `.then` 체인 |
| 스케줄러 로컬 활성화(DUMMY) + graceful shutdown | ✅ | `enableProxy:false`로 Recruit만 (Proxy→1.10) |
| Discord ready 게이트 (HTTP 비결합, dmSender 발송 직전 C안) | ✅ | leaf `discordReady.ts` + `await getDiscordReady()` |
| env 표준화 `SARIAN_*`→`DISCORD_*` | ✅ | 코드 3곳 + .env 4키, 잔여 0 |
| 로컬 DUMMY E2E: 크롤→RECRUIT_NEW→구독자 알림→실 DM | ✅ | 0단계 R1~R3 PASS (실 DM 수신) |
| (iterate) 알림 임베드 UX 개편 | ✅ | §7 스펙 11/11, 실 DM 렌더 확인 |

---

## 2. 구현 요약

### 2.1 주요 변경사항

**A. Startup wiring (plan/design 본체)**
1. `app/index.ts` eager 블록에 `initializeProviders().then(register → scheduler → shutdown).catch(log)` 체인 연결 — provider init 성공 후 EventBus 리스너 등록·스케줄러 시작, 실패는 로그만(HTTP 비결합).
2. **ready 게이트 R3 순환 차단**: 의존 0 leaf `providers/discord/discordReady.ts` 신설(`getDiscordReady`/`markDiscordReady`), `events` 배열을 `events/discordListeners.ts`로 분리(루트 분리). `initDiscordBot` async 전환(login try/catch, 항상 resolve).
3. dmSender 발송 직전 `await getDiscordReady()` 1회 게이트(C안) — ClientReady 전 fetch로 인한 DM 유실(max_retries) 해소.
4. `initializeSchedulers`에 `enableProxy?:boolean`(기본 true, 하위호환) 추가 → 1.9는 `false`로 Recruit만.
5. env rename `SARIAN_*`→`DISCORD_*`.

**B. 알림 임베드 UX 개편 (iterate #1 — §7)**
6. `notificationMessageEmbed(jobs, settings)` 개편: 헤더 제거, description 상위 3건 블록(제목링크/📅날짜/⏳D-day·🏷️상태), 오버플로 `▸ … [전체 공고 …](baseUrl)`(임계 6→3 초과), SELECTED+오버플로 시 안내문 2줄을 description 하단에(footer 개행 미지원).
7. `notificationBannerContent(jobs, settings)` 신규 — 푸시 배너용 2줄 평문(`📢 지역·건수` / `▽ 안내`, 개행이 배너에 유지됨).
8. `NotificationSendHandler`가 `content`+`embeds`를 함께 발송, `settings`(지역/모드) 연동.

### 2.2 파일 변경 목록
| 파일 | 변경 유형 | 비고 |
|------|----------|------|
| `providers/discord/discordReady.ts` | 신규 | ready 채널 leaf(의존 0) |
| `events/discordListeners.ts` | 신규 | `events` 배열 이관(루트 분리) |
| `app/index.ts` | 수정 | eager `.then` 체인 |
| `providers/discord/initDiscordBot.ts` | 수정 | async + markDiscordReady + env |
| `providers/discord/register-commands.ts` | 수정 | env rename |
| `providers/discord/utils/dmSender.ts` | 수정 | 발송 직전 ready 게이트 |
| `crawlers/schedulers/utils/initializeSchedulers.ts` | 수정 | `enableProxy` 게이팅 |
| `common/middlewares/initializeWorker.ts` | 수정 | 주석 정리 |
| `events/index.ts` | 수정 | `events` 재노출 |
| `functions/.env` | 수정 | `DISCORD_*` 4키 (미커밋) |
| `providers/discord/builder/embeds/notificationMessageEmbed.ts` | 수정(iterate) | §7 임베드 개편 + 배너 content 빌더 |
| `events/bus/handlers/NotificationSendHandler.ts` | 수정(iterate) | content+settings 연동 |

**검증**: `npx tsc --noEmit` exit 0, `npm run build` exit 0.

---

## 3. 갭 분석 이력

### 3.1 분석 결과 요약
| 분석 회차 | 매치율 | 갭 수 | 조치 |
|----------|--------|-------|------|
| 1차 (정적, 2026-06-25) | 100% (27/27) | 0 (정적) | 0단계 런타임 검증 제안 |
| 0단계 런타임 (2026-07-24) | — | R1~R3 PASS / R4·R5 이월 | 임베드 UX 갭 G1~G5 등재 → iterate |
| iterate #1 재분석 (2026-07-24) | 100% (임베드 §7 11/11) | 0 | report 진행 |

### 3.2 주요 갭 해결 내역

| 갭 | 원인 | 해결 방법 |
|----|------|----------|
| G1 배너 요약 없음 | 임베드 전용 발송(제목만 배너 노출) | `notificationBannerContent` 2줄 평문 content 추가 |
| G2 임베드 상단 빈 줄 | 제로폭 필드 name | description 단일 문자열 전환 |
| G3 오버플로 임계·문구 | `>=6`, "새로운" 부정확 | 임계 `>3`, 중립 문구·`▸`·전체 공고 링크 |
| G4 지역/모드 미반영 | 임베드가 settings 미수신 | `notificationMessageEmbed(jobs, settings)`, SELECTED 안내문·ALL 분기 |
| G5 오버플로 아이콘 컬러 | `➕` 컬러 이모지(검게 보임) | 모노크롬 `▸`/`▽` |

> R4·R5(ready race 실타이밍·graceful shutdown 음성검증)·DM 에러분기(50007/429)·부하·스트레스는 **프로덕션 성격**이라 Phase 1.13 프로덕션 E2E 검증 리스트로 이월.

---

## 4. 검토 사항

**참고 문서**: [review-process.md](../../rules/review-process.md)

> ⚠️ 피드백 수신 시 즉시 반영하지 않음 — 수정 계획 제시 → 사용자 승인 → 진행

### 4.1 코드 리뷰
- [x] 핵심 로직 구현 확인 (startup 체인 / ready 게이트 / 임베드 §7)
- [x] 타입 안전성 확인 (`tsc --noEmit` exit 0, strict)
- [x] 에러 처리 확인 (dmSender graceful, eager catch 로그만, HTTP 비결합)

### 4.2 기능 테스트
- [x] TypeScript 컴파일 성공
- [x] 기존 기능 정상 동작 (build 통과, 호출부 전수 갱신)
- [x] 0단계 런타임: R1(RECRUIT_NEW)·R2(실 DM)·R3(NOTIFICATION_SENT) PASS + dmSender 10013 실패분기 PASS
- [x] 임베드 렌더: SELECTED(지역·안내문)/ALL(전체 지역·안내문 생략) 실 DM 확인
- [ ] R4·R5·DM 에러분기·부하 → Phase 1.13 이월

### 4.3 문서화
- [x] JSDoc/한국어 주석 (신규 export·헬퍼)
- [x] 관련 문서 업데이트 (02-design §7, 03-analysis §3.4/§3.5, phase-1-core Phase 1.13)

---

## 5. 피드백 반영 내역

<!-- 사용자 피드백 수신 시 기록 -->

---

## 6. Process Improvement

### 6.1 잘된 점
- 0단계 런타임 검증을 `node` 드라이버로 **실 DM 발송**해 정적 통과 이후의 렌더 문제(G1~G5)를 조기 발견 → iterate로 환류.
- 프로토타입(스크래치패드)으로 문구·레이아웃·아이콘을 실 DM으로 반복 확인 후 확정 → 실제 코드 반영 시 재작업 최소화.
- 배너 개행 등 Discord 렌더 특성을 실측해 기록(`discord-push-banner-newlines` 메모, 02-design §7).

### 6.2 개선할 점
- 임베드 UX는 1.9 원 설계(startup wiring) 범위 밖이었으나 렌더 검증 중 발생 → iterate로 흡수(범위 소폭 확대). 향후 "출력물 UX"는 별도 feature로 미리 분리 여지.

### 6.3 다음 Phase 제안

| 제안 | 관련 Phase | 우선순위 |
|------|-----------|---------|
| R4/R5·DM 에러분기(50007/429)·부하·스트레스·로그 수집 검증 | Phase 1.13 (프로덕션 E2E) | ⭐⭐⭐ |
| `notificationMessageEmbed`↔`recruitMessageEmbed` 블록 DRY | (후순위 W1) | ⭐ |
| 오버플로 "전체 공고" 링크의 지역 필터 URL(사이트 다중지역 미지원 확인됨 → 전체 목록 고정) | Phase 1.13/후속 | ⭐ |

---

## 7. 다음 단계

1. [x] 사용자 피드백 확인 및 승인 (2026-07-24)
2. [ ] `/pdca archive 1.9` 실행 (문서 아카이브)
3. [ ] `/pdca cleanup` 실행 (status JSON 정리 + memory 초기화)
4. [ ] Git 커밋(논리 단위) + push + PR 생성 (base dev) — archive/cleanup 변경 포함
5. [ ] PR 머지 → dev 동기화 → `/pdca next`

---

*작성일: 2026-07-24*
*참고: 01-plan.md, 02-design.md, 03-analysis.md*
