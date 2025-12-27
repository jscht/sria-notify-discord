# Crawlers 모듈

크롤링 전략과 스케줄러를 관리하는 모듈입니다.

## 📁 폴더 구조

```
crawlers/
├── strategies/                 ← 크롤링 전략들
│   ├── base/                   ← 기본 크롤러 추상 클래스
│   ├── recruit/                ← 채용공고 크롤링
│   │   ├── utils/              ← 채용공고 유틸리티
│   │   └── sria/               ← 사람인 크롤러
│   └── proxy/                  ← 프록시 크롤링
│
├── schedulers/                 ← 스케줄러 관리
│   ├── base/                   ← 기본 스케줄러 추상 클래스
│   ├── utils/                  ← 스케줄러 유틸리티
│   ├── RecruitScheduler.ts     ← 채용공고 스케줄러
│   └── SchedulerManager.ts     ← 스케줄러 관리자 (Singleton)
│
├── utils/                      ← 공통 유틸리티
├── types.ts                    ← 크롤러 공통 타입
└── index.ts                    ← 전체 export
```

## 🚀 사용법

### 기본 사용 (권장)

```typescript
import { initializeSchedulers, setupGracefulShutdown } from "@/crawlers/schedulers";
import { CRAWL_MODE } from "@/common/constants";

// 스케줄러 초기화
const manager = initializeSchedulers({
  recruitInterval: 4 * 60 * 60 * 1000, // 4시간
  recruitMode: CRAWL_MODE.DUMMY,
});

// Graceful shutdown 설정
setupGracefulShutdown(manager);
```

### 직접 제어

```typescript
import { SchedulerManager } from "@/crawlers/schedulers";
import { CRAWL_MODE } from "@/common/constants";

// 스케줄러 관리자 획득
const manager = SchedulerManager.getInstance();

// 스케줄러 시작
manager.startRecruitScheduler(4 * 60 * 60 * 1000, CRAWL_MODE.CRAWL);

// 상태 확인
const status = manager.getStatus("recruit");
console.log(`Running: ${status?.isRunning}`);
console.log(`Next run: ${status?.nextRunTime}`);

// 모든 스케줄러 정지
manager.stopAll();
```

### 크롤러 직접 사용

```typescript
import { SriaCrawler } from "@/crawlers/strategies/recruit";

const crawler = new SriaCrawler();
const data = await crawler.crawl();
console.log(data);
```

## 📝 타입

### RecruitData

```typescript
interface RecruitData {
  href: string;
  title: string;
  dDay: string;
  dayTxt: string;
  recruitmentStatus: "접수중" | "발표중" | "종료";
}
```

### SchedulerStatus

```typescript
interface SchedulerStatus {
  isRunning: boolean;
  lastRunTime: Date | null;
  nextRunTime: Date | null;
  totalRunCount: number;
  lastError: Error | null;
  workDurationMs: number | null;
}
```

## ⚙️ 환경 변수

```env
SRIA_URL=https://...   # 사람인 크롤링 URL
PROXY_URL=https://...  # 프록시 크롤링 URL
```
