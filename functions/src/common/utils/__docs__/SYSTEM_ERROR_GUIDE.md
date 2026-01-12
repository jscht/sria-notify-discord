# SystemError 사용 가이드

> SystemError는 시스템 내부 에러를 위한 구조화된 에러 클래스입니다.

---

## 목차

1. [기본 사용법](#기본-사용법)
2. [에러 처리 유틸리티](#에러-처리-유틸리티)
3. [EventBus 통합](#eventbus-통합)
4. [실전 예시](#실전-예시)
5. [마이그레이션 가이드](#마이그레이션-가이드)

---

## 기본 사용법

### 1. 팩토리 메서드 사용 (권장)

```typescript
import { CrawlerStrategy } from "@/crawlers";

// 크롤러 에러 (타입 안전 컨텍스트)
throw SystemError.crawlerFailed("사람인 크롤링 실패", {
  strategy: CrawlerStrategy.RECRUIT,  // 필수: 크롤링 전략
  provider: "saramin",
  url: "https://www.saramin.co.kr",
  statusCode: 503,
  retryCount: 3,
  timeout: 30000
});

// 프록시 크롤러 에러
throw SystemError.crawlerFailed("프록시 크롤링 실패", {
  strategy: CrawlerStrategy.PROXY,  // 필수: 프록시 전략
  proxyUrl: "http://proxy.example.com:8080",
  statusCode: 503
});

// Redis 캐시 에러
try {
  await redisClient.get("jobs:cache");
} catch (error) {
  throw SystemError.redisError("Redis 조회 실패", error as Error, {
    operation: "get",
    key: "jobs:cache"
  });
}

// Firestore 데이터베이스 에러
try {
  await firestore.collection("jobs").add(data);
} catch (error) {
  throw SystemError.firestoreError("채용 공고 저장 실패", error as Error, {
    collection: "jobs",
    operation: "add"
  });
}

// Discord API 에러
try {
  await client.channels.send(message);
} catch (error) {
  throw SystemError.discordApiError("메시지 전송 실패", error as Error, {
    channelId: "123456789",
    messageLength: message.length
  });
}

// Hugging Face AI API 에러
try {
  const result = await hfClient.inference(model, input);
} catch (error) {
  throw SystemError.huggingFaceError("AI 모델 호출 실패", error as Error, {
    model: "gpt2",
    inputLength: input.length
  });
}

// Firebase 배포 에러 (CRITICAL)
throw SystemError.deploymentError("Functions 배포 실패", deployError, {
  stage: "predeploy",
  command: "npm run build"
});

// 네트워크 에러 (HttpError로 자동 변환)
throw SystemError.networkError("서비스 일시 사용 불가", undefined, {
  statusCode: 503,
  url: "https://api.example.com"
});
throw SystemError.networkError("요청 타임아웃", timeoutError, {
  statusCode: 408,
  timeout: 30000
});
throw SystemError.networkError("게이트웨이 타임아웃", undefined, {
  statusCode: 504
});
// statusCode가 없으면 500으로 처리
throw SystemError.networkError("알 수 없는 네트워크 에러", networkError);

// 검증 에러 (WARNING)
throw SystemError.validationError("잘못된 입력 형식", {
  field: "email",
  value: "invalid-email",
  expected: "user@example.com"
});

// 타임아웃 에러
throw SystemError.timeoutError("크롤링 타임아웃", {
  timeout: 30000,
  url: "https://example.com"
});

// 치명적 에러
throw SystemError.critical("시스템 초기화 실패", error, {
  stage: "database-connection"
});
```

### 2. 에러 래핑

```typescript
try {
  await someExternalLibrary();
} catch (error) {
  throw SystemError.wrap(
    error,
    "외부 라이브러리 호출 실패",
    {
      category: ErrorCategory.REDIS,
      level: ErrorLevel.FAILURE,
      context: { library: "axios", version: "1.0.0" }
    }
  );
}
```

### 3. 팩토리 메서드 목록

#### Application Layer

| 메서드 | 레벨 | 카테고리 | 복구 가능 |
|--------|------|----------|-----------|
| `SystemError.crawlerFailed()` | FAILURE | CRAWLER | ✅ |
| `SystemError.eventBusError()` | FAILURE | EVENT_BUS | ❌ |
| `SystemError.authError()` | FAILURE | AUTH | ❌ |
| `SystemError.validationError()` | WARNING | VALIDATION | ✅ |

#### Integration Layer - External Services

| 메서드 | 레벨 | 카테고리 | 복구 가능 |
|--------|------|----------|-----------|
| `SystemError.redisError()` | FAILURE | REDIS | ✅ |
| `SystemError.firestoreError()` | FAILURE | FIRESTORE | ❌ |
| `SystemError.discordApiError()` | FAILURE | DISCORD_API | ✅ |
| `SystemError.huggingFaceError()` | FAILURE | HUGGING_FACE | ✅ |

#### Infrastructure Layer

| 메서드 | 레벨 | 카테고리 | 복구 가능 |
|--------|------|----------|-----------|
| `SystemError.deploymentError()` | CRITICAL | FIREBASE_DEPLOYMENT | ❌ |
| `SystemError.timeoutError()` | FAILURE | TIMEOUT | ✅ |

#### 네트워크 에러

네트워크 관련 에러는 **HttpError**를 사용하여 HTTP 상태 코드와 함께 처리합니다.

```typescript
// SystemError 대신 HttpError 사용
throw new HttpError(503, "서비스 일시 사용 불가");
throw new HttpError(408, "요청 타임아웃");
throw new HttpError(504, "게이트웨이 타임아웃");
```

#### General

| 메서드 | 레벨 | 카테고리 | 복구 가능 |
|--------|------|----------|-----------|
| `SystemError.critical()` | CRITICAL | UNKNOWN | ❌ |
| `SystemError.warning()` | WARNING | UNKNOWN | ✅ |

---

## 에러 처리 유틸리티

### 1. withErrorHandler

try-catch 보일러플레이트 제거

```typescript
import { withErrorHandler, ErrorCategory } from "@/common/utils";

// 기본 사용
const data = await withErrorHandler(
  async () => await fetchData(),
  {
    category: ErrorCategory.EXTERNAL_API,
    message: "데이터 페칭 실패"
  }
);

// 폴백 사용
const data = await withErrorHandler(
  async () => await fetchData(),
  {
    category: ErrorCategory.EXTERNAL_API,
    message: "데이터 페칭 실패",
    fallback: () => defaultData
  }
);

// 에러 재발생
await withErrorHandler(
  async () => await criticalOperation(),
  {
    category: ErrorCategory.DATABASE,
    message: "DB 작업 실패",
    rethrow: true  // 에러를 다시 throw
  }
);

// 이벤트 발행 비활성화
await withErrorHandler(
  async () => await logOnlyOperation(),
  {
    category: ErrorCategory.VALIDATION,
    message: "검증 실패",
    emitEvent: false  // EventBus 발행 안 함
  }
);
```

### 2. withRetry

재시도 로직 내장

```typescript
import { withRetry, ErrorCategory } from "@/common/utils";

// 기본 재시도
const result = await withRetry(
  async () => await unstableAPI(),
  {
    maxRetries: 3,
    retryDelay: 1000,
    category: ErrorCategory.EXTERNAL_API,
    message: "API 호출 실패"
  }
);

// 커스텀 재시도 조건
const result = await withRetry(
  async () => await apiCall(),
  {
    maxRetries: 5,
    retryDelay: 2000,
    category: ErrorCategory.EXTERNAL_API,
    message: "API 호출 실패",
    shouldRetry: (error) => {
      // 네트워크 에러만 재시도
      return error instanceof NetworkError;
    }
  }
);
```

### 3. allSettledWithErrors

Promise.all 대체 (일부 실패해도 성공한 것들은 반환)

```typescript
import { allSettledWithErrors, ErrorCategory } from "@/common/utils";

const results = await allSettledWithErrors(
  [
    fetchJobsFromSaramin(),
    fetchJobsFromJobKorea(),
    fetchJobsFromIncruit()
  ],
  {
    category: ErrorCategory.CRAWLER,
    message: "채용 공고 크롤링 실패"
  }
);

// results = [성공한 결과들]
// 실패한 것들은 자동으로 SystemError로 이벤트 발행
```

### 4. errorBoundary

최상위 catch 블록

```typescript
import { errorBoundary, ErrorCategory } from "@/common/utils";

// Express 라우트 최상위
app.get("/api/jobs", async (req, res) => {
  const result = await errorBoundary(
    async () => {
      return await getJobs();
    },
    {
      category: ErrorCategory.DATABASE,
      message: "채용 공고 조회 실패",
      fallbackValue: []
    }
  );

  res.json(result);
});
```

---

## EventBus 통합

### 자동 이벤트 발행

SystemError가 생성되면 자동으로 EventBus에 이벤트가 발행됩니다.

**매핑**:
- `ErrorLevel.CRITICAL` → `EventType.SYSTEM_ERROR_CRITICAL`
- `ErrorLevel.FAILURE` → `EventType.SYSTEM_ERROR_FAILURE`
- `ErrorLevel.WARNING` → `EventType.SYSTEM_ERROR_WARNING`

### 이벤트 핸들러 등록

```typescript
import { eventBus } from "@/eventBus/EventBus";
import { EventType } from "@/eventBus/types";

// 치명적 에러 핸들러 (즉시 조치 필요)
eventBus.onEvent(EventType.SYSTEM_ERROR_CRITICAL, async (payload) => {
  const { error } = payload;

  // 개발자에게 긴급 알림 발송
  await sendDevAlert(`🚨 CRITICAL: ${error.message}`);

  // 사용자에게 서비스 중단 안내
  await notifyAllUsers("서비스 일시 중단");
});

// 실패 에러 핸들러 (모니터링)
eventBus.onEvent(EventType.SYSTEM_ERROR_FAILURE, async (payload) => {
  const { error } = payload;

  // 모니터링 시스템에 기록
  await logToMonitoring(error);

  // 필요시 개발자 알림 (덜 긴급)
  if (error.category === ErrorCategory.FIRESTORE) {
    await sendDevAlert(`❌ Firestore Error: ${error.message}`);
  }
});

// 경고 에러 핸들러 (로깅만)
eventBus.onEvent(EventType.SYSTEM_ERROR_WARNING, async (payload) => {
  const { error } = payload;

  // 경고 수준의 이슈 로깅
  await logWarningToMonitoring(error);
});
```

---

## 실전 예시

### 예시 1: 크롤러 에러 처리

```typescript
// Before
async function crawlSaramin(url: string): Promise<Job[]> {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const jobs = parseJobs(html);
    return jobs;
  } catch (error) {
    DebugLogger.error("사람인 크롤링 실패", error);
    throw error;
  }
}

// After
async function crawlSaramin(url: string): Promise<Job[]> {
  return await withRetry(
    async () => {
      const response = await fetch(url);

      if (!response.ok) {
        throw SystemError.crawlerFailed("HTTP 에러", {
          provider: "saramin",
          url,
          statusCode: response.status
        });
      }

      const html = await response.text();
      const jobs = parseJobs(html);

      return jobs;
    },
    {
      maxRetries: 3,
      retryDelay: 2000,
      category: ErrorCategory.CRAWLER,
      message: "사람인 크롤링 실패",
      shouldRetry: (error) => {
        // 5xx 에러만 재시도
        if (error instanceof SystemError) {
          return error.context?.statusCode >= 500;
        }
        return true;
      }
    }
  );
}
```

**개선 효과**:
- ✅ 재시도 로직 자동화
- ✅ 에러 컨텍스트 풍부 (provider, url, statusCode)
- ✅ 자동 로깅 및 이벤트 발행
- ✅ 5xx 에러만 재시도하는 커스텀 로직

### 예시 2: 데이터베이스 에러 처리

```typescript
// Before
async function saveJobs(jobs: Job[]): Promise<void> {
  try {
    const batch = firestore.batch();

    for (const job of jobs) {
      const docRef = firestore.collection("jobs").doc();
      batch.set(docRef, job);
    }

    await batch.commit();
  } catch (error) {
    DebugLogger.error("채용 공고 저장 실패", error);
    throw new Error("DB 저장 실패");
  }
}

// After
async function saveJobs(jobs: Job[]): Promise<void> {
  await withErrorHandler(
    async () => {
      const batch = firestore.batch();

      for (const job of jobs) {
        const docRef = firestore.collection("jobs").doc();
        batch.set(docRef, job);
      }

      await batch.commit();
    },
    {
      category: ErrorCategory.FIRESTORE,
      message: "채용 공고 저장 실패",
      level: ErrorLevel.FAILURE,
      context: {
        collection: "jobs",
        count: jobs.length,
        operation: "batch-write"
      },
      rethrow: true
    }
  );
}
```

**개선 효과**:
- ✅ 에러 자동 래핑 (원본 에러 보존)
- ✅ 풍부한 컨텍스트 (collection, count, operation)
- ✅ 자동 로깅 및 이벤트 발행

### 예시 3: 여러 크롤러 동시 실행

```typescript
// Before
async function crawlAll(): Promise<Job[]> {
  const results = await Promise.allSettled([
    crawlSaramin(),
    crawlJobKorea(),
    crawlIncruit()
  ]);

  const jobs: Job[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      jobs.push(...result.value);
    } else {
      DebugLogger.error("크롤링 실패", result.reason);
    }
  }

  return jobs;
}

// After
async function crawlAll(): Promise<Job[]> {
  const results = await allSettledWithErrors(
    [
      crawlSaramin(),
      crawlJobKorea(),
      crawlIncruit()
    ],
    {
      category: ErrorCategory.CRAWLER,
      message: "크롤링 실패"
    }
  );

  return results.flat();
}
```

**개선 효과**:
- ✅ 코드 간결성 (보일러플레이트 제거)
- ✅ 자동 에러 처리 (실패한 것들은 자동으로 SystemError 이벤트 발행)

---

## 마이그레이션 가이드

### HttpError vs SystemError 구분

| 용도 | HttpError | SystemError |
|------|-----------|-------------|
| **목적** | HTTP API 응답 | 시스템 내부 에러 |
| **대상** | 클라이언트 | 로깅, 모니터링, EventBus |
| **정보** | statusCode, message | level, category, context, originalError |
| **자동 로깅** | ❌ | ✅ |
| **EventBus** | ❌ | ✅ |

### 올바른 사용

```typescript
// ✅ HTTP API 응답용
app.get("/api/jobs/:id", async (req, res, next) => {
  const job = await getJob(req.params.id);

  if (!job) {
    throw new HttpError(404, "채용 공고를 찾을 수 없습니다");
  }

  res.json(job);
});

// ✅ 시스템 에러용
try {
  await firestore.collection("jobs").add(data);
} catch (error) {
  throw SystemError.firestoreError("Firestore 저장 실패", error as Error);
}
```

### 마이그레이션 매핑

| Before | After |
|--------|-------|
| `DebugLogger.error(msg, error)` + `throw error` | `throw SystemError.wrap(error, msg)` |
| `throw new Error(msg)` | `throw SystemError.crawlerFailed(msg)` (카테고리별) |
| `throw new HttpError(500, msg)` (시스템 에러) | `throw SystemError.firestoreError(msg)` |
| try-catch + 로깅 | `withErrorHandler()` |
| while 재시도 로직 | `withRetry()` |
| Promise.allSettled 수동 처리 | `allSettledWithErrors()` |

### ErrorCategory 변경 사항

| 이전 (Deprecated) | 새 카테고리 | 비고 |
|------------------|------------|------|
| `DATABASE` | `FIRESTORE` | Firestore 전용 |
| `EXTERNAL_API` | Provider별 세분화 | `REDIS`, `HUGGING_FACE` 등 |
| `PROXY` | `CRAWLER` + context | `{ strategy: 'proxy' }` |
| `NETWORK` | `HttpError` 사용 | HTTP 상태 코드와 함께 처리 |
| - | `FIREBASE_DEPLOYMENT` | 배포 에러 전용 (신규) |
| - | `CrawlerErrorContext` | 크롤러 에러 타입 안전성 (신규) |

---

*참고: [에러 처리 시스템 개선 보고서](../../../.claude/todo/review/error-system-improvement-report.md)*
