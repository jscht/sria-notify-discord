# Phase 1.14 갭 분석: 프로덕션 배포·운영 (production-deploy)

**상태**: 🔍 검토 중
**분석일**: 2026-09-30
**설계서**: `docs/phase-1-14/02-design.md`

> **분석 범위**: 본 Phase는 코드 변경이 의도적으로 **O-3/O-5 2건뿐**이다(design §0). U 운영 항목(O-4/O-6/O-9·E안 실배포·U-1~U-4)과 보류 항목(Q lint-cleanup·O-7)은 코드 산출물이 아니므로 갭 분석 대상에서 제외한다. 따라서 매치율은 **§2.1·§2.2 코드 설계 vs `connection.ts`·`seedCollection.ts` 구현 + §3 계약 불변**의 일치도다.
>
> 정적 검증: `npx tsc --noEmit` EXIT=0 · `npm run build` EXIT=0 (메인 컨텍스트 실행 확인).

---

## 1. 갭 분석 (Gap Detector)

### 1.1 Structural (가중치 0.2)
| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| S1 | §2.1 `RECONNECT_*` 상수 3개 모듈 스코프 | 200/10_000/20 선언 | ✅ | connection.ts:7-9 |
| S2 | §2.1 `buildReconnectStrategy()` + `on("error")` 구조 | 함수·리스너 존재 | ✅ | connection.ts:17-26, 51-53 |
| S3 | §2.2 `seedCollection` export 시그니처 무변화 | `seedCollection(init=false)` 유지 | ✅ | seedCollection.ts:7 |
| S4 | §2.2 호출부 `initFirebaseApp.ts` 구조 불변 | fire-and-forget 무변화 | ✅ | initFirebaseApp.ts:2,21 |

### 1.2 Functional (가중치 0.4)
| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| F1 | §2.1 지수 백오프 `base*2^retries` 상한 10초 | `Math.min(MAX, BASE*2**retries)` | ✅ | connection.ts:22 |
| F2 | §2.1 jitter ±20% (`0.8+random*0.4`) | 수식 동일 | ✅ | connection.ts:23 |
| F3 | §2.1 `retries>20` 시 `Error` 반환 | 동일 | ✅ | connection.ts:19-20 |
| F4 | §2.1 `on("error")` 흡수만·throw 금지 | redisError 로깅만 | ✅ | connection.ts:51-53 |
| F5 | §2.1 `on("error")`를 `connect()` 이전 등록 | 리스너 L51 → connect L59 | ✅ | connection.ts:51,59 |
| F6 | §2.1 `on("ready")`·정상 연결 경로 무변화 | ready 로그·null 폴백 유지 | ✅ | connection.ts:55-67 |
| F7 | §2.1 재연결 영구 실패 시 `SystemError.critical` 격상 | 미구현 — 소진 시 `redisError`(FAILURE)로만 흡수 | ⚠️ 부분 | connection.ts:51-53 |
| F8 | §2.2 `process.exit(1)` 제거 → swallow | exit 제거, firestoreError 로깅 후 반환 | ✅ | seedCollection.ts:17-25 |
| F9 | §2.2 catch에서 rethrow 금지 | swallow만 | ✅ | seedCollection.ts:17-25 |
| F10 | §2.2 정상 seed 경로 무변화 | Promise.all·성공 로그 유지 | ✅ | seedCollection.ts:11-16 |
| F11 | §2.2 호출부 fire-and-forget 유지 | await 미추가 | ✅ | initFirebaseApp.ts:21 |

> **F7 부분일치 근거**: design §2.1 prose는 게이트웨이 영구 실패 시 `SystemError.critical` 격상을 기술하나, 같은 §2.1 정본 코드블록(L100-128)엔 critical 호출이 없고 "향후 모니터링(Phase 2.1/2.2)이 감지"로 위임한다. 크래시 방지·상한 포기라는 O-3 1차 목적은 완전 달성. 스코프 경계 모호한 소규모 갭.

### 1.3 Contract (가중치 0.4)
| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| C1 | §2.1 `redisConnection()` 반환 `Promise<RedisClientType \| null>` 불변 | 유지 | ✅ | connection.ts:28,61,66 |
| C2 | §2.1 `SystemError.redisError()` 시그니처 준수 | `(message, error, context)` (L247) | ✅ | connection.ts:52 |
| C3 | §2.2 `seedCollection(init)` 시그니처 불변 | 동일 | ✅ | seedCollection.ts:7 |
| C4 | §2.2 `SystemError.firestoreError()` 준수 | `(message, error?, context)` (L260) | ✅ | seedCollection.ts:21-25 |
| C5 | §3.1 `DmPayload`/`DmSendResult` 불변 | dmSender 무관 | ✅ | (미변경) |
| C6 | §3.2 Redis 키/Firestore 문서 스키마 불변 | 연결옵션·실패처리만 변경 | ✅ | (미변경) |
| C7 | §3.3 EventBus 페이로드 불변 | 신규 이벤트 없음 | ✅ | (미변경) |
| C8 | §2.2 호출부 fire-and-forget 계약 불변 | await/try-catch 미추가 | ✅ | initFirebaseApp.ts:21 |
| C9 | §7 컨벤션(팩토리·globalLogger) | 준수 | ✅ | 양 파일 |

---

## 2. 매치율 산출

| 카테고리 | 일치/전체 | 점수 |
|----------|----------|------|
| Structural (×0.2) | 4/4 | 100% |
| Functional (×0.4) | 10.5/11 (완전10 + 부분1) | 95.5% |
| Contract (×0.4) | 9/9 | 100% |
| **종합 매치율** | | **98.2%** |

