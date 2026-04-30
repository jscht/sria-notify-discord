# PDCA 자동 동작

## 신규 기능 요청 시 (New Feature Request)
1. pdca-status.json에서 해당 Phase 계획 확인 / Check phase plan in pdca-status.json
2. `docs/phase-X-Y/01-plan.md` 존재 확인
   - 없으면 구현 전에 자동 실행: `/pdca plan X.Y` → `/pdca design X.Y` → `/pdca do X.Y`
   - 있으면 기존 문서 읽고 구현 진행
3. 기존 패턴 탐색 후 재사용 가능한 구현 우선 적용 / Search existing patterns first
4. 구현 완료 후 자동 실행: `/pdca analyze X.Y`
   - matchRate ≥ 90%이면 `/pdca report X.Y` 안내
   - matchRate < 90%이면 `/pdca iterate X.Y` 안내

## 버그 수정 / 리팩토링 (Bug Fix / Refactoring)
1. 설계 문서와 코드 비교하여 원인 파악 / Compare code with design docs to identify root cause
2. 수정 후 관련 문서 업데이트 제안 / Suggest updating related docs after fix
