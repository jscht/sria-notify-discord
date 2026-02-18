# CLAUDE.md 추적/감사

프로젝트 내 모든 CLAUDE.md 파일을 검색하고 현황을 보고합니다.

## 작업 순서

1. **CLAUDE.md 파일 검색**
   - 프로젝트 전체에서 `**/CLAUDE.md`, `**/claude.md`, `**/CLAUDE.local.md` 검색
   - `.claude/rules/*.md` 파일도 포함

2. **각 파일 분석**
   - 위치, 줄 수, 최종 수정일
   - `@path` import 참조 목록
   - 주요 섹션 목록

3. **참조 그래프 표시**
   - 어떤 파일이 어떤 파일을 `@`로 import하는지 시각화

4. **문제 감지**
   - 깨진 `@` import 참조
   - 오래된 정보 (최종 수정일 기준)
   - 중복 지침 감지

## 출력 형식

```
📋 CLAUDE.md 감사 보고서
━━━━━━━━━━━━━━━━━━━━━━

📁 발견된 파일 (N개)
  .claude/CLAUDE.md              (XX줄, YYYY-MM-DD)
  functions/claude.md            (XX줄, YYYY-MM-DD)
  functions/src/claude.md        (XX줄, YYYY-MM-DD)
  ...

🔗 참조 그래프
  .claude/CLAUDE.md
    → @ARCHITECTURE.md
    → @.claude/phases/PROGRESS.md

⚠️ 문제 (있다면)
  - [파일]: 깨진 참조 @path
```
