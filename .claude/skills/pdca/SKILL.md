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
  - "status", "현황", "다음" → status/next 액션

  사용하지 않는 경우: PDCA 컨텍스트 없는 단순 질문, 코드만 수정하는 작업
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
---

# PDCA Skill

> Phase 기반 PDCA 전체 사이클 관리. Plan → Design → Do → Check(Analyze) → Act(Iterate) → Report → Archive → Cleanup.

## 상태 파일

| 파일 | 용도 | 읽기 시점 |
|------|------|----------|
| `.claude/docs/pdca-memory.json` | 현재 작업 포인터 (~50 토큰) | next, 사이클 내 모든 액션 |
| `.claude/docs/pdca-status.json` | 전체 상태 DB + 대시보드 | status, 사이클 완료 후 next |

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
2. 브랜치 생성/체크아웃 (`.claude/rules/git-workflow.md` 브랜치 네이밍 규칙 준수)
   - 이미 존재하면: checkout, 없으면: dev 기반으로 신규 생성
   - 실패 시 plan 중단 + 수동 생성 안내
3. `.claude/templates/plan.template.md` 구조로 `docs/phase-{{X}}-{{Y}}/01-plan.md` 생성
4. pdca-memory.json 업데이트: `phase = "plan"`
5. pdca-status.json features에 항목 생성

### design [X.Y] — Design Phase

1. Plan 문서 존재 확인 (없으면 plan 먼저 실행 안내)
2. `.claude/templates/design.template.md` 구조로 `docs/phase-{{X}}-{{Y}}/02-design.md` 생성
3. pdca-memory.json 업데이트: `phase = "design"`

### do [X.Y] — Do Phase

1. Design 문서 존재 확인 (필수)
2. `.claude/templates/do-guide.template.md` 기반으로 구현 가이드 **출력만** (파일 생성 없음)
3. pdca-memory.json 업데이트: `phase = "do"`

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
8. matchRate < 90% 또는 🔴 Critical 이슈 존재 시 → 이슈 알림 출력 (D 포맷)

### iterate [X.Y] — Act Phase

1. matchRate < 90% 확인 (≥ 90%이면 report 안내)
2. analysis.md의 갭 목록 기반 자동 코드 수정
3. 수정 후 자동 재분석 (analyze 재실행)
4. 최대 5회 반복, matchRate ≥ 90% 도달 시 중단
5. pdca-memory.json 업데이트: `matchRate`, pdca-status.json features `iterationCount++`

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
2. `phase`가 completed/archived가 **아닌** 경우 (사이클 진행 중):
   - memory만으로 다음 PDCA 단계 안내
3. `phase`가 completed/archived이거나 memory가 비어있는 경우:
   - pdca-status.json의 priority, dependencies, tasks 읽기
   - 다음 feature 선택 로직:
     1. **의존성 충족**: dependencies에서 선행 feature가 모두 completed/archived인지 확인
     2. **우선순위**: 충족된 feature 중 priority P0 → P1 → P2 순서
     3. **배열 순서**: 같은 등급 내 배열 순서 (= core 문서 순서)
     4. **제외**: phase가 null이 아닌 feature는 후보에서 제외 (이미 사이클 진입/완료)

**Phase 가이드**:
| 현재 | 다음 | 안내 |
|------|------|------|
| plan | design | `/pdca design X.Y` |
| design | do | `/pdca do X.Y` |
| do | analyze | `/pdca analyze X.Y` |
| check (< 90%) | iterate | `/pdca iterate X.Y` |
| check (≥ 90%) | report | `/pdca report X.Y` |
| completed | archive | `/pdca archive X.Y` |
| archived/없음 | plan | priority + dependencies 기반 다음 feature 추천 |

---

## PDCA 사이클 흐름

