# 로깅 시스템 개선 보고서

> 작성일: 2026-01-11
> 작업 범위: Phase 1 로깅 시스템 전면 개선

---

## 📋 목차

1. [개요](#개요)
2. [이전 시스템의 문제점](#이전-시스템의-문제점)
3. [개선 사항](#개선-사항)
4. [새로운 시스템 아키텍처](#새로운-시스템-아키텍처)
5. [사용 가이드](#사용-가이드)
6. [마이그레이션 가이드](#마이그레이션-가이드)

---

## 개요

프로젝트의 로깅 시스템을 단순한 문자열 기반 로깅에서 구조화된 컨텍스트 기반 로깅으로 전면 개선했습니다.

### 개선 목표

1. **구조화된 로깅**: 문자열 → 구조화된 데이터
2. **일관성**: 전역에서 접근 가능한 표준화된 로거
3. **디버깅 향상**: 컨텍스트 정보와 성능 측정 기능
4. **하위 호환성**: 기존 코드 40개 파일 영향 최소화

---

## 이전 시스템의 문제점

### 핵심 문제점

1. **단순 문자열 로깅**: 구조화 안 됨, JSON 형식 아님
2. **컨텍스트 부족**: 타임스탬프, 소스, 메타데이터 없음
3. **성능 측정 불가**: 내장 타이머 없음
4. **로그 레벨 암시적**: 메서드 이름으로만 구분 (server, crawler, error)
5. **전역 접근 혼란**: `DebugLogger`라는 이름이 실제 용도와 불일치

### 예시

```typescript
// 이전: 단순한 문자열 출력만 가능
Logger.server("서버 시작됨");
// 출력: [SERVER] 서버 시작됨
// → 언제? 어떤 환경에서? 추가 정보는?

Logger.crawler("크롤링 실패", { url: "https://example.com" });
// → 일관된 형식이 없어서 파싱 어려움
```

---

## 개선 사항

### 1. SystemLogger 클래스 생성

**파일**: `common/utils/systemLogger.ts`

```typescript
export class SystemLogger {
  constructor(private readonly source: string) {}

  debug(message: string, context?: LogContext): void
  info(message: string, context?: LogContext): void
  success(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext): void
  error(message: string, error?: Error, context?: LogContext): void

  startTimer(label: string): () => void
  child(childSource: string): SystemLogger
}
```

**개선 효과**:
- ✅ **명시적 로그 레벨**: DEBUG, INFO, WARN, ERROR
- ✅ **구조화된 로그**: JSON 형식으로 출력
- ✅ **컨텍스트 지원**: 임의의 메타데이터 추가 가능
- ✅ **타임스탬프 자동 추가**: 모든 로그에 시간 정보 포함
- ✅ **소스 추적**: 어떤 모듈에서 발생했는지 명확
- ✅ **성능 측정**: `startTimer()`로 간편한 성능 측정
- ✅ **Child Logger**: 계층적 로거 구조 지원

### 2. 구조화된 로그 형식

```typescript
// 이전
[SERVER] 서버 시작됨

// 개선 후
[2026-01-11 15:30:45 (KST)] INFO [server] 서버 시작됨
Context: {
  "port": 3000,
  "environment": "development",
  "nodeVersion": "18.17.0"
}
```

**개선 효과**:
- ✅ 모니터링 도구(Sentry, Datadog, CloudWatch)로 쉽게 전송
- ✅ 로그 검색/필터링 용이
- ✅ 구조화된 데이터로 분석 가능

### 3. 하위 호환성 유지

기존 `Logger` 클래스를 `SystemLogger`를 내부적으로 사용하도록 재작성:

```typescript
// common/utils/logger.ts (재작성)
class Logger {
  static server = (message: string): void => {
    const logger = createLogger("server");
    logger.info(message);  // SystemLogger 사용
  };

  static error = (message: string, error?: Error): void => {
    const logger = createLogger("server");
    logger.error(message, error);  // SystemLogger 사용
  };
}
```

**개선 효과**:
- ✅ 기존 40개 파일 수정 불필요
- ✅ 기존 코드 그대로 동작
- ✅ 점진적 마이그레이션 가능

### 4. 전역 로거 등록

```typescript
// systemLogger.ts
if (typeof global !== "undefined") {
  (global as any).globalLogger = systemLogger;
  (global as any).createGlobalLogger = createLogger;
}

// logger.ts
if (typeof global !== "undefined") {
  (global as any).DebugLogger = Logger;
}
```

```typescript
// global.d.ts
declare global {
  var DebugLogger: typeof Logger;      // 레거시 (40개 파일 사용)
  var globalLogger: SystemLogger;       // 새 시스템
  var createGlobalLogger: typeof createLogger;  // 팩토리 함수
}
```

**개선 효과**:
- ✅ **레거시**: `DebugLogger` 그대로 사용 가능
- ✅ **신규**: `globalLogger` 또는 `createGlobalLogger()` 사용
- ✅ **타입 안전성**: TypeScript에서 완전한 타입 추론

---

## 새로운 시스템 아키텍처

### 계층 구조

```
┌─────────────────────────────────────────────┐
│           전역 로거 (Global Loggers)          │
├─────────────────────────────────────────────┤
│  DebugLogger (legacy)  │  globalLogger (new) │
│  40개 파일 사용        │  신규 코드 사용      │
└───────────┬─────────────┴──────────┬─────────┘
            │                        │
            ▼                        ▼
    ┌──────────────┐        ┌──────────────┐
    │    Logger    │        │ SystemLogger │
    │  (Wrapper)   │───────▶│   (Core)     │
    └──────────────┘        └──────────────┘
            │                        │
            └────────────┬───────────┘
                         ▼
              ┌─────────────────────┐
              │  Console Output     │
              │  (Formatted JSON)   │
              └─────────────────────┘
```

---

## 사용 가이드

자세한 사용법은 **[SystemLogger 사용 가이드](../../../../functions/src/common/utils/__docs__/SYSTEM_LOGGER_GUIDE.md)** 참조

---

## 요약

| 항목 | 이전 시스템 | 개선 후 시스템 |
|------|-----------|--------------|
| **형식** | 단순 문자열 | 구조화된 JSON |
| **타임스탬프** | ❌ 없음 | ✅ 자동 추가 |
| **컨텍스트** | ❌ 제한적 | ✅ 무제한 메타데이터 |
| **로그 레벨** | ❌ 암시적 | ✅ 명시적 (DEBUG, INFO, WARN, ERROR) |
| **성능 측정** | ❌ 없음 | ✅ startTimer() |
| **계층 구조** | ❌ 없음 | ✅ Child Logger |
| **전역 접근** | ✅ DebugLogger | ✅ globalLogger + DebugLogger (하위 호환) |
| **타입 안전성** | ⚠️ 제한적 | ✅ 완전한 타입 추론 |
| **모니터링 도구 연동** | ❌ 어려움 | ✅ JSON 형식으로 쉬움 |
| **기존 코드 영향** | - | ✅ 없음 (하위 호환) |

---

*작성일: 2026-01-11*
*작성자: Claude Sonnet 4.5*
*상태: 완료*
