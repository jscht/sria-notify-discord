# 검토 프로세스

## 검토 단계

**상태 전환**: 🔄 진행 중 → 🔍 검토 중 → 피드백 → ✅ 완료 → 📦 Archive & Cleanup → Git Commit & PR → 🔀 dev 머지

### 1단계: 구현 완료 → 검토 요청
- `/pdca report X.Y` 실행 → Report Generator 에이전트가 보고서 초안 생성
- `docs/phase-X-Y/04-report.md` 문서 생성
- 상태 업데이트: 🔄 → 🔍

### 2단계: 피드백 처리 (⚠️ 자동 반영 금지)
1. 피드백 내용 정리 및 영향 범위 분석
2. 수정 계획 제시
3. **사용자 승인 대기** — 승인 전까지 코드 수정 금지
4. 승인 후 수정 작업 진행

### 3단계: 최종 승인
- 수정 필요 시: 코드 수정 → review 문서 업데이트 → 2단계 복귀
- 수정 불필요 시: 사용자 "승인" 코멘트 → ✅ 완료

### 4단계: Archive & Cleanup
- `/pdca archive X.Y` → `docs/phase-X-Y/` → `docs/archive/phase-X-Y/` 이동
- `/pdca cleanup` → pdca-status.json features→tasks 이력 이동, pdca-memory.json null 초기화, overview 재계산

### 5단계: Git Commit & PR
- ⚠️ **사용자 지시 시에만 수행** (이전까지는 자동 진행 금지)
- archive/cleanup이 만든 변경(문서 이동 + 상태 JSON)까지 포함하여 커밋
- 논리적 단위로 분리 (`feat` 기능 코드 / `chore` bookkeeping)
- push → PR(base dev) — git-workflow.md 규칙 준수

### 6단계: dev 머지 후 다음 사이클
- PR 머지 → `git checkout dev && git pull`
- `/pdca next` → 다음 feature 확인 → `/pdca plan X.Y` (최신 dev 기반 새 브랜치)

> **순서 근거**: archive/cleanup을 commit **전에** 수행해야 bookkeeping 변경이 같은 PR에 포함되어 dangling 커밋이 생기지 않는다. dev 전환은 **PR 머지 후** — 그래야 다음 `plan`이 최신 dev에서 브랜치를 딴다.

## 핵심 규칙

- **피드백 수신 시 즉시 반영하지 않음**
- 수정 계획 제시 → 승인 → 진행
- **사용자가 명시적으로 말하기 전까지 review 문서에 반영 금지**

## 작업 상태 기호

| 기호 | 의미 |
|------|------|
| ✅ | 완료 |
| 🔍 | 검토 중 |
| 🔄 | 진행 중 |
| ⏸️ | 보류 |
| ⏱️ | 대기 중 |

## 우선순위

- ⭐⭐⭐ (P0): 핵심 기능
- ⭐⭐ (P1): 사용자 경험 개선
- ⭐ (P2): 품질 보증
