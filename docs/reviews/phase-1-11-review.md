# Phase 1.11: DebugLogger 마이그레이션 🔍

**상태**: 🔍 검토 중 (2026-02-09)
**우선순위**: ⭐⭐
**의존성**: Phase 1.1 (SystemLogger 구축)

---

## 📊 개선 작업 현황

### 레거시 Logger 삭제 ✅
- `common/utils/logger.ts` 파일 전체 삭제
- DebugLogger 전역 등록 코드 제거
- `global.d.ts`에서 DebugLogger 타입 선언 제거

### LogSource 타입 + 프리셋 로거 추가 ✅
- `systemLogger.ts`에 `LogSource` 타입 정의 (6개 소스)
- `crawlerLogger`, `providerLogger` 프리셋 로거 export
- `createLogger()` 파라미터 타입을 `string` → `LogSource`로 강화

### Side-effect import 전환 ✅
- 23개 파일의 `import "@/common/utils/logger"` → `import "@/common/utils/systemLogger"` 전환
- 4곳의 `createGlobalLogger('provider')` → `providerLogger` 전환

---

## 📝 작업 체크리스트

### 1. logger.ts 삭제
- [✅] `common/utils/logger.ts` 파일 삭제
- [✅] `common/utils/index.ts`에서 Logger re-export 제거

### 2. systemLogger.ts 수정
- [✅] `import Logger from "./logger"` dead import 제거
- [✅] `LogSource` 타입 정의 (`system` | `crawler` | `provider` | `EventBus` | `SystemError` | `ErrorHandler`)
- [✅] `createLogger()` 파라미터 타입 `string` → `LogSource`
- [✅] 프리셋 로거 export (`crawlerLogger`, `providerLogger`)
- [✅] JSDoc 업데이트

### 3. global.d.ts 수정
- [✅] `import type Logger from "../utils/logger"` 제거
- [✅] `var DebugLogger: typeof Logger` 선언 제거

### 4. globalLogger.test.ts 수정
- [✅] `import "../logger"` 제거
- [✅] side-effect import를 `import "@/common/utils/systemLogger"` 변경
- [✅] DebugLogger 테스트 2건 제거 (테스트 1, 테스트 4)
- [✅] 테스트 번호 재정렬 (1~4)

### 5. providerLogger 전환 (4곳)
- [✅] `events/onReady.ts` — `createGlobalLogger('provider').debug(...)` → `providerLogger.debug(...)`
- [✅] `common/middlewares/firebaseConnCache.ts` — 동일 전환 + `import "@/common/utils/logger"` 제거
- [✅] `providers/discord/initDiscordBot.ts` — 동일 전환
- [✅] `providers/discord/register-commands.ts` — 2곳 전환 + `globalLogger.error()` → `systemLogger.error()`

### 6. side-effect import 전환 (23곳)
- [✅] `import "@/common/utils/logger"` → `import "@/common/utils/systemLogger"` (23개 파일)

---

## ✅ 완료 기준

- [✅] logger.ts 삭제 완료
- [✅] DebugLogger 전역 등록 및 타입 선언 제거
- [✅] LogSource 타입 + 프리셋 로거 export
- [✅] 모든 import 경로 전환 완료
- [✅] TypeScript 컴파일 성공 (기존 에러 68개 유지, 새 에러 0개)
- [✅] DebugLogger 잔여 참조 0개 (코드 파일 기준, 문서 제외)

---

## 📂 수정/생성된 파일 목록

| 파일 | 작업 | 변경 내용 |
|------|------|-----------|
| `common/utils/logger.ts` | 삭제 | 레거시 Logger 클래스 전체 삭제 (65줄) |
| `common/utils/systemLogger.ts` | 수정 | dead import 제거, LogSource 타입 추가, 프리셋 로거 추가 |
| `common/utils/index.ts` | 수정 | Logger re-export 제거, LogSource/프리셋 로거 re-export 추가 |
| `common/types/global.d.ts` | 수정 | DebugLogger import 및 타입 선언 제거 |
| `common/utils/__test__/globalLogger.test.ts` | 수정 | DebugLogger 테스트 제거, import 경로 전환 |
| `events/onReady.ts` | 수정 | providerLogger 사용으로 전환 |
| `common/middlewares/firebaseConnCache.ts` | 수정 | providerLogger 사용으로 전환, import 경로 수정 |
| `providers/discord/initDiscordBot.ts` | 수정 | providerLogger 사용으로 전환 |
| `providers/discord/register-commands.ts` | 수정 | providerLogger + systemLogger 사용으로 전환 |
| (23개 파일) | 수정 | side-effect import 경로 전환 |