### 산출 공식
```
카테고리 점수 = (완전일치 + 부분일치 × 0.5) / 전체항목 × 100
종합 매치율 = 100×0.2 + 95.5×0.4 + 100×0.4 = 20 + 38.2 + 40 = 98.2%
```

---

## 3. 갭 목록

### 3.1 미구현 항목
| # | 카테고리 | 설계 섹션 | 갭 내용 | 우선순위 |
|---|----------|----------|--------|---------|
| G1 | F | §2.1 | 재연결 영구 실패(상한 도달) 시 `SystemError.critical` 격상 로깅 부재 — error 이벤트가 `redisError`(FAILURE)로만 흡수. 크래시 방지·상한 포기는 달성. design 정본 코드블록엔 critical 미포함이라 스코프 경계 모호 | P2 |

> G1은 design 자체가 "향후 모니터링(Phase 2.1/2.2) 위임"으로 기술 — iterate 필수 아님. 필요 시 `on("error")` 내 소진 판별 + critical 격상으로 100% 달성 가능.

### 3.2 설계 차이
| # | 설계 내용 | 실제 구현 | 판단 |
|---|----------|----------|------|
| D1 | §2.1 주석 "상한 10초"(cap) | jitter를 cap **후** 적용해 실제 최대 대기 ≈ 12s (10000×1.2) | 허용(기능 무해) — 주석 정정 권장 (Code M1) |

---

## 4. 코드 품질 분석 (Code Analyzer)

### 4.1 이슈 목록
| # | 심각도 | 카테고리 | 파일:라인 | 이슈 내용 | 제안 |
|---|--------|----------|----------|----------|------|
| M1 | 🟢 Minor | 컨벤션(주석 정확성) | connection.ts:22-24 | jitter를 cap 후 곱해 최대 대기 = 10000×1.2 = **12s** → 주석 "상한 10초"(L8,L13) 초과 | 주석 "cap 후 ±20% jitter로 최대 ~12s" 정정 또는 jitter 후 `Math.min` 재적용. 기능 무해 |
| M2 | 🟢 Minor | 네이밍 정확성 | connection.ts:19 | `retries > MAX_RETRIES(20)` → 실제 21회째 Error. 상수명 "20"이나 재시도 21회 | 정확히 20회면 `>=` 또는 상수명 재고. 누적 ~3분 계산은 21회 기준 타당 |
| M3 | 🟢 Minor | lint | connection.ts:68 | 함수 선언 뒤 불필요한 `;` (빈 statement) | `}`로 정리 |
| M4 | 🟢 Minor | DRY/일관성 | connection.ts:62-65 | connect catch는 `globalLogger.error` 직접 호출 → `on("error")`의 `SystemError.redisError`와 경로 이원화 | connect 실패도 `SystemError.redisError`로 통일 검토. 기존 패턴이라 선택적 |

### 4.2 컨벤션 준수
| 항목 | 상태 | 비고 |
|------|------|------|
| SystemLogger/globalLogger 사용 (console.log 금지) | ✅ | 두 파일 console.* 0건 |
| SystemError 팩토리 (생성자 자동 로깅→중복 회피) | ✅ | 팩토리 호출 후 추가 로깅 없음 |
| on("error")·seed catch 흡수만 (throw/rethrow/exit 금지) | ✅ | exit·throw·rethrow 잔존 0건 |
| on("error") 등록 시점 (connect 이전) | ✅ | L51 등록 → L59 connect |
| 네이밍 규칙 | ✅ | camel/Pascal/UPPER_SNAKE 준수 |
| 신규 함수 JSDoc | ✅ | `buildReconnectStrategy` 존재 |
| import 정확성 | ✅ | 미사용 import 0 |
| 민감정보 로그 노출 (REDIS_URL) | ✅ | 크레덴셜 직접 로깅 없음 |

### 4.3 요약
- 🔴 Critical: 0건
- 🟡 Major: 0건
- 🟢 Minor: 4건 (M1 jitter-cap / M2 상수명 nuance / M3 세미콜론 / M4 catch 로깅 일관성)

> **사후 정리(2026-09-30, analyze 직후)**: **M1·M3 해소.** M1 → jitter를 cap **후** 적용하도록 수정해 실제 대기가 10초 상한을 지킴(백오프 산술 검증: retries 0~20 각 5000샘플 최대 10000ms·초과 0건, retries=21→Error). M3 → 불필요한 세미콜론 제거. 재검증 `tsc --noEmit`/`npm run build` EXIT=0. **잔여**: M2(상수명 nuance, 실질 무해)·M4(catch 로깅 일관성, 선택)·G1(P2, Phase 2.1/2.2 위임) — 모두 비차단으로 유지. 매치율 98.2% 불변(M1/M3은 Code Analyzer minor라 매치율 산정에 미포함).

---

## 5. 다음 단계 분기

✅ **종합 매치율 98.2% (≥90%) · 🔴 Critical 0건** → `/pdca report 1.14` 진행 가능.

- 잔여는 P2 갭 1건(G1, design이 Phase 2.1/2.2 위임) + 🟢 Minor 4건(주석·스타일·선택적 일관성)뿐 — **iterate 필수 아님**.
- 선택: M1(주석 정정)·M3(세미콜론)은 사소한 즉시 수정감. 원하면 report 전 quick iterate로 정리 가능.

---

*분석일: 2026-09-30*
*참고: docs/phase-1-14/02-design.md*
