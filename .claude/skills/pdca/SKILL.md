---
name: pdca
description: |
  Phase 기반 PDCA 전체 사이클을 관리합니다.
  plan→design→do→analyze→iterate→report→archive→cleanup 전 과정을 지원하며,
  .claude/docs/pdca-status.json으로 상태를 추적합니다.

  다음 상황에서 반드시 사용하세요:
  - "plan", "계획", "설계", "design" → plan/design 액션
  - "do", "구현 시작", "작업 시작" → do 액션
  - "analyze", "갭 분석", "체크리스트 확인" → analyze 액션
  - "iterate", "반복 개선", "매치율 올려" → iterate 액션
  - "report", "보고서", "완료" → report 액션
  - "archive", "아카이브" → archive 액션
  - "현황", "진행률", "어디까지 왔어" 등 전체 상태 → status 액션
  - "다음", "다음 단계/작업", "뭐 해야/뭐 하지" 등 다음 행동 질문 → next 액션
  - pdca 맥락인데 액션 단어가 모호하면 → next 우선 (read-only·경량). 전체 대시보드는 "현황" 명시 시 status

  사용하지 않는 경우: PDCA 신호가 전혀 없는 일반 질문(→ todo), 코드만 수정하는 작업
  상세 분기: .claude/rules/task-routing.md
argument-hint: "[action] [phase-X.Y]"
user-invocable: true
state-file: .claude/docs/pdca-memory.json
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Agent
---

# PDCA Skill

> Phase 기반 PDCA 전체 사이클 관리. Plan → Design → Do → Check(Analyze) → Act(Iterate) → Report → Archive → Cleanup.

## 상태 파일

| 파일 | 용도 | 읽기 시점 |
|------|------|----------|
| `.claude/docs/pdca-memory.json` | 현재 작업 포인터 (~50 토큰) | next, 사이클 내 모든 액션 |
| `.claude/docs/pdca-status.json` | 전체 상태 DB + 대시보드 | status, 사이클 완료 후 next |
| `.claude/docs/suspended.json` | 타 작업 전환 시 임시 스냅샷 (memory + feature) | 작업 복귀 시 next |

## 액션

| 액션 | 사용법 | 설명 |
|------|--------|------|
| `plan [X.Y]` | `/pdca plan 1.4` | Phase 계획서 생성 |
| `design [X.Y]` | `/pdca design 1.4` | 기술 설계서 생성 |
| `do [X.Y]` | `/pdca do 1.4` | 구현 가이드 출력 |
| `analyze [X.Y]` | `/pdca analyze 1.4` | 설계 vs 코드 갭 분석 |
| `iterate [X.Y]` | `/pdca iterate 1.4` | 자동 수정 + 재분석 |
| `report [X.Y]` | `/pdca report 1.4` | 완료 보고서 생성 |
| `archive [X.Y]` | `/pdca archive 1.4` | 문서 아카이브 |
| `cleanup` | `/pdca cleanup` | 아카이브된 항목 정리 |
| `status` | `/pdca status` | 전체 현황 출력 |
| `next` | `/pdca next` | 다음 단계 안내 |

---

## 액션 상세

### plan [X.Y] — Plan Phase

1. `.claude/phases/phase-{{X}}-core.md` 시드 읽기 + X.Y feature 이름 확인
2. **CTO Lead 에이전트 호출** → 의존성·우선순위 검증 + 위임 후보 도메인 에이전트 1~2개 지정
3. CTO 위임안 출력 → **사용자 승인 대기** (승인 전 다음 단계 진행 금지)
   - 수정 요청 시 CTO Lead 재호출 → 2번 복귀
   - 승인 시 4번 진행
4. 브랜치 생성/체크아웃 (`.claude/rules/git-workflow.md` 브랜치 네이밍 규칙 준수)
   - 이미 존재하면: checkout, 없으면: dev 기반으로 신규 생성
   - 실패 시 plan 중단 + 수동 생성 안내
