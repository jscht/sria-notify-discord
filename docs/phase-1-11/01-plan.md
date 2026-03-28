# Phase 1.11: DebugLogger 마이그레이션

**상태**: 🔄 진행 중
**우선순위**: ⭐⭐ (P1)
**의존성**: Phase 1.1 완료 (SystemLogger 구축)

---

## 개요

### 배경
- 프로젝트 초기 `logger.ts`의 DebugLogger 클래스로 로깅 구현
- Phase 1.1에서 EventBus 인프라와 함께 SystemLogger가 구축됨
- DebugLogger와 SystemLogger가 공존하여 로깅 이원화 문제 발생
- `global.DebugLogger` 전역 등록이 타입 안전성을 저해

### 목표
- DebugLogger를 완전히 제거하고 SystemLogger로 단일화
- LogSource 타입으로 로그 소스 식별자를 컴파일 타임에 검증
- 프리셋 로거(crawlerLogger, providerLogger)로 반복 코드 제거
- 레거시 코드 완전 정리 (logger.ts 삭제, global.d.ts 정리)

### 범위

| 포함 | 제외 |
|------|------|
| logger.ts 삭제 | 새로운 로깅 기능 추가 |
| DebugLogger 전역 등록/타입 제거 | 로그 포맷 변경 |
| LogSource 타입 + 프리셋 로거 추가 | 외부 로깅 서비스 연동 |
| side-effect import 경로 전환 (23개 파일) | 테스트 프레임워크 변경 |
| providerLogger 전환 (4곳) | 로그 레벨 정책 변경 |

---

## 요구사항

### 기능 요구사항
1. `common/utils/logger.ts` 파일 완전 삭제
2. `global.d.ts`에서 DebugLogger import 및 타입 선언 제거
3. `systemLogger.ts`에 LogSource 타입 정의 (6개 소스: system, crawler, provider, EventBus, SystemError, ErrorHandler)
4. `createLogger()` 파라미터를 `string` → `LogSource`로 타입 강화
5. 프리셋 로거 export: `crawlerLogger`, `providerLogger`
6. 23개 파일의 `import "@/common/utils/logger"` → `import "@/common/utils/systemLogger"` 전환
7. 4곳의 `createGlobalLogger('provider')` → `providerLogger` 전환
8. `globalLogger.test.ts`에서 DebugLogger 테스트 제거 및 import 경로 수정

### 비기능 요구사항
- **호환성**: 기존 `globalLogger`, `createGlobalLogger` 전역 API 유지
- **성능**: 프리셋 로거는 모듈 로드 시 1회 생성, 재사용
- **에러 처리**: 로깅 실패가 비즈니스 로직에 영향 없어야 함
- **빌드**: TypeScript 컴파일 시 새로운 에러 0개 (기존 에러 유지 허용)

---

## 기술 스택 (프로젝트 고정)

| 항목 | 기술 |
|------|------|
| Runtime | Firebase Functions (Node.js) |
| Language | TypeScript (strict mode) |
| Database | Firestore |
| Messaging | discord.js |
| Event System | EventBus (Singleton) |
| Error Handling | SystemError + errorHandler |
| Logging | SystemLogger |

---

## 구현 전략

### 접근 방식
1. **Bottom-up**: 레거시 코드(logger.ts) 삭제 → 의존 코드 수정 순서
2. **타입 강화**: string → LogSource 유니온 타입으로 컴파일 타임 검증
3. **프리셋 패턴**: 자주 사용되는 소스에 대해 사전 생성된 로거 인스턴스 제공
4. **side-effect import 유지**: `import "@/common/utils/systemLogger"` 패턴으로 전역 등록 보장

### 영향 받는 파일

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `common/utils/logger.ts` | 삭제 | 레거시 Logger 클래스 전체 (65줄) |
| `common/utils/systemLogger.ts` | 수정 | LogSource 타입, 프리셋 로거, dead import 제거 |
| `common/utils/index.ts` | 수정 | Logger re-export 제거, LogSource/프리셋 re-export 추가 |
| `common/types/global.d.ts` | 수정 | DebugLogger import/선언 제거 |
| `common/utils/__test__/globalLogger.test.ts` | 수정 | DebugLogger 테스트 제거, import 경로 수정 |
| `events/onReady.ts` | 수정 | providerLogger 전환 |
| `common/middlewares/firebaseConnCache.ts` | 수정 | providerLogger 전환 |
| `providers/discord/initDiscordBot.ts` | 수정 | providerLogger 전환 |
| `providers/discord/register-commands.ts` | 수정 | providerLogger + systemLogger 전환 |
| (23개 파일) | 수정 | side-effect import 경로 전환 |

**총 영향 파일**: 31개 (삭제 1 + 수정 30)

### 의존성 분석
- **선행 의존**: Phase 1.1 (SystemLogger 클래스 구현 완료)
- **후속 의존**: 없음 (독립적 리팩토링)
- **병렬 가능**: 다른 Phase와 병렬 작업 가능

---

## 성공 기준

- [ ] logger.ts 완전 삭제
- [ ] DebugLogger 전역 등록 및 타입 선언 제거
- [ ] LogSource 타입 정의 + createLogger 파라미터 타입 강화
- [ ] 프리셋 로거 (crawlerLogger, providerLogger) export
- [ ] 23개 파일 side-effect import 경로 전환
- [ ] 4곳 providerLogger 전환
- [ ] TypeScript 컴파일 성공 (새 에러 0개)
- [ ] DebugLogger 코드 참조 0개 (문서 제외)
- [ ] 기존 globalLogger/createGlobalLogger API 정상 동작

---

## 리스크 및 고려사항

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| side-effect import 누락 | 높음 | grep으로 잔여 `import "@/common/utils/logger"` 전수 검사 |
| LogSource 타입 제약으로 기존 코드 컴파일 실패 | 중간 | string 리터럴 사용처 전수 확인 후 전환 |
| 테스트 파일 import 경로 미수정 | 낮음 | tsc --noEmit으로 전체 컴파일 검증 |

---

*작성일: 2026-03-29*
*시드: .claude/phases/phase-1-core.md*
