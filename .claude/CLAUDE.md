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

## 기술 스택

- @.claude/docs/tech-stack.md

## 코딩 컨벤션

- @.claude/docs/coding-conventions.md

## 언어

- 코드 주석, 커밋 메시지, 문서: 한국어, 영어

## 참조 문서 (필요 시 읽기)

- README.md — 프로젝트 개요
- .claude/docs/ARCHITECTURE.md — 시스템 아키텍처, 계층 구조, 데이터 흐름
- .claude/docs/build-deploy.md — 빌드, 배포, 실행 명령어
- .claude/docs/pdca-status.json — Phase별 PDCA 상태
- .claude/agents/README.md — 에이전트 계층, 협업, 출력 포맷