5. `.claude/templates/plan.template.md` 구조로 `docs/phase-{{X}}-{{Y}}/01-plan.md` 생성 — `§위임 계획` 섹션에 CTO Lead 결과 반영
6. pdca-memory.json 업데이트: `phase = "plan"`
7. pdca-status.json features에 항목 생성

### design [X.Y] — Design Phase

1. Plan 문서 존재 확인 (없으면 plan 먼저 실행 안내)
2. **CTO Lead 에이전트 호출** → 크로스커팅 판단(Discord ↔ Integration ↔ AI 경계) + design.md 작성자 위임 결정
3. CTO 위임안 출력 → **사용자 승인 대기** (승인 전 다음 단계 진행 금지)
4. 승인 시 위임된 도메인 에이전트가 `.claude/templates/design.template.md` 구조로 `docs/phase-{{X}}-{{Y}}/02-design.md` 작성
5. **Design Validator 에이전트 호출** → 설계 품질 게이트
6. pdca-memory.json 업데이트: `phase = "design"`

### do [X.Y] — Do Phase

1. Design 문서 존재 확인 (필수)
2. **CTO Lead 에이전트 호출** → plan.md `§위임 계획` + design.md 영역 매핑 기반 실제 구현 위임안 작성 (`.claude/templates/do-guide.template.md` 가이드를 위임안에 포함)
3. CTO 위임안 출력 → **사용자 승인 대기** (승인 전 다음 단계 진행 금지)
4. 승인 시 영역별 도메인 에이전트에 구현 위임:
   - Discord UI → Discord Agent (+ Frontend Architect 협업)
   - 서비스/캐시 → Integration Lead (Backend Expert 위임)
   - AI/NLP → AI Agent
   - 데이터 스키마 단독 → Backend Expert
5. 각 에이전트가 코드 작성 후 CTO Lead가 통합 보고 출력
6. pdca-memory.json 업데이트: `phase = "do"`

### analyze [X.Y] — Check Phase

1. 구현 코드 존재 확인
2. **Gap Detector 에이전트 호출** → 설계 ↔ 구현 갭 분석 (Structural/Functional/Contract)
3. **Code Analyzer 에이전트 호출** → 코드 품질/보안/DRY 분석
4. 두 결과를 `.claude/templates/analysis.template.md` 구조로 통합하여 `docs/phase-{{X}}-{{Y}}/03-analysis.md` 생성
   - §1~§3: Gap Detector 결과 (3차원 갭 테이블 + 매치율)
   - §4~§5: Code Analyzer 결과 (이슈 목록 + 컨벤션 준수)
5. 매치율 산출: `Structural × 0.2 + Functional × 0.4 + Contract × 0.4`
6. pdca-memory.json 업데이트: `phase = "check"`, `matchRate`
7. pdca-status.json tasks/features 업데이트
8. **CTO Lead 에이전트 호출** (matchRate < 90% OR 🔴 Critical ≥ 1건 시 필수, 그 외 생략 가능)
   → analysis.md 사후 종합 평가, 다음 단계 권장(report/iterate), iterate 시 위임 대상 사전 결정
9. CTO 위임안 출력 → **사용자 승인 대기** (승인 전 다음 단계 진행 금지)
10. 승인 시 권장된 다음 단계로 분기
11. matchRate < 90% 또는 🔴 Critical 이슈 존재 시 → 이슈 알림 출력 (D 포맷)
12. (선택) matchRate ≥ 90% 시 사용자에게 **런타임 검증**을 제안할 수 있다(강제 아님). 사용자가 선택하면 구현물 기준 체크리스트를 동적 생성해 진행하고 실패 항목은 iterate로 환류한다. 수행 절차는 `.claude/rules/review-process.md` 0단계 참조

### iterate [X.Y] — Act Phase

1. matchRate < 90% 확인 (≥ 90%이면 report 안내)
2. **첫 진입인 경우만**: CTO Lead 에이전트 호출 → 갭 위치별 수정 위임안 출력 → **사용자 승인 대기** (1회)
   - analyze 단계에서 이미 위임 대상이 결정되어 있으면 그 결과 재사용 (CTO Lead 호출 생략 가능)