```
/pdca plan X.Y
    │  phase-X-core.md (읽기) + plan.template → plan.md (생성)
    ▼
/pdca design X.Y
    │  plan.md (읽기) + design.template → design.md (생성)
    ▼
/pdca do X.Y
    │  design.md (읽기) + do-guide.template → 구현 가이드 출력
    ▼
  [구현 작업]
    ▼
/pdca analyze X.Y
    │  design.md + 코드 (읽기) + analysis.template → analysis.md (생성)
    ▼
  matchRate < 90%? ──► /pdca iterate X.Y (자동 수정 → 재분석, 최대 5회)
       │                                         │
       ≥ 90%                              재분석 ┘
       ▼
/pdca report X.Y
    │  docs/phase-X-Y/ (읽기) + report.template → report.md (생성)
    │  피드백 → 승인 대기 → 수정
    ▼
/pdca archive X.Y
    │  docs/phase-X-Y/ → docs/archive/phase-X-Y/
    ▼
/pdca cleanup
```

---

## 쓰기 프로토콜

### 원칙: memory 우선, status 지연 동기화

- **매 액션**: pdca-memory.json만 업데이트 (~50 토큰)
- **status 동기화**: 특정 시점에만 pdca-status.json 업데이트
- **overview 재계산**: 동기화 시점에 tasks 배열에서 `phase !== null` (사이클 완료: completed/archived) 카운트하여 재집계

### 쓰기 순서

0. **Plan 모드 검사**: Plan 모드 활성 시 진행할 액션을 한 줄 알린 뒤 `ExitPlanMode` 호출,
   승인 시 1번부터 진행. 거절 시 쓰기 생략하고 분석 결과만 출력.
   메시지 형식: `PDCA <action> X.Y 쓰기 단계로 진입합니다. 승인 후 파일을 작성합니다.`
   (`<action>` ∈ `plan` / `design` / `analyze` / `report`)
1. 작업 수행 (문서 생성/수정)
2. pdca-status.json 업데이트 (상태 변경 요약에서 해당 액션이 "동기화:"인 경우만)
3. pdca-memory.json 업데이트 (항상 마지막)

> status 먼저 → memory 마지막. status 쓰기 실패 시 memory가 이전 상태를 유지하여 재시도 가능.

### 상태 전이 규칙

허용된 전이만 수행. 위반 시 사용자에게 경고 후 중단.

```
plan → design → do → check → iterate(반복) → report → archive → cleanup
                              ↑_______________|
                              (matchRate < 90%)
```

| 현재 phase | 허용되는 다음 phase |
|-----------|-------------------|
| (없음) | plan |
| plan | design |
| design | do |
| do | check |
| check | iterate, report (matchRate ≥ 90%) |
| iterate | check (재분석) |
| completed | archive |
| archived | cleanup, plan (새 feature) |

### feature 전환 규칙

새 feature로 `/pdca plan X.Y` 실행 시:
1. 현재 memory의 feature 상태를 pdca-status.json에 flush
2. memory를 새 feature로 덮어쓰기

### 작업 중단 규칙

| 상황 | tasks flush | memory 처리 |
|------|-------------|-------------|
| 일시 중단 | 불필요 | 유지 |
| 타 작업 전환 (PDCA 외 작업) | 현재 상태 flush | null 초기화 |
| feature 전환 (`/pdca plan X.Y`) | 기존 전환 규칙 적용 | 새 feature로 덮어쓰기 |

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
| 작업 전환 (PDCA 외) | 현재 상태 flush 후 null 초기화 | memory → tasks flush |

---

## 템플릿 참조

| 액션 | 템플릿 | 결과 파일 |
|------|--------|----------|
| plan | `.claude/templates/plan.template.md` | `docs/phase-X-Y/01-plan.md` |
| design | `.claude/templates/design.template.md` | `docs/phase-X-Y/02-design.md` |
| do | `.claude/templates/do-guide.template.md` | (출력만) |
| analyze | `.claude/templates/analysis.template.md` | `docs/phase-X-Y/03-analysis.md` |
| report | `.claude/templates/report.template.md` | `docs/phase-X-Y/04-report.md` |
