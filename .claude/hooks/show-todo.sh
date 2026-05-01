#!/usr/bin/env bash
# SessionStart hook — todo.md 자동 생성 + 미완료 항목 표시

TODO_FILE=".claude/docs/todo.md"
TEMPLATE=".claude/templates/todo.template.md"

# todo.md 자동 생성 (gitignore되므로 새 머신/클론에서 필요)
if [ ! -f "$TODO_FILE" ] && [ -f "$TEMPLATE" ]; then
  cp "$TEMPLATE" "$TODO_FILE"
fi
[ ! -f "$TODO_FILE" ] && exit 0

PENDING=$(grep -E "^\s*-\s\[\s\]" "$TODO_FILE" 2>/dev/null)
if [ -n "$PENDING" ]; then
  echo "## 일일 TODO 미완료 항목 (.claude/docs/todo.md)"
  # 번호 붙여서 출력
  i=1
  while IFS= read -r line; do
    echo "$i. $(echo "$line" | sed 's/^\s*-\s\[\s\]\s*//')"
    i=$((i + 1))
  done <<< "$PENDING"
  echo ""
  echo "사용자가 작업 지시 시 이 목록을 우선 참고하세요. /todo 스킬로 관리 가능."
fi
