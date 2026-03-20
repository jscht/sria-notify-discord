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

1. `.claude/phases/phase-{{X}}-core.md` 시드 읽기
2. `.claude/templates/plan.template.md` 구조로 `docs/01-plan/phases/phase-{{X}}-{{Y}}.plan.md` 생성
3. pdca-memory.json 업데이트: `phase = "plan"`
4. pdca-status.json features에 항목 생성

**출력 파일**: `docs/01-plan/phases/phase-{{X}}-{{Y}}.plan.md`

### design [X.Y] — Design Phase

1. Plan 문서 존재 확인 (없으면 plan 먼저 실행 안내)
2. `.claude/templates/design.template.md` 구조로 `docs/02-design/phases/phase-{{X}}-{{Y}}.design.md` 생성
3. pdca-memory.json 업데이트: `phase = "design"`

**출력 파일**: `docs/02-design/phases/phase-{{X}}-{{Y}}.design.md`

### do [X.Y] — Do Phase

1. Design 문서 존재 확인 (필수)
2. `.claude/templates/do-guide.template.md` 기반으로 구현 가이드 **출력만** (파일 생성 없음)
3. pdca-memory.json 업데이트: `phase = "do"`

**출력만**: 파일 생성 없음

### analyze [X.Y] — Check Phase

1. 구현 코드 존재 확인
2. Design 문서와 실제 코드를 비교 (설계 §번호 기반)
3. `.claude/templates/analysis.template.md` 구조로 `docs/03-analysis/phases/phase-{{X}}-{{Y}}.analysis.md` 생성
4. 매치율 산출: `(완전일치 + 부분일치 × 0.5) / 전체항목 × 100`
5. pdca-memory.json 업데이트: `phase = "check"`, `matchRate`
6. pdca-status.json tasks/features 업데이트

**출력 파일**: `docs/03-analysis/phases/phase-{{X}}-{{Y}}.analysis.md`

### iterate [X.Y] — Act Phase

1. matchRate < 90% 확인 (≥ 90%이면 report 안내)
2. analysis.md의 갭 목록 기반 자동 코드 수정
3. 수정 후 자동 재분석 (analyze 재실행)
4. 최대 5회 반복, matchRate ≥ 90% 도달 시 중단
5. pdca-memory.json 업데이트: `matchRate`, pdca-status.json features `iterationCount++`

**반복 제한**: 최대 5회

### report [X.Y] — Completion Report

1. matchRate ≥ 90% 확인 (미만이면 경고)
2. plan, design, analysis 문서 전체 읽기
3. `.claude/templates/report.template.md` 구조로 `docs/04-report/phases/phase-{{X}}-{{Y}}.report.md` 생성
4. **피드백 → 승인 대기 → 수정** 프로세스 적용 (review-process.md 규칙 준수)
5. pdca-memory.json 업데이트: `phase = "completed"`, `completedAt`

> ⚠️ 피드백 수신 시 즉시 반영하지 않음. 수정 계획 제시 → 사용자 승인 → 진행.

**출력 파일**: `docs/04-report/phases/phase-{{X}}-{{Y}}.report.md`

### archive [X.Y] — Archive Phase

1. Report 완료 확인 (phase = "completed")
2. 4개 문서를 `docs/archive/` 로 이동:
   - `docs/01-plan/phases/phase-{{X}}-{{Y}}.plan.md`
   - `docs/02-design/phases/phase-{{X}}-{{Y}}.design.md`
   - `docs/03-analysis/phases/phase-{{X}}-{{Y}}.analysis.md`
   - `docs/04-report/phases/phase-{{X}}-{{Y}}.report.md`
3. 원본 삭제
4. pdca-memory.json 업데이트: `phase = "archived"`
5. pdca-status.json tasks/features 업데이트

### cleanup — Cleanup Phase

1. pdca-status.json에서 archived 상태인 features 확인
2. 해당 항목 삭제
3. overview 수치 갱신

### status — Status Check

1. pdca-status.json 읽기
2. 전체 현황 출력:
   - overview (Phase별 진행률)
   - priority (우선순위 작업)
   - 현재 진행 중인 feature

**출력 예시**:
```
PDCA 전체 현황
─────────────────────────────
전체 진행률: 16/85 (18.8%)

Phase 1: 16/41 (39.0%)
Phase 2: 0/12 (0%)
Phase 3: 0/15 (0%)
Phase 4: 0/17 (0%)
─────────────────────────────
우선순위 작업:
1. [P0] phase-1-11-debuglogger-migration (in-progress)
2. [P0] phase-1-4-notification-store (waiting)
3. [P0] phase-1-5-notification-settings-ui (waiting)
```

