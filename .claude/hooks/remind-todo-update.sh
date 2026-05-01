#!/usr/bin/env bash
# Stop/SessionEnd hook — 진행 중 항목이 있을 때 갱신 리마인더

TODO_FILE=".claude/docs/todo.md"
[ ! -f "$TODO_FILE" ] && exit 0

# 세션 중 변경 사항이 있었는지 (git working tree 변경) 확인
if git diff --quiet HEAD 2>/dev/null && git diff --cached --quiet HEAD 2>/dev/null; then
  exit 0  # 변경 없으면 리마인더 생략
fi

# 진행 중 항목이 있는지
IN_PROGRESS=$(awk '/^## 진행 중/,/^## 대기/' "$TODO_FILE" | grep -E "^\s*-\s\[\s\]" 2>/dev/null)
if [ -n "$IN_PROGRESS" ]; then
  echo "## TODO 갱신 권장"
  echo "세션에서 작업이 수행되었고 '진행 중' 항목이 남아있습니다."
  echo "상태에 맞게 .claude/docs/todo.md를 갱신하세요 (/todo update)."
fi
