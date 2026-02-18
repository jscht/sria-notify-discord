# Phase 진행 현황 조회

프로젝트의 전체 진행 현황을 조회하고 요약합니다.

## 작업 순서

1. **PROGRESS.md 조회**
   - `.claude/phases/PROGRESS.md` 파일을 읽음
   - 전체 진행률 테이블 확인

2. **현재 Phase 상세 확인**
   - 현재 진행 중인 Phase의 `.claude/phases/phase-X-*.md` 파일 확인
   - 체크리스트 달성률 계산

3. **요약 출력**
   - 전체 진행률 (완료/전체)
   - 현재 진행 중인 Phase와 상태
   - 다음 예정 Phase
   - 블로커가 있다면 표시

## 출력 형식

```
📊 프로젝트 진행 현황
━━━━━━━━━━━━━━━━━━━

전체: XX/YY (ZZ%)

Phase 1: XX% | Phase 2: XX% | Phase 3: XX% | Phase 4: XX%

🔄 현재: Phase X.Y - [작업명]
⏭️ 다음: Phase X.Y - [작업명]
```
