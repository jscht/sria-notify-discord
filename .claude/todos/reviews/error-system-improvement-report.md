# 에러 처리 시스템 개선 보고서

> 작성일: 2026-01-11
> 작업 범위: Phase 1 에러 처리 시스템 전면 개선

---

## 📋 목차

1. [개요](#개요)
2. [이전 시스템의 문제점](#이전-시스템의-문제점)
3. [개선 사항](#개선-사항)
4. [새로운 시스템 아키텍처](#새로운-시스템-아키텍처)
5. [사용 가이드](#사용-가이드)
6. [EventBus 통합](#eventbus-통합)

---

## 개요

프로젝트의 에러 처리 시스템을 단순한 에러 처리에서 구조화된 컨텍스트 기반 에러 관리 시스템으로 전면 개선했습니다.

### 개선 목표

1. **구조화된 에러 관리**: 에러 레벨, 카테고리, 컨텍스트 정보 포함
2. **자동화**: 에러 발생 시 자동 로깅 및 이벤트 발행
3. **일관성**: 표준화된 에러 클래스와 팩토리 메서드
4. **EventBus 통합**: 에러를 이벤트로 자동 발행하여 중앙 집중식 처리
5. **HttpError와 분리**: HTTP 응답용 에러와 시스템 내부 에러 명확히 구분

---

## 이전 시스템의 문제점

### 핵심 문제점

1. **HttpError만 존재**: 시스템 내부 에러 처리 불가
2. **에러 처리 파편화**: 파일마다 다른 방식, 원본 에러 정보 손실
3. **에러 정보 부족**: 레벨, 카테고리, 컨텍스트 없음
4. **재시도 로직 중복**: 매번 보일러플레이트 작성
5. **EventBus 통합 없음**: 중앙 집중식 에러 처리 불가

### 예시

```typescript
// 문제 1: HttpError만 존재 (시스템 에러 처리 불가)
throw new HttpError(500, "Internal Server Error");

// 문제 2: 일관성 없는 에러 처리
try {
  await crawlData(url);
} catch (error) {
  DebugLogger.error("크롤링 실패", error);
  throw new Error("크롤링 실패");  // ❌ 원본 에러 정보 손실
}

// 문제 3: 재시도 로직 중복
let retries = 0;
while (retries < 3) {
  try {
    return await fetch(url);
  } catch (error) {
    retries++;
    // ❌ 보일러플레이트 반복
  }
}
```

---

## 개선 사항

### 1. SystemError 클래스 생성

**파일**: `common/utils/systemError.ts`

**핵심 프로퍼티**:
- `level`: ErrorLevel (WARNING, FAILURE, CRITICAL)
- `category`: ErrorCategory (10가지 카테고리)
- `context`: 임의의 메타데이터
- `originalError`: 원본 에러 (에러 체이닝)
- `recoverable`: 복구 가능 여부
- `timestamp`: 발생 시각

**개선 효과**:
- ✅ 에러 레벨 및 카테고리로 분류
- ✅ 자동 로깅 (생성 시 SystemLogger에 기록)
- ✅ 에러 체이닝 및 JSON 직렬화

### 2. 에러 레벨 및 카테고리

**ErrorLevel**: WARNING < FAILURE < CRITICAL

**ErrorCategory**: CRAWLER, DATABASE, EXTERNAL_API, DISCORD_API, EVENT_BUS, PROXY, AUTH, VALIDATION, TIMEOUT, UNKNOWN (10가지)

**개선 효과**:
- ✅ 명확한 심각도 구분
- ✅ EventBus 통합 (레벨별 이벤트 매핑)
- ✅ 카테고리별 필터링 및 모니터링

### 3. 정적 팩토리 메서드 (11개)

```typescript
// 간결한 사용
throw SystemError.crawlerFailed("크롤링 실패", { url: "..." });
throw SystemError.databaseError("DB 저장 실패", error, { collection: "jobs" });
throw SystemError.proxyError("프록시 불가", { count: 0 });
```

**제공 메서드**: crawlerFailed, databaseError, externalApiError, discordApiError, eventBusError, proxyError, authError, validationError, timeoutError, critical, warning, wrap

**개선 효과**:
- ✅ 간결성 및 일관성
- ✅ TypeScript 자동 완성 지원

### 4. 에러 처리 유틸리티

**파일**: `common/utils/errorHandler.ts`

**주요 함수**:
- `withErrorHandler()`: try-catch 자동화, 폴백 지원
- `withRetry()`: 재시도 로직 내장
- `allSettledWithErrors()`: Promise.all 대체 (부분 성공 허용)
- `errorBoundary()`: 최상위 catch 블록
- `normalizeError()`: 에러 정규화
- `emitSystemErrorEvent()`: EventBus 이벤트 발행

**개선 효과**:
- ✅ 보일러플레이트 제거
- ✅ 자동 로깅 및 EventBus 발행
- ✅ 일관된 에러 처리 패턴

### 5. HttpError vs SystemError 명확한 분리

| 항목 | HttpError | SystemError |
|------|-----------|-------------|
| **용도** | HTTP API 응답 | 시스템 내부 에러 |
| **대상** | 클라이언트 | 로깅, 모니터링, EventBus |
| **정보** | statusCode, message | level, category, context, originalError |
| **자동 로깅** | ❌ 없음 | ✅ 자동 |
| **EventBus** | ❌ 없음 | ✅ 자동 발행 |

**개선 효과**:
- ✅ 책임 분리: HTTP 응답과 시스템 에러 명확히 구분
- ✅ 타입 안전성: TypeScript에서 각 에러 타입별 처리 가능

---

## 새로운 시스템 아키텍처

### 계층 구조

```
┌─────────────────────────────────────────────────────────┐
│                   Express 미들웨어                        │
│              (errorHandler.ts)                          │
│  HttpError 처리 + SystemError 자동 변환 및 이벤트 발행    │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │   SystemError 생성    │
         │   (자동 로깅)         │
         └──────────┬───────────┘
                    │
         ┌──────────┴───────────┐
         ▼                      ▼
  ┌─────────────┐      ┌──────────────┐
  │ SystemLogger│      │  EventBus    │
  │  (로그 기록) │      │ (이벤트 발행) │
  └─────────────┘      └──────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Event Handlers  │
                    │  - Discord 알림   │
                    │  - 모니터링 전송  │
                    │  - 에러 복구     │
                    └──────────────────┘
```

### 에러 흐름

```
1. 에러 발생
   ↓
2. SystemError 생성 (팩토리 메서드 사용)
   ↓
3. 자동 로깅 (SystemLogger)
   ↓
4. EventBus 자동 발행
   - ErrorLevel.CRITICAL → EventType.SYSTEM_ERROR_CRITICAL
   - ErrorLevel.FAILURE → EventType.SYSTEM_ERROR_FAILURE
   - ErrorLevel.WARNING → EventType.SYSTEM_ERROR_WARNING
   ↓
5. Event Handlers 실행
   - Discord 알림
   - 모니터링 시스템 전송
   - 에러 복구 로직
```

---

## 사용 가이드

자세한 사용법은 **[SystemError 사용 가이드](../../../functions/src/common/utils/__docs__/SYSTEM_ERROR_GUIDE.md)** 참조

---

## EventBus 통합

### 자동 이벤트 발행

SystemError가 생성되면 자동으로 EventBus에 이벤트가 발행됩니다.

**매핑**:
- `ErrorLevel.CRITICAL` → `EventType.SYSTEM_ERROR_CRITICAL`
- `ErrorLevel.FAILURE` → `EventType.SYSTEM_ERROR_FAILURE`
- `ErrorLevel.WARNING` → `EventType.SYSTEM_ERROR_WARNING`

### 이벤트 핸들러 등록 예시

```typescript
// 치명적 에러 핸들러
eventBus.onEvent(EventType.SYSTEM_ERROR_CRITICAL, async (payload) => {
  await sendDevAlert(`🚨 CRITICAL: ${payload.error.message}`);
  await notifyAllUsers("서비스 일시 중단");
});

// 실패 에러 핸들러
eventBus.onEvent(EventType.SYSTEM_ERROR_FAILURE, async (payload) => {
  await logToMonitoring(payload.error);
});

// 경고 에러 핸들러
eventBus.onEvent(EventType.SYSTEM_ERROR_WARNING, async (payload) => {
  await logWarningToMonitoring(payload.error);
});
```

**개선 효과**:
- ✅ 중앙 집중식 에러 처리
- ✅ 레벨별 처리 (CRITICAL은 긴급 알림, WARNING은 로그만)
- ✅ 확장 가능 (Event Handler 추가로 로직 확장)

### Express 미들웨어 통합

```typescript
// common/middlewares/errorHandler.ts
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // SystemError는 자동으로 이벤트 발행
  if (err instanceof SystemError) {
    emitSystemErrorEvent(err);
    return res.status(500).json({
      error: { message: err.message, level: err.level, category: err.category }
    });
  }

  // HttpError는 그대로 응답
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      error: { message: err.message, code: err.code }
    });
  }

  // 알 수 없는 에러는 SystemError로 변환 후 이벤트 발행
  const systemError = SystemError.wrap(err, "서버 내부 에러", {
    level: ErrorLevel.FAILURE,
    category: ErrorCategory.UNKNOWN,
  });
  emitSystemErrorEvent(systemError);

  return res.status(500).json({ error: { message: "Internal Server Error" } });
};
```

**개선 효과**:
- ✅ 500번대 에러도 SystemError로 변환하여 EventBus 발행
- ✅ HttpError와 SystemError 명확히 구분하여 처리

---

## 요약

| 항목 | 이전 시스템 | 개선 후 시스템 |
|------|-----------|--------------|
| **에러 클래스** | HttpError만 존재 | HttpError (HTTP 응답) + SystemError (시스템 에러) |
| **에러 레벨** | ❌ 없음 | ✅ WARNING, FAILURE, CRITICAL |
| **에러 카테고리** | ❌ 없음 | ✅ 10가지 카테고리 |
| **컨텍스트 정보** | ❌ 제한적 | ✅ 무제한 메타데이터 |
| **자동 로깅** | ❌ 수동 (DebugLogger 호출 필요) | ✅ SystemError 생성 시 자동 |
| **EventBus 통합** | ❌ 없음 | ✅ 자동 이벤트 발행 |
| **에러 체이닝** | ❌ 없음 | ✅ originalError 보존 |
| **복구 가능 여부** | ❌ 없음 | ✅ recoverable 플래그 |
| **팩토리 메서드** | ❌ 없음 | ✅ 11개 정적 메서드 |
| **재시도 로직** | ❌ 수동 작성 | ✅ withRetry() 유틸리티 |
| **에러 처리 유틸** | ❌ 없음 | ✅ withErrorHandler, allSettledWithErrors, errorBoundary |
| **JSON 직렬화** | ❌ 없음 | ✅ toJSON() 메서드 |
| **타임스탬프** | ❌ 없음 | ✅ 자동 추가 |

---

*작성일: 2026-01-11*
*작성자: Claude Sonnet 4.5*
*상태: 완료*