3. 승인된 위임안에 따라 영역별 도메인 에이전트가 analysis.md 갭 목록 기반 자동 코드 수정
4. 수정 후 자동 재분석 (analyze 재실행) — CTO Lead 재승인 없이 자동 진행
5. 최대 5회 반복, matchRate ≥ 90% 도달 시 중단
6. 5회 도달 후에도 matchRate < 90%면 CTO Lead 재호출 → 블로커 판정 + 사용자 의사결정 요청
7. pdca-memory.json 업데이트: `matchRate`, pdca-status.json features `iterationCount++`

### report [X.Y] — Completion Report

1. matchRate ≥ 90% 확인 (미만이면 경고)
2. **Report Generator 에이전트 호출** → plan, design, analysis 문서를 종합한 보고서 초안 수신
3. report.template.md 포맷으로 검증 후 `docs/phase-{{X}}-{{Y}}/04-report.md` 생성
4. **피드백 → 승인 대기 → 수정** 프로세스 적용 (review-process.md 규칙 준수)
5. pdca-memory.json 업데이트: `phase = "completed"`, `completedAt`

> ⚠️ 피드백 수신 시 즉시 반영하지 않음. 수정 계획 제시 → 사용자 승인 → 진행.

### archive [X.Y] — Archive Phase

1. Report 완료 확인 (phase = "completed")
2. `docs/phase-{{X}}-{{Y}}/` 폴더째 `docs/archive/phase-{{X}}-{{Y}}/` 로 이동
3. pdca-memory.json 업데이트: `phase = "archived"`
4. pdca-status.json tasks/features 업데이트 (documents 경로를 archive 경로로 갱신)

**이동 결과**:
```
docs/archive/phase-{{X}}-{{Y}}/
  ├── 01-plan.md
  ├── 02-design.md
  ├── 03-analysis.md
  └── 04-report.md
```

### cleanup — Cleanup Phase

1. pdca-status.json에서 archived 상태인 features 확인
2. 해당 features 항목의 이력을 tasks 배열로 이동:
   - tasks 해당 항목에 `description`, `startedAt`, `completedAt` 필드 추가
   - 기존 `documents`, `matchRate`, `phase` 유지
3. features에서 해당 항목 완전 삭제
4. pdca-memory.json 전부 null 초기화
5. overview 수치 갱신

> **사이클 마감 핸드오프 (cleanup 직후)**:
> ① archive/cleanup 변경 포함 논리 단위 commit → push → PR(base dev)
> ② PR 머지 → `git checkout dev && git pull`
> ③ `/pdca next`로 다음 feature 추천 → `/pdca plan X.Y`(최신 dev 기반 새 브랜치)
> 커밋/PR은 **사용자 지시 시에만** 수행. 상세 순서는 `.claude/rules/review-process.md` 검토 단계 참조.

### status — Status Check

1. pdca-status.json 읽기
2. pdca-memory.json 읽기 (현재 작업 포인터)
3. 전체 현황 출력 (A: 대시보드 포맷):

**출력 포맷**:
```
📊 프로젝트 현황
━━━━━━━━━━━━━━━━━━━━━━━
전체: XX/YY (ZZ%)
Phase 1: XX% │ Phase 2: XX% │ Phase 3: XX% │ Phase 4: XX%
━━━━━━━━━━━━━━━━━━━━━━━
🔄 현재: Phase X.Y - [작업명]
   PDCA 단계: [plan/design/do/check/iterate]
   매치율: XX% (check 이후만)

⏭️ 다음: Phase X.Y - [작업명]
   조건: [의존성 또는 선행 조건]

⚠️ 블로커 (있을 때만)
   - [의존성 미충족 / 장기 정체 등]

📋 최근 완료 (최대 3건)
   ✅ Phase X.Y - [작업명] (YYYY-MM-DD)
━━━━━━━━━━━━━━━━━━━━━━━
우선순위 작업 (의존성 충족 + P0 우선):
1. [P0] phase-X-Y-name
2. [P1] phase-X-Y-name
```

