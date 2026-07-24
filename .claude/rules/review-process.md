# 검토 프로세스

## 검토 단계

**상태 전환**: 🔄 진행 중 → (선택) 🧪 런타임 검증 → 🔍 검토 중 → 피드백 → ✅ 완료 → 📦 Archive & Cleanup → Git Commit & PR → 🔀 dev 머지

### 0단계: 런타임 검증 (선택 · analyze 후 · report 전)

> **선택 단계 — 강제 아님.** analyze(정적) 통과 후 사용자가 실제 동작 확인을 원할 때만 수행한다. 생략하고 바로 report로 가도 된다. 데이터/타입 계층처럼 런타임 가치가 낮으면 보통 생략한다.

사용자가 런타임 검증을 **선택한 경우** 아래 절차를 따른다:

- **권장 시점**: analyze 매치율 ≥ 90% AND 🔴 Critical 0건 (정적 통과) 이후
- **절차**:
  0. **기준선 캡처**: 런타임 검증 진입 직전 `git add -A`로 현재 상태를 index에 스냅샷한다.
     - 검증·iterate가 만드는 수정분은 stage하지 않는다 — `git diff`로 식별한다.
     - 정식 커밋은 5단계에서만 한다 (이 단계에서 커밋 금지).
  1. Claude가 **이번 사이클에서 실제 구현된 내용**(design §6 테스트 계획 + do 산출물)에 맞춰 런타임 검증 체크리스트를 **동적 생성**한다 (고정 목록 아님 — 매 사이클 구현물 기준으로 새로 제시).
  2. 사용자에게 항목을 제시 → **사용자가 직접 실행·확인**.
  3. 항목별 통과/실패를 보고받는다.
- **통과** → 1단계(`/pdca report`) 진행. report "기능 테스트" 항목을 실제 결과로 채움.
- **실패** → 실패 항목을 `03-analysis.md` 갭 목록에 등재 → `/pdca iterate`. (정적 매치율과 무관하게 런타임 실패는 갭)
- ⚠️ Claude는 봇을 실행할 수 없어 자체 통과 처리 불가 — 검증 실행은 사용자가 한다.

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
| 🧪 | 런타임 검증 중 |
| 🔄 | 진행 중 |
| ⏸️ | 보류 |
| ⏱️ | 대기 중 |

## 우선순위

- ⭐⭐⭐ (P0): 핵심 기능
- ⭐⭐ (P1): 사용자 경험 개선
- ⭐ (P2): 품질 보증
