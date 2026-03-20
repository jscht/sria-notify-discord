# .claude/ 내장 도구 확장 및 구조 개선 보고서

> 작성일: 2026-02-19
> 작업 범위: .claude/ 디렉토리 구조 전면 재편 및 Claude Code 내장 도구 활용 극대화

---

## 📊 개선 요약

### Before → After

```
[Before]                              [After]
.claude/                              .claude/
├── PROJECT_CONTEXT.md  ❌ 삭제       ├── CLAUDE.md           ✅ 자동 로드
├── commands/                         ├── skills/
│   └── create-pr.md    ❌ 삭제       │   ├── code-review/    ✅ /code-review
├── rules/              (비어있음)     │   ├── phase-status/   ✅ /phase-status
├── settings.local.json               │   └── claude-md-audit/ ✅ /claude-md-audit
└── todos/              ❌ 삭제       ├── rules/
    ├── PROGRESS.md                   │   ├── git-workflow.md ✅ 전역 규칙
    ├── TODO.md                       │   └── review-process.md ✅ 전역 규칙
    ├── phase-*.md                    ├── phases/            ✅ 활성 추적
    └── reviews/                      │   ├── PROGRESS.md    (TODO 통합)
        ├── REVIEW_PROCESS.md         │   └── phase-*.md
        ├── *-review.md               ├── docs/              ✅ 기록 보관
        └── *-report.md               │   ├── reviews/
                                      │   └── reports/
                                      └── settings.local.json
```

---

## 🎯 주요 변경사항

### 1. CLAUDE.md 생성 (P0)
- **문제**: `PROJECT_CONTEXT.md`가 Claude Code가 인식하지 않는 위치에 존재 → 매 세션 수동 맥락 설정 필요
- **해결**: `.claude/CLAUDE.md` 생성 → 세션 시작 시 자동 로드
- **내용**: 프로젝트 개요, 기술 스택, 빌드 명령, `@` import로 ARCHITECTURE.md/PROGRESS.md 참조
- **영향**: 모든 세션에서 프로젝트 컨텍스트 자동 주입

### 2. 도메인 패턴을 functions/src/claude.md에 통합
- **문제**: 코드 컨벤션(LogSource, SystemError, EventBus)이 문서화되지 않음
- **해결**: 기존 `functions/src/claude.md`에 "코드 컨벤션" 섹션 추가
- **내용**: LogSource 타입 제약, 프리셋 로거, SystemError 팩토리, EventBus 패턴
- **장점**: path-scoped rule 없이 하위 디렉토리 자동 발견으로 동일 효과

### 3. commands/ → skills/ 마이그레이션
- **문제**: `commands/`는 레거시 디렉토리, frontmatter 미지원
- **해결**: `skills/` 디렉토리로 전환 (상위 호환)
- **추가 skills**: `/code-review`, `/phase-status`, `/claude-md-audit`
- **삭제**: `create-pr.md` → `rules/git-workflow.md`에 PR 절차 통합

### 4. rules/ 활용
- **문제**: rules/ 디렉토리가 비어있어 규칙 기반 자동 로드 미활용
- **해결**: 2개 규칙 파일 생성
  - `git-workflow.md`: 브랜치 전략, 커밋 포맷, PR 규칙 (create-pr.md 통합)
  - `review-process.md`: 검토 프로세스 (REVIEW_PROCESS.md에서 이전)

### 5. todos/ 구조 개선
- **문제**: `todos/` 래퍼가 불필요한 depth 추가, TODO.md/PROGRESS.md 중복, 리뷰/보고서 혼재
- **해결**:
  - `todos/` 제거 → `phases/`(활성 추적), `docs/`(기록 보관) 직속 배치
  - `TODO.md` → `PROGRESS.md`에 통합
  - `REVIEW_PROCESS.md` → `rules/review-process.md`로 이전
  - `docs/reviews/` + `docs/reports/` 분리

---

## 📂 파일 변경 내역

### 신규 생성 (8개)
| 파일 | 용도 |
|------|------|
| `.claude/CLAUDE.md` | 프로젝트 메모리 (자동 로드) |
| `.claude/rules/git-workflow.md` | Git/PR 규칙 |
| `.claude/rules/review-process.md` | 검토 프로세스 |
| `.claude/skills/code-review/SKILL.md` | /code-review 커맨드 |
| `.claude/skills/phase-status/SKILL.md` | /phase-status 커맨드 |
| `.claude/skills/claude-md-audit/SKILL.md` | /claude-md-audit 커맨드 |
| `.claude/phases/` | Phase 문서 디렉토리 |
| `.claude/docs/` | 기록 보관 디렉토리 |

### 이전 (12개)
| 원본 | 대상 |
|------|------|
| `todos/PROGRESS.md` | `phases/PROGRESS.md` |
| `todos/phase-*.md` (4개) | `phases/` |
| `todos/reviews/phase-*-review.md` (5개) | `docs/reviews/` |
| `todos/reviews/*-report.md` (2개) | `docs/reports/` |

### 수정 (링크 업데이트)
- `phases/PROGRESS.md` — reviews 링크 → `../docs/reviews/`
- `phases/phase-*.md` (4개) — reviews 링크, TODO.md → PROGRESS.md
- `docs/reviews/*.md` (5개) — REVIEW_PROCESS, PROJECT_CONTEXT, report 링크
- `docs/reports/*.md` (2개) — functions/src 링크 depth 수정
- `functions/src/claude.md` — 코드 컨벤션 섹션 추가 + 작업 관리 링크
- `functions/claude.md` — 작업 관리 링크

### 삭제 (3개)
| 파일 | 사유 |
|------|------|
| `.claude/PROJECT_CONTEXT.md` | CLAUDE.md + rules로 대체 |
| `.claude/commands/` 전체 | skills/로 마이그레이션 |
| `.claude/todos/` 전체 | phases/ + docs/로 분리 |

---

## ✅ 개선 효과

- **자동 컨텍스트 주입**: 매 세션 시작 시 CLAUDE.md 자동 로드 (기존: 수동 참조)
- **규칙 자동 적용**: rules/ 파일이 세션에 자동 로드 (기존: 규칙 없음)
- **구조 단순화**: depth 3→2 감소 (`.claude/todos/reviews/` → `.claude/docs/reviews/`)
- **중복 제거**: TODO.md + PROGRESS.md → PROGRESS.md 단일 진입점
- **도메인 패턴 문서화**: LogSource, SystemError, EventBus 컨벤션 명시
- **워크플로우 자동화**: 3개 skill 추가 (/code-review, /phase-status, /claude-md-audit)
