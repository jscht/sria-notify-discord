# Phase 1.11 설계서: DebugLogger 마이그레이션

**상태**: 🔄 진행 중
**기반 문서**: `docs/phase-1-11/01-plan.md`

---

## 1. 아키텍처 설계

### 1.1 레이어 매핑

| 프로젝트 레이어 | 변경 내용 |
|----------------|----------|
| Common Utils (`functions/src/common/utils/`) | logger.ts 삭제, systemLogger.ts에 LogSource 타입 + 프리셋 로거 추가, index.ts re-export 수정 |
| Common Types (`functions/src/common/types/`) | global.d.ts에서 DebugLogger 타입 선언 제거 |
| Tests (`functions/src/common/utils/__test__/`) | globalLogger.test.ts DebugLogger 테스트 제거, import 경로 수정 |
| Providers (`functions/src/providers/discord/`) | providerLogger 전환 (2개 파일) |
| Events (`functions/src/events/`) | providerLogger 전환 (1개 파일) |
| Middlewares (`functions/src/common/middlewares/`) | providerLogger 전환 (1개 파일) |
| (전체 23개 파일) | side-effect import 경로 전환 |

### 1.2 컴포넌트 다이어그램

```
[systemLogger.ts] ── export ──→ [LogSource 타입]
       │                         [crawlerLogger 프리셋]
       │                         [providerLogger 프리셋]
       │                         [createLogger(source: LogSource)]
       │
       ├── 전역 등록 ──→ global.globalLogger (SystemLogger)
       │                 global.createGlobalLogger (createLogger)
       │
       ├── side-effect import ──→ (23개 파일) import "@/common/utils/systemLogger"
       │
       └── 직접 import ──→ (4개 파일) import { providerLogger }

[logger.ts] ── 삭제 ──→ ✕ (DebugLogger 제거)
[global.d.ts] ── 수정 ──→ ✕ DebugLogger 선언 제거, SystemLogger만 유지
```

---

## 2. 상세 설계

### §2.1 logger.ts 삭제

**파일**: `functions/src/common/utils/logger.ts`

**작업**: 파일 전체 삭제 (65줄)
- Logger 클래스 (7개 static 메서드: debug, info, success, warn, error, startTimer, setLogLevel)
- `global.DebugLogger = Logger` 전역 등록 코드

### §2.2 systemLogger.ts LogSource 타입 추가

**파일**: `functions/src/common/utils/systemLogger.ts`

**타입 정의**:
```typescript
/**
 * 로그 소스 식별자 타입
 * 로거 생성 시 소스를 제약하여 일관된 로그 식별 보장
 */
export type LogSource =
  | "system"
  | "crawler"
  | "provider"
  | "EventBus"
  | "SystemError"
  | "ErrorHandler";
```

**createLogger 시그니처 변경**:
```typescript
// Before
export function createLogger(source: string): SystemLogger

// After
export function createLogger(source: LogSource): SystemLogger
```

### §2.3 프리셋 로거 export

**파일**: `functions/src/common/utils/systemLogger.ts`

```typescript
/** 크롤러 전용 로거 */
export const crawlerLogger = createLogger("crawler");

/** 프로바이더 전용 로거 */
export const providerLogger = createLogger("provider");
```

- 모듈 로드 시 1회 생성, 이후 재사용
- 기존 `createGlobalLogger('provider').debug(...)` 패턴 대체

### §2.4 systemLogger.ts dead import 제거

**파일**: `functions/src/common/utils/systemLogger.ts`

```typescript
// 제거 대상
import Logger from "./logger";
```

### §2.5 index.ts re-export 수정

**파일**: `functions/src/common/utils/index.ts`

```typescript
// 제거
export { default as Logger } from "./logger";

// 추가
export { LogSource, crawlerLogger, providerLogger } from "./systemLogger";
```

### §2.6 global.d.ts DebugLogger 제거

**파일**: `functions/src/common/types/global.d.ts`

```typescript
// 제거 대상
import type Logger from "../utils/logger";
var DebugLogger: typeof Logger;

// 유지
import type { SystemLogger, createLogger } from "../utils/systemLogger";
var globalLogger: SystemLogger;
var createGlobalLogger: typeof createLogger;
```

