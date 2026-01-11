# SystemLogger 사용 가이드

> SystemLogger는 구조화된 컨텍스트 기반 로깅을 제공하는 로거 시스템입니다.

---

## 목차

1. [기본 사용법](#기본-사용법)
2. [고급 기능](#고급-기능)
3. [마이그레이션 가이드](#마이그레이션-가이드)

---

## 기본 사용법

### 1. 전역 로거 사용

```typescript
// 어디서든 사용 가능 (import 불필요)
globalLogger.info("서버 시작됨");
globalLogger.warn("캐시 미스");
globalLogger.error("DB 연결 실패", error);
```

### 2. 커스텀 로거 생성

```typescript
const logger = createGlobalLogger("MyModule");

logger.debug("디버그 메시지");
logger.info("정보 메시지");
logger.warn("경고 메시지");
logger.error("에러 메시지", new Error("Something went wrong"));
```

### 3. 컨텍스트 추가

```typescript
const logger = createGlobalLogger("API");

logger.info("사용자 로그인 성공", {
  userId: "12345",
  username: "john",
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0...",
});

// 출력:
// [2026-01-11 15:30:45 (KST)] INFO [API] 사용자 로그인 성공
// Context: {
//   "userId": "12345",
//   "username": "john",
//   "ipAddress": "192.168.1.1",
//   "userAgent": "Mozilla/5.0..."
// }
```

---

## 고급 기능

### 1. 성능 측정

```typescript
const logger = createGlobalLogger("Performance");

const stopTimer = logger.startTimer("크롤링 작업");
await performCrawling();
stopTimer();

// 출력:
// [2026-01-11 15:30:45 (KST)] DEBUG [Performance] 크롤링 작업 completed
// Context: { "duration": "1250ms" }
```

### 2. Child Logger (계층적 로거)

```typescript
const parentLogger = createGlobalLogger("API");
const childLogger = parentLogger.child("UserController");

parentLogger.info("API 서버 시작");
// [API] API 서버 시작

childLogger.info("사용자 조회");
// [API:UserController] 사용자 조회
```

### 3. Success Logger (성공 로그, 녹색)

```typescript
const logger = createGlobalLogger("Deploy");

logger.success("배포 완료!", {
  version: "2.1.0",
  environment: "production",
});

// 출력 (녹색):
// [2026-01-11 15:30:45 (KST)] INFO [Deploy] ✅ 배포 완료!
```

### 4. 로그 레벨

- `DEBUG`: 디버깅 정보
- `INFO`: 일반 정보
- `WARN`: 경고
- `ERROR`: 에러

---

## 마이그레이션 가이드

### DebugLogger → SystemLogger 매핑

| DebugLogger 메서드 | SystemLogger 메서드 | 비고 |
|-------------------|-------------------|------|
| `DebugLogger.server(msg)` | `globalLogger.info(msg)` | 일반 정보 |
| `DebugLogger.request(msg)` | `createGlobalLogger('request').info(msg)` | 요청별 로거 |
| `DebugLogger.crawler(msg, data)` | `createGlobalLogger('crawler').debug(msg, data)` | 디버그 레벨 |
| `DebugLogger.provider(msg, provider)` | `createGlobalLogger('provider:' + provider).debug(msg)` | Child logger |
| `DebugLogger.error(msg, err)` | `globalLogger.error(msg, err)` | 에러 로깅 |
| `DebugLogger.fail(msg)` | `globalLogger.error(msg)` | 에러 로깅 |
| `DebugLogger.warn(msg)` | `globalLogger.warn(msg)` | 경고 로깅 |

### 마이그레이션 예시

#### Before (DebugLogger)

```typescript
import type { Request } from "express";

export async function handleRequest(req: Request) {
  DebugLogger.server("요청 시작");

  try {
    const data = await fetchData();
    DebugLogger.crawler("데이터 조회 완료", { count: data.length });
    return data;
  } catch (error) {
    DebugLogger.error("요청 처리 실패", error as Error);
    throw error;
  }
}
```

#### After (SystemLogger)

```typescript
import { createGlobalLogger } from "@/common/utils";

const logger = createGlobalLogger("RequestHandler");

export async function handleRequest(req: Request) {
  logger.info("요청 시작", {
    method: req.method,
    path: req.path,
    userAgent: req.headers["user-agent"],
  });

  const stopTimer = logger.startTimer("요청 처리");

  try {
    const data = await fetchData();
    stopTimer();

    logger.debug("데이터 조회 완료", {
      count: data.length,
      source: "database",
    });

    return data;
  } catch (error) {
    stopTimer();

    logger.error("요청 처리 실패", error as Error, {
      method: req.method,
      path: req.path,
    });

    throw error;
  }
}
```

**개선 효과**:
- ✅ 더 상세한 컨텍스트 (method, path, userAgent)
- ✅ 성능 측정 자동화 (stopTimer)
- ✅ 구조화된 로그 (JSON)
- ✅ 에러 발생 시에도 컨텍스트 보존

---

## 레거시 코드 (DebugLogger)

기존 코드는 그대로 동작합니다:

```typescript
DebugLogger.server("서버 메시지");
DebugLogger.crawler("크롤링 메시지", { data: "..." });
DebugLogger.error("에러", new Error("..."));
```

점진적으로 마이그레이션하시면 됩니다.

---

*참고: [로깅 시스템 개선 보고서](../../../.claude/todo/review/logging-system-improvement-report.md)*
