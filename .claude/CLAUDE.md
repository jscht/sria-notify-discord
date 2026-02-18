# SRIA Notify Discord

사람인 에이전트 단기알바 채용공고 알림 Discord Bot

## 기술 스택

- **Runtime**: Node.js 18 + TypeScript 5.1
- **Platform**: Firebase Functions (asia-northeast3)
- **Framework**: Express 4.21 + discord.js 14.17
- **DB/Cache**: Firestore + Redis (3-tier 캐싱)
- **Scraping**: Playwright 1.47
- **Architecture**: Event-Driven (EventBus 패턴)

## 빌드 & 실행

```bash
cd functions
npm run build          # TypeScript 컴파일
npm run build:watch    # Watch 모드
npm run serve          # 빌드 + 에뮬레이터
npm run dev            # Watch + 에뮬레이터 (개발)
npm run lint           # ESLint
```

## 프로젝트 구조

- @ARCHITECTURE.md

## 작업 관리

- @.claude/phases/PROGRESS.md

## 언어

- 코드 주석, 커밋 메시지, 문서: 한국어