**총 영향 파일**: 31개 (삭제 1 + 수정 30)

---

## 🔍 검토 사항

**참고 문서**: [REVIEW_PROCESS.md](../../rules/review-process.md)

### 코드 리뷰
- [x] LogSource 타입 값이 실제 사용처와 일치 ✅
  - [x] `system` — systemLogger (기본) ✅
  - [x] `crawler` — crawlerLogger ✅
  - [x] `provider` — providerLogger ✅
  - [x] `EventBus` — eventLogger.ts ✅
  - [x] `SystemError` — systemError.ts ✅
  - [x] `ErrorHandler` — errorHandler.ts ✅
- [x] 프리셋 로거가 올바르게 export ✅
- [x] dead import 제거 확인 ✅
- [x] 불필요한 string 파라미터 ("discord", "firebase") 정리 ✅

### 기능 테스트
- [x] TypeScript 컴파일 성공 (기존 에러 제외) ✅
- [x] `import "@/common/utils/logger"` 잔여 참조 0개 ✅
- [x] `createGlobalLogger('provider')` 잔여 참조 0개 ✅
- [x] `DebugLogger` 코드 참조 0개 (문서 제외) ✅

### 문서화
- [x] LogSource JSDoc 주석 ✅
- [x] SystemLogger 클래스 JSDoc 업데이트 ✅

---

## 💡 구현 하이라이트

### 1. LogSource 타입으로 소스 식별자 제약

```typescript
export type LogSource =
  | "system"
  | "crawler"
  | "provider"
  | "EventBus"
  | "SystemError"
  | "ErrorHandler";

export function createLogger(source: LogSource): SystemLogger {
  return new SystemLogger(source);
}
```

- 기존: `createLogger(source: string)` — 임의 문자열 허용
- 변경: `createLogger(source: LogSource)` — 6개 허용 값으로 제약
- 잘못된 소스 식별자 사용 시 컴파일 타임에 에러 발생

### 2. 프리셋 로거로 반복 코드 제거

```typescript
// Before: 매번 새 로거 생성
createGlobalLogger('provider').debug("메시지");

// After: 프리셋 로거 사용
import { providerLogger } from "@/common/utils/systemLogger";
providerLogger.debug("메시지");
```

- `crawlerLogger`, `providerLogger` 2개 프리셋 제공
- 모듈 로드 시 1회 생성, 재사용

### 3. Side-effect import 통합

```typescript
// Before: 삭제된 logger.ts로 side-effect import
import "@/common/utils/logger";

// After: systemLogger.ts로 통합
import "@/common/utils/systemLogger";
```

- 23개 파일의 import 경로 일괄 전환
- 전역 `globalLogger`, `createGlobalLogger` 등록은 systemLogger.ts에서 유지

### 4. 레거시 코드 완전 제거

| 제거 항목 | 위치 |
|----------|------|
| Logger 클래스 (7개 static 메서드) | `logger.ts` (삭제) |
| `global.DebugLogger` 등록 | `logger.ts` (삭제) |
| `import Logger from "./logger"` dead import | `systemLogger.ts` |
| `import type Logger` + `var DebugLogger` | `global.d.ts` |
| DebugLogger 테스트 2건 | `globalLogger.test.ts` |
| `export { default as Logger }` | `index.ts` |

---

## 📋 다음 단계

**참고 문서**: [PROJECT_CONTEXT.md - Git Workflow](../../rules/git-workflow.md)

1. [ ] 사용자 피드백 확인 및 승인
2. [ ] Git 커밋 및 PR 생성 (dev 브랜치)
3. [ ] PROGRESS.md, phase-1-core.md Phase 1.11 진행률 업데이트
4. [ ] 다음 Phase 시작

---

*작성일: 2026-02-09*
*검토자: Claude*
