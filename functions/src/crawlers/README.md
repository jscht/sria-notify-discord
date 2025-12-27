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
│   ├── RecruitScheduler.ts     ← 채용공고 스케줄러 (4시간 간격)
│   ├── ProxyScheduler.ts       ← 프록시 스케줄러 (6시간 간격)
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
  proxyInterval: 6 * 60 * 60 * 1000,   // 6시간 (하루 4번)
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
manager.startProxyScheduler(6 * 60 * 60 * 1000);

// 상태 확인
const recruitStatus = manager.getStatus("recruit");
const proxyStatus = manager.getStatus("proxy");
console.log(`Recruit Running: ${recruitStatus?.isRunning}`);
console.log(`Proxy Running: ${proxyStatus?.isRunning}`);

// 개별 정지
manager.stopRecruitScheduler();
manager.stopProxyScheduler();

// 모든 스케줄러 정지
manager.stopAll();
```

### 크롤러 직접 사용

```typescript
import { SriaCrawler, ProxyCrawler } from "@/crawlers/strategies";

// 채용공고 크롤링
const sriaCrawler = new SriaCrawler();
const recruitData = await sriaCrawler.crawl();

// 프록시 크롤링
const proxyCrawler = new ProxyCrawler();
const proxyData = await proxyCrawler.crawl();
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

### ProxyData

```typescript
interface ProxyData {
  ipAddress: string;
  port: number | null;
  type: string | null;
  latency: number;
  lastCheckStatus: string | null;
  available: boolean;
  used: boolean;
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

## ⏰ 스케줄러 실행 주기

| 스케줄러 | 주기 | 설명 |
|---------|------|------|
| RecruitScheduler | 4시간 | 하루 6번 채용공고 갱신 |
| ProxyScheduler | 6시간 | 하루 4번 프록시 목록 갱신 |

## ⚙️ 환경 변수

```env
SRIA_URL=https://...   # 사람인 크롤링 URL
PROXY_URL=https://...  # 프록시 크롤링 URL
```
