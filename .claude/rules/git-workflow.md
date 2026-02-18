# Git Workflow

## 브랜치 전략

```
dev (개발) → stable (검수) → main (배포)
```

- **단방향 flow**: dev → stable → main (역방향 pull 금지)
- `stable`의 `.gitattributes`에서 Claude 관련 파일 merge 시 자동 제외
- Phase별 브랜치: `feature/phase-X-name` 또는 `refactor/phase-X.Y-description`
- 이전 브랜치 유지 (삭제 금지)
- 병합 대상: dev 브랜치

## Commit 규칙

```
<type>: Phase X.Y - <작업명>

<주요 변경사항 요약>

## 주요 변경사항
- 항목 1
- 항목 2

## 개선 효과
- ✅ 효과 1
- ✅ 효과 2

Ref: PROGRESS.md Phase X.Y
```

**Type**: feat | fix | refactor | test | docs | chore

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

**PR 규칙**:
- base: dev (필수)
- 제목: `Phase X.Y: 작업명`
- 본문 포함: Summary, 주요 변경사항, 기술적 개선사항, 테스트 상태, Breaking Changes
- **제외**: 변경 통계 (파일 수, 라인 수), Co-Authored-By 태그
