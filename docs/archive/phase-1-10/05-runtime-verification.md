# Phase 1.10 — 런타임 검증 목록 (0단계, mock 재정의)

> 근거: 구현 코드(SoT) 기준 — mock 소스 프로바이더·소스별 sync/diff·DM 파이프라인.
> 분류 — **(C)** Claude 실행·판정 가능(외부 부작용 없음) / **(U)** 사용자만 가능(봇 상시 기동·실 DM 전송·과금 수반).
> 절차: 진입 시 `git add -A` 기준선 → (C)는 Claude 실행 후 통과 처리 전 사용자 확인 / (U)는 사용자 실행·결과 보고. 실패 항목은 `03-analysis.md` 갭 등재 → iterate.

> ⚠️ 개정: 기존 proxy/crawl 검증 항목(CF-C*, CF-U*, OP-U*, G-U*)은 mock pivot으로 **전부 소멸**(프록시·실 크롤·license/robots·soft-block 관찰 불요). 아래는 mock 구조 기준 재작성.

## 전제조건 (충족됨 — 검증 아님)

- **P0** 빌드·타입 정합 `npx tsc --noEmit` / `npm run build` → ✅ exit 0
- **P1** rename 무결성 `grep -riE "crawl|proxy" src --include=*.ts` 활성 심볼 0 (이력 주석 제외) → ✅

---

## 그룹 1 — mock 생성·diff·이벤트

### (C) Claude 실행·판정 가능

| # | 항목 | 검증 내용 | 방법 |
|---|------|-----------|------|
| MC-C1 | 콘솔 테스트 3종 | `systemError`(category:"source"·sourceFailed), `EventBus`(RECRUIT_CHANGED 수신·페이로드), `BaseScheduler`(RECRUIT_SYNC_STARTED/COMPLETED/FAILED 발행) | `tsx` 직접 실행 → "통과" 로그 |
| MC-C2 | temp 규칙 엔진 분포 | 생성 40/10/2/48% 근사 | 임시 tsx 하네스(대량 경계 샘플) |
| MC-C3 | temp 확정 수정 | 진행도에 따라 dDay/상태 결정적 감소 | 동일 id 연속 경계 관찰 |
| MC-C4 | temp 확정 삭제 | 모집기간(lifespanTicks) 종료 후 목록에서 제외 | born+lifespan 경계 확인 |
| MC-C5 | temp 확률 삭제 영구성 | firstDeathTick 이후 재등장 0 | death 이후 경계 스캔 |
| MC-C6 | 경계 내 결정성 | 같은 now → 같은 목록(순수 함수) | 반복 호출 동일성 |
| MC-C7 | 소스별 diff 분리 | `setRecruitList(list,"temp")` 시 sria 파티션 미삭제 | deletedIds에 sria id 0건 |
| MC-C8 | 다중소스 병합(읽기) | `fetchAll()` sria+temp 병합·dedupeById | id 충돌 0 |
| MC-C9 | 임베드 렌더 | `Recruit` union으로 recruitMessageEmbed/notificationMessageEmbed | throw 없이 JSON 산출 |

### (U) 사용자만 가능

| # | 항목 | 검증 내용 | 이유 |
|---|------|-----------|------|
| MC-U1 | 소스별 2-run E2E | 소스별 스케줄 1회 NO_DATA→무DM, 2회 해당 소스만 CHANGED→실 DM | 봇 기동·Redis·실 DM 필요 |

---

## 그룹 2 — 운영/배포 (선택)

| # | 항목 | 검증 내용 | 분류 |
|---|------|-----------|------|
| OP-U1 | 실배포 트리거 | `recruitSchedule_sria`("every 4 hours")·`recruitSchedule_temp`("every 30 minutes") 실배포 발화 | (U) |
| OP-U2 | DM 에러분기 | 50007 graceful skip / 429 대기·재시도 | (U) |

---

## 집계

- 전제조건: 2 (충족)
- (C) Claude 실행: 9 (MC-C1~C9)
- (U) 사용자 실행: 3 (MC-U1, OP-U1~U2)

## 통과/실패 처리

- **전체 통과** → `/pdca report 1.10` (report "기능 테스트"를 실결과로 채움)
- **실패 발생** → 해당 항목 `03-analysis.md` 갭 등재 → `/pdca iterate 1.10` (정적 매치율과 무관하게 런타임 실패는 갭)

---

*개정: 2026-09-17 (mock 2차 재정의 — proxy 검증 항목 폐기)*