### next — Next Phase Guide

**분기 로직**:

1. pdca-memory.json 읽기
2. `phase`가 completed/archived가 **아닌** 경우 (사이클 진행 중):
   - memory만으로 다음 PDCA 단계 안내
3. `phase`가 completed/archived이거나 memory가 비어있는 경우:
   - pdca-status.json의 priority 배열 읽기
   - 우선순위 + 의존성 기반으로 다음 feature 추천

**Phase 가이드**:
| 현재 | 다음 | 안내 |
|------|------|------|
| plan | design | `/pdca design X.Y` |
| design | do | `/pdca do X.Y` |
| do | analyze | `/pdca analyze X.Y` |
| check (< 90%) | iterate | `/pdca iterate X.Y` |
| check (≥ 90%) | report | `/pdca report X.Y` |
| completed | archive | `/pdca archive X.Y` |
| archived/없음 | plan | priority 기반 다음 feature 추천 |

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
    │  design.md (읽기) + do-guide.template → 출력
    ▼
  [구현 작업]
    ▼
/pdca analyze X.Y
    │  design.md + 코드 (읽기) + analysis.template → analysis.md (생성)
    │  matchRate 산출
    ▼
  ┌── matchRate < 90% ──────────────┐
  │  /pdca iterate X.Y               │
  │  자동 수정 → 재분석 (최대 5회)    │
  └── matchRate ≥ 90% ◄─────────────┘
    ▼
/pdca report X.Y
    │  전체 문서 (읽기) + report.template → report.md (생성)
    │  피드백 → 승인 대기 → 수정
    ▼
/pdca archive X.Y
    │  문서 이동 + 원본 삭제
    ▼
/pdca cleanup
    아카이브된 항목 정리
```

---

## 쓰기 프로토콜

### 원칙: memory 우선, status 지연 동기화

- **매 액션**: pdca-memory.json만 업데이트 (~50 토큰)
- **status 동기화**: 특정 시점에만 pdca-status.json 업데이트
- **overview 재계산**: 동기화 시점에 tasks 배열에서 `status === "completed"` 카운트하여 재집계

### 동기화 시점

| 시점 | 동기화 대상 |
|------|-----------|
| `status` 실행 | overview 재계산 (tasks 기반) |
| `next` (사이클 완료 시) | overview 재계산 + priority 참조 |
| `report` 실행 | tasks status + features 업데이트 |
| `archive` 실행 | tasks status + features 업데이트 |
| `plan` 실행 (신규 feature) | features 항목 생성 + 이전 feature flush |
| `cleanup` 실행 | features 삭제 + overview 재계산 |

### 쓰기 순서

1. 작업 수행 (문서 생성/수정)
2. pdca-status.json 업데이트 (동기화 시점인 경우만)
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

### 상태 변경 요약

| 액션 | pdca-memory.json | pdca-status.json |
|------|-----------------|-----------------|
| plan | feature, phase="plan", startedAt | 동기화: features 항목 생성 |
| design | phase="design" | (지연) |
| do | phase="do" | (지연) |
| analyze | phase="check", matchRate | (지연) |
| iterate | matchRate 갱신 | (지연) |
| report | phase="completed", completedAt | 동기화: tasks + features 업데이트 |
| archive | phase="archived" | 동기화: tasks + features 업데이트 |
| cleanup | (초기화) | 동기화: features 삭제, overview 재계산 |
| status | (변경 없음) | 동기화: overview 재계산 |
| next | (변경 없음) | 조건부 동기화: 사이클 완료 시 overview 재계산 |

---

## 템플릿 참조

| 액션 | 템플릿 | 결과 파일 |
|------|--------|----------|
| plan | `.claude/templates/plan.template.md` | `docs/01-plan/phases/phase-X-Y.plan.md` |
| design | `.claude/templates/design.template.md` | `docs/02-design/phases/phase-X-Y.design.md` |
| do | `.claude/templates/do-guide.template.md` | (출력만) |
| analyze | `.claude/templates/analysis.template.md` | `docs/03-analysis/phases/phase-X-Y.analysis.md` |
| report | `.claude/templates/report.template.md` | `docs/04-report/phases/phase-X-Y.report.md` |
