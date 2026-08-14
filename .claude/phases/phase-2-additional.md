# Phase 2: 부가 기능 구현

> 에러 관리 및 관리자 기능 강화

**현재 진행률**: 0% (0/3 완료)

---

## 📊 Sub-Phase 진행 상황

| Sub-Phase | 작업명 | 완료 | 진행 중 | 대기 중 |
|-----------|--------|------|---------|---------|
| Phase 2.1 | 에러 자동 전송 | 0 | 0 | 5 |
| Phase 2.2 | 관리자 전체 공지 | 0 | 0 | 7 |
| Phase 2.3 | 사용자 건의사항 전송 | 0 | 0 | - |

---

## Phase 2.1: 에러 자동 전송 (3-4시간)
**우선순위**: ⭐⭐
**의존성**: Phase 1.1, 1.8 완료

- [ ] Firestore 에러 로그 스키마
  - [ ] `errors/{errorId}` 구조 설계
  - [ ] 인덱스 설정 (createdAt, type, service)

- [ ] `providers/firebase/store/errorLog.ts` 작성
  - [ ] `saveErrorLog(error, context)` 함수
  - [ ] `getErrorLogs(filters)` 함수 (관리자용)
  - [ ] `markErrorAsResolved(errorId)` 함수

- [ ] `services/errorReportService.ts` 생성
  - [ ] `reportCriticalError(error, context)` 메서드
  - [ ] 에러 정보 포맷팅
  - [ ] 관리자 DM 전송

- [ ] `eventBus/handlers/ErrorEventHandler.ts` 생성
  - [ ] `error.critical` 이벤트 리스너 등록

- [ ] `crawlers/schedulers/base/BaseScheduler.ts` 수정
  - [ ] catch 블록에서 `error.critical` 이벤트 발행

**완료 기준**:
- [ ] 에러 발생 시 관리자 DM 전송
- [ ] Firestore에 에러 로그 저장

---

## Phase 2.2: 관리자 전체 공지 (4-5시간)
**우선순위**: ⭐⭐
**의존성**: Phase 1.4, 1.8 완료

- [ ] Firestore 공지 이력 스키마
  - [ ] `broadcasts/{broadcastId}` 구조 설계

- [ ] `providers/firebase/store/broadcast.ts` 작성
  - [ ] `saveBroadcast(content, author)` 함수
  - [ ] `updateBroadcastStats(broadcastId, stats)` 함수

- [ ] `features/adminBroadcast/commands/slashCommand.ts` 작성
  - [ ] `/admin-broadcast` 명령어 정의
  - [ ] 관리자 권한 검증

- [ ] `features/adminBroadcast/interactions/modals.ts` 작성
  - [ ] 공지 내용 입력 모달 생성

- [ ] `features/adminBroadcast/handlers/modalHandler.ts` 작성
  - [ ] 모달 제출 이벤트 처리
  - [ ] `admin.broadcast.request` 이벤트 발행

- [ ] `features/adminBroadcast/services/BroadcastService.ts` 작성
  - [ ] `admin.broadcast.request` 이벤트 리스너 등록
  - [ ] 모든 구독자 조회
  - [ ] 사용자별 DM 발송 (순차, Rate Limit 고려)
  - [ ] 발송 진행 상황 추적

- [ ] 발송 결과 리포트
  - [ ] 관리자에게 결과 DM 전송

**완료 기준**:
- [ ] `/admin-broadcast` 명령어 동작
- [ ] 모든 구독자에게 DM 발송
- [ ] 발송 통계 저장

---

## Phase 2.3: 사용자 건의사항 전송 (미착수)
**우선순위**: ⭐⭐ (P1)
**의존성**: Phase 1.8, 1.13 완료

> 사용자가 관리자에게 직접 건의·문의를 보내는 채널. 세부 계획(저장 스키마·전달 포맷·권한·중복/스팸 처리 등)은 **본 Phase 착수(`/pdca plan 2.3`) 시 design 단계에서 확정**한다. 여기서는 개요만 고정한다.

- **UI**: `/feedback`(가칭) 슬래시 커맨드 → 모달 입력 (Discord 도메인)
- **의존성**: 1.8(DM 유틸 — 관리자 전달), 1.13(프로덕션 런타임 — 실제 발송 경로)
- **우선순위**: P1

---

*최종 수정: 2026-07-24*
*상위 문서: [TODO.md](./PROGRESS.md)*