**블로커 감지 기준**:
- 현재 Phase의 dependencies에서 선행 feature가 미완료
- 검토 중(check) 상태가 7일 이상 지속
- iterate 5회 도달 후 매치율 < 90%

**이슈 감지 시**: 이슈 알림 (D 포맷)으로 추가 출력

```
⚠️ 이슈 알림
| # | 유형 | 심각도 | 내용 | 관련 Phase | 조치 |
|---|------|--------|------|-----------|------|
| 1 | 블로커 | 🔴 | ... | X.Y | ... |
```

### next — Next Phase Guide

**분기 로직**:

1. pdca-memory.json 읽기
   - (a) suspended.json 존재 시:
     - `memory` 키 → pdca-memory.json으로 재삽입
     - `feature` 키 → pdca-status.json features 항목으로 재삽입
     - 파일 삭제 → 2번으로 진행
2. `phase`가 있는 경우 (plan ~ archived):
   - 사이클 흐름 테이블에서 다음 명령 안내
3. memory가 비어있는 경우 (없음):
   - pdca-status.json의 priority, dependencies, tasks 읽기
   - 다음 feature 선택 로직 → `/pdca plan X.Y` 안내:
     1. **의존성 충족**: dependencies에서 선행 feature가 모두 completed/archived인지 확인
     2. **우선순위**: 충족된 feature 중 priority P0 → P1 → P2 순서
     3. **배열 순서**: 같은 등급 내 배열 순서 (= core 문서 순서)
     4. **제외**: phase가 null이 아닌 feature는 후보에서 제외 (이미 사이클 진입/완료)

---

## PDCA 사이클 흐름

```
plan → design → do → [구현] → analyze
  matchRate < 90%? → iterate (재분석, 최대 5회)
  matchRate ≥ 90%? → report → archive → cleanup
                       → commit + PR(base dev) → 머지 → checkout dev → next
```

| 현재 phase | 다음 명령 |
|-----------|---------|
| plan | `/pdca design X.Y` |
| design | `/pdca do X.Y` |
| do | `/pdca analyze X.Y` |
| check (< 90%) | `/pdca iterate X.Y` |
| check (≥ 90%) | `/pdca report X.Y` |
| completed | `/pdca archive X.Y` |
| archived | `/pdca cleanup` |
| 없음 | `/pdca next` |

> `check (≥ 90%)`에서 report 전에 **선택적 런타임 검증**(review-process.md 0단계)을 사용자에게 제안할 수 있다 (강제 아님).
> 런타임 검증 진입 전 `git add -A`로 기준선을 스냅샷한다. 수정분은 stage하지 않고 `git diff`로 식별하며, 커밋은 5단계에서만 한다 (review-process.md 0단계).

> cleanup 완료 후 phase가 비워지기 전에 **commit → PR(base dev) → 머지 → dev 동기화**를 거친 뒤 `/pdca next` (상세: `.claude/rules/review-process.md`).

---

## 쓰기 프로토콜

- **매 액션**: pdca-memory.json만 업데이트 (~50 토큰), pdca-status.json은 특정 시점에만 동기화
- **overview 재계산**: 동기화 시점에 tasks 배열에서 `phase !== null` 카운트하여 재집계
- **쓰기 순서**: ① 작업 수행 → ② status 동기화 (해당 액션만) → ③ memory 업데이트 (항상 마지막)
- **Plan 모드**: 활성 시 `PDCA <action> X.Y 쓰기 단계로 진입합니다.` 알림 후 ExitPlanMode 호출, 거절 시 분석 결과만 출력 (`<action>` ∈ plan/design/analyze/report)

> status 먼저 → memory 마지막. status 쓰기 실패 시 memory가 이전 상태를 유지하여 재시도 가능.

