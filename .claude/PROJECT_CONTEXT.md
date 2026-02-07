# Project Context for Claude

> 이 파일은 Claude가 프로젝트 작업 시 자동으로 참조하는 컨텍스트 문서입니다.
>
> **최종 수정**: 2026-01-13

---

## 📚 주요 문서 참조

### 필수 문서
- **프로젝트 개요**: [README.md](../README.md)
- **아키텍처**: [ARCHITECTURE.md](../ARCHITECTURE.md)
- **개발 진행 현황**: [PROGRESS.md](./todos/PROGRESS.md)
- **작업 목록**: [TODO.md](./todos/TODO.md)

### Phase별 문서
- **Phase 1.1**: [phase-1-core.md](./todos/phase-core.md)
- **Phase 2.1**: [phase-2-additional.md](./todos/phase-2-additional.md)
- **Phase 3.1**: [phase-3-testing.md](./todos/phase-3-testing.md)
- **Phase 4.1**: [phase-4-ai.md](./todos/phase-4-ai.md)

### 검토 문서
- **검토 프로세스**: [REVIEW_PROCESS.md](./todos/review/REVIEW_PROCESS.md)
- **Phase 1.1 검토**: [phase-1-1-review.md](./todos/review/phase-1-1-review.md)

### 기술 가이드
- **SystemError 가이드**: [SYSTEM_ERROR_GUIDE.md](../functions/src/common/utils/__docs__/SYSTEM_ERROR_GUIDE.md)
- **SystemLogger 가이드**: [SYSTEM_LOGGER_GUIDE.md](../functions/src/common/utils/__docs__/SYSTEM_LOGGER_GUIDE.md)

---

## 📝 작업 규칙

### 📝 작업 상태 기호
| 기호 | 의미 | 설명 |
|------|------|------|
| ✅ | 완료 | 구현 및 검증 완료 |
| 🔍 | 검토 중 | 구현 완료, 사용자 검토 대기 |
| 🔄 | 진행 중 | 현재 작업 중 |
| ⏸️ | 보류 | 일시적으로 중단됨 |
| ⏱️ | 대기 중 | 아직 시작하지 않음 |

### 체크리스트 업데이트
- 작업 대기: `- [ ]` 또는 `⏱️`
- 작업 시작: `- [ ]` → `- [🔄]`
- 구현 완료: `- [🔄]` → `🔍` (검토 중)
- 검토 통과: `🔍` → `- [x]` 또는 `✅`
- 작업 보류: `- [ ]` → `- [⏸️]`

### 우선순위 가이드
- **⭐⭐⭐ (P0)**: 반드시 구현 - 핵심 기능
- **⭐⭐ (P1)**: 권장 구현 - 사용자 경험 개선
- **⭐ (P2)**: 선택 구현 - 품질 보증

---

## 🔍 검토 프로세스

**자세한 내용**: [REVIEW_PROCESS.md](./todos/reviews/REVIEW_PROCESS.md)

### 검토 단계
1. **구현 완료** → 🔄 → 🔍 (검토 중)
2. **사용자 검토** → 피드백 또는 승인
3. **검토 통과** → 🔍 → ✅ (완료)
4. **Git 커밋 및 PR 생성**

### ⚠️ 중요 규칙
- **피드백 수신 시 즉시 반영하지 않음**
- 수정 계획 제시 후 승인 받고 진행
- **사용자가 "수정사항을 review 파일에 반영해도 된다"고 명시적으로 말하기 전까지 review 문서에 반영 금지**
- 자동 반영 절대 금지

### 피드백 처리 절차
1. 피드백 수신 → **즉시 반영하지 않음**
2. 피드백 내용 정리 및 영향 범위 분석
3. **사용자에게 반영 여부 확인 요청**
4. 승인 후 수정사항 적용

---

## 🔄 Git Workflow

### 핵심 브랜치 전략
```
dev (개발) → stable (검수) → main (배포)
```
- **단방향 flow**: `dev → stable → main` (역방향 pull 금지)
- `stable`의 `.gitattributes`에서 Claude 관련 파일 merge 시 자동 제외
- `dev`: 기능 개발 및 Claude 관련 문서 포함
- `stable`: Claude 관련 파일 제외, 최종 검수
- `main`: 프로덕션 배포 버전

### Phase별 브랜치 전략
- **Phase별 브랜치**: `feature/phase-X-name` (예: `feature/phase-1-event-bus`)
- **이전 브랜치 유지**: 삭제하지 않음
- **병합 대상**: dev 브랜치
- **병합 후**: 다음 Phase 브랜치 생성

### Commit 규칙
```
<type>: Phase X.Y - <작업명>

<주요 변경사항 요약>

## 주요 변경사항
- 항목 1
- 항목 2

## 개선 효과
- ✅ 효과 1
- ✅ 효과 2

Ref: TODO.md Phase X.Y
```

**Type 목록**:
- `feat`: 새 기능 추가
- `fix`: 버그 수정
- `refactor`: 코드 리팩토링
- `test`: 테스트 추가
- `docs`: 문서 수정
- `chore`: 빌드/설정 변경

**⚠️ 중요 주의사항**:
- 🚫 **"🤖 Generated with Claude Code" 및 "Co-Authored-By" 사용 금지**
- 논리적 단위로 커밋 분리 (예: Logging, Error, EventBus 각각 커밋)

### PR 규칙
- **base**: dev (반드시!)
- **head**: feature/phase-X-name
- **제목**: Phase X.Y: 작업명
- **본문**: 상세한 변경사항, 검토 사항, 개선 효과 포함

**PR 생성 명령어**:
```bash
gh pr create --base dev --head feature/phase-X-name --title "제목" --body "내용"
```

---

*이 문서는 프로젝트 진행에 따라 지속적으로 업데이트됩니다.*
