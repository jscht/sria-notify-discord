# 문서 구조 규칙 (Document Structure Rules)

## .claude/ — Claude 도구 설정 및 워크플로우

### .claude/rules/ — 현재 구현 기준 문서 (Implementation Reference)
- Update together with code changes
- Always reflects current codebase state

### .claude/phases/ — Phase 시드 문서 (Phase Seeds)
- Active phase planning documents
- Track overall status via pdca-status.json

### .claude/docs/ — Claude 참조용 상태·설정 파일
- `pdca-status.json` — PDCA 전체 상태 DB
- `pdca-memory.json` — 현재 작업 포인터
- `ARCHITECTURE.md`, `coding-conventions.md`, `tech-stack.md`, `build-deploy.md`

### .claude/templates/ — PDCA 문서 템플릿
### .claude/skills/ — 스킬 정의

## docs/ — 프로젝트 구현 기록물

### docs/reviews/ — 검토 기록 (Review History)
- Phase별 리뷰 문서
- Read-only (no modifications after approval)

### docs/reports/ — 보고서 (Reports)
- 개선 보고서, 분석 보고서

### docs/archive/ — 아카이브 (Archived PDCA Documents)
- PDCA 사이클 완료 후 아카이브된 문서
- `docs/archive/phase-X-Y/` 폴더 단위로 보관

## 아카이브 전환 조건 (Archive Trigger)

| 조건 | 내용 |
|------|------|
| 자동 전환 | Gap analysis completed (match rate >= 90%) |
| 수동 전환 | user explicit completion |
| 전환 처리 | `docs/phase-X-Y/` → `docs/archive/phase-X-Y/` 이동 |