### §2.7 globalLogger.test.ts 수정

**파일**: `functions/src/common/utils/__test__/globalLogger.test.ts`

- `import "../logger"` → `import "@/common/utils/systemLogger"` 변경
- DebugLogger 테스트 2건 제거 (전역 등록 확인, 메서드 호출 확인)
- 남은 테스트 번호 재정렬 (1~4)

### §2.8 providerLogger 전환 (4곳)

| 파일 | Before | After |
|------|--------|-------|
| `events/onReady.ts` | `createGlobalLogger('provider').debug(...)` | `providerLogger.debug(...)` |
| `common/middlewares/firebaseConnCache.ts` | `createGlobalLogger('provider').debug(...)` + `import "@/common/utils/logger"` | `providerLogger.debug(...)` + import 제거 |
| `providers/discord/initDiscordBot.ts` | `createGlobalLogger('provider').debug(...)` | `providerLogger.debug(...)` |
| `providers/discord/register-commands.ts` | `createGlobalLogger('provider').debug(...)` (2곳) + `globalLogger.error()` | `providerLogger.debug(...)` + `systemLogger.error()` |

### §2.9 side-effect import 전환 (23개 파일)

**패턴**:
```typescript
// Before
import "@/common/utils/logger";

// After
import "@/common/utils/systemLogger";
```

- 23개 파일에서 일괄 전환
- side-effect import는 전역 `globalLogger`, `createGlobalLogger` 등록을 보장하는 역할

---

## 3. 데이터 설계

### 3.1 Firestore 컬렉션/문서 구조
해당 없음 (로깅 마이그레이션, DB 변경 없음)

### 3.2 이벤트 페이로드
해당 없음 (EventBus 이벤트 변경 없음)

---

## 4. 구현 순서

| 순서 | 작업 | 파일 | 설계 섹션 참조 |
|------|------|------|--------------|
| 1 | logger.ts 삭제 | `common/utils/logger.ts` | §2.1 |
| 2 | systemLogger.ts dead import 제거 | `common/utils/systemLogger.ts` | §2.4 |
| 3 | LogSource 타입 추가 + createLogger 시그니처 변경 | `common/utils/systemLogger.ts` | §2.2 |
| 4 | 프리셋 로거 export | `common/utils/systemLogger.ts` | §2.3 |
| 5 | index.ts re-export 수정 | `common/utils/index.ts` | §2.5 |
| 6 | global.d.ts DebugLogger 제거 | `common/types/global.d.ts` | §2.6 |
| 7 | globalLogger.test.ts 수정 | `common/utils/__test__/globalLogger.test.ts` | §2.7 |
| 8 | providerLogger 전환 (4곳) | 4개 파일 | §2.8 |
| 9 | side-effect import 전환 (23개 파일) | 23개 파일 | §2.9 |

---

## 5. 코딩 컨벤션 체크리스트

- [ ] camelCase 변수/함수, PascalCase 클래스/인터페이스/타입
- [ ] SystemLogger 사용 (console.log 금지)
- [ ] JSDoc 주석 (LogSource 타입, 프리셋 로거)
- [ ] import 정리 (dead import 제거)
- [ ] 한국어 주석 (필요 시)

---

## 6. 테스트 계획

| # | 검증 항목 | 방법 | 기대 결과 |
|---|----------|------|----------|
| 1 | TypeScript 컴파일 | `npx tsc --noEmit` | 새 에러 0개 (기존 68개 유지) |
| 2 | DebugLogger 잔여 참조 | `grep -r "DebugLogger" --include="*.ts"` | 코드 파일 0개 (문서 제외) |
| 3 | logger.ts import 잔여 | `grep -r 'import.*logger"' --include="*.ts"` | `systemLogger` 경로만 존재 |
| 4 | createGlobalLogger('provider') 잔여 | `grep -r "createGlobalLogger" --include="*.ts"` | 호출 0개 (선언만 존재) |
| 5 | 전역 로거 동작 | globalLogger.test.ts 4개 테스트 통과 | 모두 pass |

---

*작성일: 2026-03-29*
*참고: docs/phase-1-11/01-plan.md*
