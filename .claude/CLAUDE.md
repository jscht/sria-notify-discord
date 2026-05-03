# Overview

## 핵심 원칙

### 1. 자동화 우선
Claude automatically applies PDCA methodology on task requests.
Slash commands are shortcuts for users who want to explicitly trigger specific steps.

### 2. 단일 진실 공급원 (SoT) 우선순위
1순위: Codebase (actual working code)
2순위: CLAUDE.md / .claude/rules/ docs
3순위: .claude/phases/ 설계 docs

### 3. 추측 금지 (No Guessing)
- Unknown → Check documentation
- Not in docs → Ask user
- Never guess

## 응답 스타일

- 설계, 분석, 검토 요청이 아닌 경우 **짧게 답변** (1~3문장 또는 핵심 항목만)
- 단순 사실 확인, yes/no 질문, 상태 조회는 한 문장으로 종료
- 코드 변경 후 요약, 결정 사항 보고도 2~3줄 이내

## 기술 스택

- @.claude/docs/tech-stack.md

## 코딩 컨벤션

- @.claude/docs/coding-conventions.md

## 언어

- 코드 주석, 커밋 메시지, 문서: 한국어, 영어

## 일일 태스크 트래커

- `.claude/docs/todo.md` — 일일 ad-hoc 작업 체크리스트
- 사용자가 "TODO 첫 번째부터" 등으로 지시하면 이 파일을 먼저 읽고 가장 위 미완료 항목 처리
- Phase 단위 큰 작업은 TODO가 아닌 PDCA 사이클 사용 (`/pdca plan X.Y`)
- 세션 종료 시 진행 상황을 todo.md에 반영 (체크박스 갱신, 완료 섹션 이동)
- 자세한 액션은 `/todo` 스킬 참조

## 설계·계획·기능 구현 요청 처리

사용자가 설계, 계획, 기능 구현을 요청하는 경우:

1. `/pdca` 스킬 사용 여부를 먼저 물어본다:
   "PDCA 스킬(`/pdca plan X.Y`)을 사용하시겠습니까?"
2. 동의하면: `pdca-status.json`에서 Phase 번호 확인 후 `/pdca plan X.Y` 스킬 실행
3. 거부하면: 기존 PDCA 문서(`docs/phase-X-Y/`)가 있으면 읽고 진행, 없으면 바로 구현 진행

## 참조 문서 (필요 시 읽기)

- README.md — 프로젝트 개요
- .claude/docs/ARCHITECTURE.md — 시스템 아키텍처, 계층 구조, 데이터 흐름
- .claude/docs/build-deploy.md — 빌드, 배포, 실행 명령어
- .claude/docs/pdca-status.json — Phase별 PDCA 상태
- .claude/agents/README.md — 에이전트 계층, 협업, 출력 포맷
