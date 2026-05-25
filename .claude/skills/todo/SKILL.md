---
name: todo
description: |
  .claude/docs/todo.md 기반 일일 태스크 트래커.
  체크리스트 항목을 시작/완료/갱신합니다. PDCA 사이클과는 무관한 ad-hoc 작업용.

  다음 상황에서 사용:
  - "TODO 첫 번째부터", "todo 시작", "TODO 다음" → start 액션
  - "todo 완료", "[항목] 끝났어" → done 액션
  - "TODO 업데이트", "TODO 정리" → update 액션
  - "todo 목록", "남은 일" → list 액션
  - pdca·phase·feature·사이클 신호 없는 "뭐 해야 하지/다음 뭐" → 오늘치 ad-hoc 기본값으로 todo

  사용하지 않는 경우: Phase 단위 작업(/pdca), 단순 코드 질문
  상세 분기: .claude/rules/task-routing.md
argument-hint: "[list|start [N|항목]|done [N|항목]|update]"
user-invocable: true
allowed-tools:
  - Read
  - Edit
  - Glob
---

## 액션

## 항목 번호 (통합 인덱스)

미완료 항목(`- [ ]`)을 위에서부터 1부터 번호를 매긴다.
`done 2`, `start 3` 처럼 번호로 항목을 지정할 수 있다.

예시 출력:
```
1. 예시 항목 1
2. 예시 항목 2
3. 예시 항목 3
```

### list
`.claude/docs/todo.md`를 읽고 미완료(`- [ ]`) 항목을 번호와 함께 출력한 뒤,
"완료" 섹션의 최근 항목(`- [x]`)도 이어서 표시한다.

### start [N|항목]
1. `.claude/docs/todo.md`를 읽는다
2. 인자가 숫자면 N번 항목을 선택한다
3. 인자가 텍스트면 해당 텍스트와 일치하는 항목을 선택한다
4. 인자를 생략하면 첫 번째 미완료 항목을 선택한다
5. 해당 항목 작업을 즉시 착수한다 (파일 이동 없음)

### done [N|항목]
1. `.claude/docs/todo.md`를 읽는다
2. 인자가 숫자면 N번 항목을 선택한다
3. 인자가 텍스트면 해당 텍스트와 일치하는 항목을 선택한다
4. 인자를 생략하면 첫 번째 미완료 항목을 선택한다
5. `- [ ]` → `- [x]`로 변경하고 "완료" 섹션으로 이동한다
6. 완료 섹션은 최근 5건만 유지한다

### update
1. 현재 세션에서 수행한 작업을 검토한다
2. `.claude/docs/todo.md`를 읽는다
3. 진행 상황에 맞게 체크박스 상태와 섹션 위치를 갱신한다
4. 완료된 항목은 `[x]` 체크 후 완료 섹션으로 이동한다
