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
// 크롤러 에러
throw SystemError.crawlerFailed("사람인 크롤링 실패", {
  provider: "saramin",
  url: "https://www.saramin.co.kr",
  statusCode: 503
});

// 데이터베이스 에러
try {
  await firestore.collection("jobs").add(data);
} catch (error) {
  throw SystemError.databaseError("채용 공고 저장 실패", error as Error, {
    collection: "jobs",
    operation: "add"
  });
}

// 외부 API 에러
try {
  const response = await fetch("https://api.example.com/data");
} catch (error) {
  throw SystemError.externalApiError("API 호출 실패", error as Error, {
    endpoint: "/data",
    method: "GET"
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

// 프록시 에러 (CRITICAL)
throw SystemError.proxyError("프록시 서버 전체 불가", {
  availableProxies: 0,
  totalProxies: 10
});

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
      category: ErrorCategory.EXTERNAL_API,
      level: ErrorLevel.FAILURE,
      context: { library: "axios", version: "1.0.0" }
    }
  );
}
```

### 3. 팩토리 메서드 목록

| 메서드 | 레벨 | 카테고리 | 복구 가능 |
|--------|------|----------|-----------|
| `SystemError.crawlerFailed()` | FAILURE | CRAWLER | ✅ |
| `SystemError.databaseError()` | FAILURE | DATABASE | ❌ |
| `SystemError.externalApiError()` | FAILURE | EXTERNAL_API | ✅ |
| `SystemError.discordApiError()` | FAILURE | DISCORD_API | ✅ |
| `SystemError.eventBusError()` | FAILURE | EVENT_BUS | ❌ |
| `SystemError.proxyError()` | CRITICAL | PROXY | ❌ |
| `SystemError.authError()` | FAILURE | AUTH | ❌ |
| `SystemError.validationError()` | WARNING | VALIDATION | ✅ |
| `SystemError.timeoutError()` | FAILURE | TIMEOUT | ✅ |
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
  if (error.category === ErrorCategory.DATABASE) {
    await sendDevAlert(`❌ DB Error: ${error.message}`);
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
      category: ErrorCategory.DATABASE,
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
  throw SystemError.databaseError("DB 저장 실패", error as Error);
}
```

### 마이그레이션 매핑

| Before | After |
|--------|-------|
| `DebugLogger.error(msg, error)` + `throw error` | `throw SystemError.wrap(error, msg)` |
| `throw new Error(msg)` | `throw SystemError.crawlerFailed(msg)` (카테고리별) |
| `throw new HttpError(500, msg)` (시스템 에러) | `throw SystemError.databaseError(msg)` |
| try-catch + 로깅 | `withErrorHandler()` |
| while 재시도 로직 | `withRetry()` |
| Promise.allSettled 수동 처리 | `allSettledWithErrors()` |

---

*참고: [에러 처리 시스템 개선 보고서](../../../.claude/todo/review/error-system-improvement-report.md)*
