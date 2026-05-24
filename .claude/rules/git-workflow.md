# Git Workflow

## 브랜치 전략

```
dev (개발) → stable (검수) → main (배포)
```

- **단방향 flow**: dev → stable → main (역방향 pull 금지)
- `stable`의 `.gitattributes`에서 Claude 관련 파일 merge 시 자동 제외
- 브랜치 네이밍 규칙: `{type}/phase-X.Y-{name}` (타입 목록은 아래 참조)

  | 타입 | 용도 |
  |------|------|
  | `feature` | 신규 기능 |
  | `fix` | 버그 수정 |
  | `hotfix` | 프로덕션 긴급 수정 |
  | `refactor` | 리팩토링 (기능 변경 없음) |
  | `chore` | 빌드·설정·의존성 유지보수 |
- 이전 브랜치 유지 (삭제 금지)
- 병합 대상: dev 브랜치

## Commit 규칙

```
<type>(<scope>): Phase X.Y - <description>

<주요 변경사항 요약>

## 주요 변경사항
- 항목 1
- 항목 2

## 개선 효과
- ✅ 효과 1
- ✅ 효과 2

Ref: pdca-status.json Phase X.Y
```

**커밋 타입 목록**:

| 타입 | 용도 |
|------|------|
| `feat` | 신규 기능 |
| `fix` | 버그 수정 |
| `refactor` | 리팩토링 (기능 변경 없음) |
| `test` | 테스트 추가·수정 |
| `docs` | 문서 작업 |
| `chore` | 빌드·설정·의존성 유지보수 |

**Scope**: component name or feature area

**금지 사항**:
- 🚫 "🤖 Generated with Claude Code" 사용 금지
- 🚫 "Co-Authored-By" 태그 사용 금지
- 논리적 단위로 커밋 분리

## PR 생성 절차

1. 현재 브랜치 확인: `git branch --show-current`
2. 커밋 히스토리 확인: `git log dev..HEAD --oneline`
3. 원격 푸시: `git push -u origin [브랜치명]`
4. PR 생성:
   ```bash
   gh pr create --base dev --head [브랜치명] --title "제목" --body "$(cat <<'EOF'
   [PR 본문]
   EOF
   )"
   ```

> **PDCA 사이클 PR 순서**: report 승인 → `/pdca archive` → `/pdca cleanup`까지 마친 뒤 PR을 생성한다 (문서 이동·상태 JSON 변경을 같은 PR에 포함). PR 머지 후 `git checkout dev && git pull` → `/pdca next`. 상세 순서는 `.claude/rules/review-process.md` 참조.

**PR 규칙**:

| 항목 | 규칙 |
|------|------|
| base | `dev` (필수) |
| 제목 | `Phase X.Y: 작업명` |
| 본문 포함 | Summary, 주요 변경사항, 기술적 개선사항, 테스트 상태, Breaking Changes |
| 제외 | 변경 통계 (파일 수, 라인 수), Co-Authored-By 태그 |