**상태 전이**: `(없음)→plan→design→do→check⇄iterate→report→archive→cleanup`
허용된 전이만 수행, 위반 시 경고 후 중단.
- check → iterate (matchRate < 90%) / report (≥ 90%)
- archived → cleanup 또는 plan (새 feature)

### 전환·중단 규칙

| 상황 | tasks flush | memory 처리 |
|------|-------------|-------------|
| 일시 중단 | 불필요 | 유지 |
| 타 작업 전환 (PDCA 외 작업) | features에 flush 후 해당 항목을 suspended.json[feature]로 이동 (features에서 제거) | suspended.json[memory] 저장 후 null 초기화 (단일 슬롯, 하나의 작업만 보관) |
| feature 전환 (`/pdca plan X.Y`) | 기존 feature flush | 새 feature로 덮어쓰기 |

> suspended.json이 이미 존재하면 덮어쓰기 전에 기존 내용(feature, phase)을 사용자에게 알리고 확인 대기.
> Claude는 사용자의 PDCA 외 작업 의도(예: "다른 작업하자", "잠깐 X 보고 올게")를 감지하면 진행 중 작업 정보를 제시하고 전환 확인을 받은 뒤 본 절차를 자율 수행한다. (별도 슬래시 명령 없음)

### 상태 변경 요약

| 액션 | pdca-memory.json | pdca-status.json |
|------|-----------------|-----------------|
| plan | feature, phase="plan", startedAt | 동기화: features 항목 생성 + 이전 feature flush |
| design | phase="design" | (지연) |
| do | phase="do" | (지연) |
| analyze | phase="check", matchRate | (지연) |
| iterate | matchRate 갱신 | (지연) |
| report | phase="completed", completedAt | 동기화: tasks + features 업데이트 |
| archive | phase="archived" | 동기화: tasks + features 업데이트 |
| cleanup | 전부 null | 동기화: features 삭제, tasks에 이력(description/startedAt/completedAt) 추가, overview 재계산 |
| status | (변경 없음) | 동기화: overview 재계산 |
| next | (변경 없음) | 조건부 동기화: 사이클 완료 시 overview 재계산 |
| 작업 전환 (PDCA 외) | suspended.json[memory] 저장 후 null 초기화 | features 해당 항목을 suspended.json[feature]로 이동 (features에서 제거) |

---

## CTO Lead 게이트 규칙

- plan / design / do / analyze 액션 입구·출구에서 CTO Lead 호출 시, 위임안 출력 후 **사용자 승인 대기**
- 승인 전까지 다음 단계 진행 금지 (`.claude/rules/review-process.md` 원칙과 동일)
- iterate는 첫 진입에서만 승인. 이후 자동 루프 (최대 5회), 5회 도달 후에도 matchRate < 90%면 CTO Lead 재호출 (블로커 판정)
- analyze에서 matchRate ≥ 90% AND 🔴 Critical 0건이면 CTO Lead 호출 생략 가능 (비용 절감)
- CTO 위임안 표준 포맷: `의존성/선행 조건` + `위임 계획 표(영역/위임 대상/근거/예상 산출물)` + `리스크(있을 때만)` + `다음 단계 권장(analyze 종합 평가일 때만)` + `승인 여부: y / 수정 / 거부`
- report / archive / cleanup / status / next 액션은 CTO Lead 통합 미적용

---

## 템플릿 참조

| 액션 | 템플릿 | 결과 파일 |
|------|--------|----------|
| plan | `.claude/templates/plan.template.md` | `docs/phase-X-Y/01-plan.md` |
| design | `.claude/templates/design.template.md` | `docs/phase-X-Y/02-design.md` |
| do | `.claude/templates/do-guide.template.md` | (출력만) |
| analyze | `.claude/templates/analysis.template.md` | `docs/phase-X-Y/03-analysis.md` |
| report | `.claude/templates/report.template.md` | `docs/phase-X-Y/04-report.md` |
