# 문서 구조 규칙 (Document Structure Rules)

## .claude/rules/ — 현재 구현 기준 문서 (Implementation Reference)
- Update together with code changes
- Always reflects current codebase state

## .claude/phases/ — 진행 중 작업 (Active Work)
- Active phase planning documents
- Track overall status via PROGRESS.md

## docs/reviews/ — 검토 기록 (Review History)
- Completed review documents per phase
- Read-only (no modifications)

## 아카이브 전환 조건 (Archive Trigger)

| 조건 | 내용 |
|------|------|
| 자동 전환 | Gap analysis completed (match rate >= 90%) |
| 수동 전환 | user explicit completion |
| 전환 처리 | Move to archive (docs/reviews/ 해당 Phase 문서) |
