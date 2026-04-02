---
name: claude-md-audit
description: |
  프로젝트 내 모든 CLAUDE.md 및 .claude/rules/*.md 파일을 검색하고 현황을 감사합니다.
  깨진 @import 참조, 중복 지침, 오래된 정보를 탐지하여 보고서를 출력합니다.

  다음 상황에서 반드시 사용하세요:
  - "CLAUDE.md 감사", "audit", "claude 설정 점검", "규칙 파일 확인"
  - "@참조가 깨졌는지 확인해줘", "중복된 규칙 있어?", "설정 파일 현황"
  - CLAUDE.md 또는 rules 파일을 수정한 직후 정합성 검증이 필요할 때

  사용하지 않는 경우: 일반 파일 검색, 코드 내용 분석
user-invocable: true
allowed-tools:
  - Read
  - Glob
  - Grep
---

# CLAUDE.md 감사

프로젝트 설정 파일의 정합성을 검증하고 문제를 탐지합니다.

## 작업 순서

### 1단계: 대상 파일 수집

다음 패턴으로 파일을 검색한다:
- `**/CLAUDE.md`
- `**/CLAUDE.local.md`
- `.claude/rules/*.md`
- `.claude/skills/*/SKILL.md`

### 2단계: 각 파일 분석

각 파일에 대해 다음을 확인한다:

**기본 정보**
- 파일 경로, 줄 수
- YAML frontmatter 유무 (SKILL.md의 경우)

**@import 참조 목록 추출**
`@경로` 형태의 참조를 모두 추출한다.
각 참조가 실제로 존재하는 파일 경로인지 확인한다.

**주요 섹션 목록**
`##` 헤딩 기준으로 섹션 목록을 추출한다.

### 3단계: 문제 탐지

**깨진 @import 참조**
추출한 @경로가 실제 파일로 존재하지 않으면 broken으로 분류한다.

**중복 지침 탐지**
여러 파일에 동일한 규칙이 서술되어 있는 경우 중복으로 표시한다.
판단 기준: 같은 주제(예: 커밋 규칙, 네이밍 규칙, 임포트 순서)를 다른 파일에서도 설명하고 있을 때.
중복이 반드시 문제는 아니지만 관리 부담이 있으므로 정보성으로 표시한다.

**SKILL.md frontmatter 누락**
`.claude/skills/*/SKILL.md` 파일에 YAML frontmatter(`---`)가 없으면 경고로 표시한다.
frontmatter 없이는 자동 트리거가 작동하지 않는다.

### 4단계: 참조 그래프 시각화

어떤 파일이 어떤 파일을 @로 참조하는지 트리 형태로 표시한다.

### 5단계: 결과 출력

```
📋 CLAUDE.md 감사 보고서
━━━━━━━━━━━━━━━━━━━━━━━━━━

📁 발견된 파일 (N개)
  .claude/CLAUDE.md                    (XX줄)
  .claude/rules/git-workflow.md        (XX줄)
  .claude/rules/review-process.md      (XX줄)
  .claude/skills/code-review/SKILL.md  (XX줄) ✅ frontmatter 있음
  .claude/skills/phase-status/SKILL.md (XX줄) ✅ frontmatter 있음
  ...

🔗 참조 그래프
  .claude/CLAUDE.md
    → @ARCHITECTURE.md
    → @.claude/phases/PROGRESS.md

⚠️ 문제 (있다면)
  🔴 [파일경로]: 깨진 참조 → @존재하지않는경로
  🟡 [파일경로]: frontmatter 누락 (자동 트리거 불가)
  🔵 [주제]: 중복 지침 → [파일A], [파일B] 모두 설명 중

✅ 이상 없음 (문제가 없으면 이 줄만 표시)
```

문제가 없으면 간결하게 "✅ 모든 참조 정상, 중복 없음"으로 마무리한다.
