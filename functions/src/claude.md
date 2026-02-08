# src 계층 - 개발 가이드

> 애플리케이션 코드 작업 가이드

---

## 📋 이 계층 구조

```
src/
├── events/            → Discord 이벤트 & EventBus (통합)
│   ├── eventBus/      → 비즈니스 이벤트 시스템 (Phase 1.1, 1.12)
│   ├── listeners/     → 이벤트 핸들러
│   └── ...            → Discord 이벤트
├── features/          → 기능별 모듈
├── services/          → 비즈니스 로직
├── providers/         → 외부 서비스 통합
├── crawlers/          → 웹 크롤링
├── common/            → 공통 유틸리티
└── app/               → 진입점
```

**Phase 1.12 구조 변경 (2026-01-16)**:
- `eventBus/` → `events/eventBus/`로 이동
- Discord 이벤트와 EventBus를 같은 계층에서 관리

---

## 계층별 책임

### events/eventBus/ ✅ (Phase 1.1 완료, Phase 1.12 아키텍처 통합 - 2026-01-16)
- Node.js EventEmitter 기반 이벤트 허브
- 비즈니스 이벤트 타입 정의 (17개 이벤트 타입)
- 이벤트 핸들러 등록 유틸리티
- SystemError 자동 이벤트 발행

**구현된 파일**:
- ✅ EventBus.ts (Singleton 패턴)
- ✅ types.ts (EventType, EventPayloadMap)
- ✅ constants.ts (이벤트 상수)
- ✅ utils/registerEventHandlers.ts (핸들러 등록)
- ✅ index.ts (모듈 export)
- ✅ __test__/EventBus.test.ts (테스트 통과)

**상세 문서**: [events/eventBus/claude.md](./events/eventBus/claude.md)

### events/ 🔄 (Phase 1.12 이후 통합 구조)
- **eventBus/**: 비즈니스 이벤트 시스템 (위 참조)
- **listeners/**: 이벤트 핸들러 (이벤트 구독자들)
- **Discord 이벤트**: Slash Commands, Buttons, Modals 라우팅

**Phase 1.12 변경사항**:
- events/index.ts를 통합 진입점으로 설정
- EventBus 관련 모든 export를 중앙집중식으로 관리
- Discord 이벤트와 이벤트 버스가 같은 계층에서 관리

### features/
- 기능별 모듈 그룹
- alarmSubscribe/, recruitRequest/, notification/, aiSummarization/ 등

**작업 내용**: 각 feature는 자체 claude.md 참고

### services/
- 비즈니스 로직 조율
- Provider 통합 및 트랜잭션 관리
- EventBus와 연계하여 이벤트 발행

**주요 서비스**:
- recruitService.ts (3-tier 캐싱)
- **recruitCacheService.ts** 🆕 (Phase 1.3: RECRUIT_NEW 이벤트 발행)
- notificationService.ts (알림 발송)
- aiService.ts (AI 요약 - Phase 4)

### providers/
- 외부 API 래핑
- discord/, firebase/, redis/, ai/ 등

### crawlers/
- Playwright 기반 웹 크롤링
- 스케줄러 관리

---

## 개발 플로우

1. **새 기능 추가 시**:
   - features/<feature-name>/ 디렉토리 생성
   - 해당 디렉토리에 claude.md 작성
   - 이벤트 정의 (eventBus/types.ts)
   - 이벤트 핸들러 등록

2. **이벤트 기반 통신 (Phase 1.1+)**:
   ```typescript
   // 이벤트 발행 (services 계층)
   eventBus.emitEvent<RecruitNewEvent>(EventType.RECRUIT_NEW, {
     timestamp: Date.now(),
     source: "RecruitCacheService",
     addedJobs, updatedJobs, deletedIds
   });

   // 이벤트 구독 (listeners 계층)
   eventBus.on(EventType.RECRUIT_NEW, handleNewRecruits);
   ```

   **Phase 1.3 구현**: recruitCacheService에서 캐시 변경 시 RECRUIT_NEW 이벤트 발행

3. **의존성 규칙**:
   - ✅ 상위 → 하위만 참조
   - ❌ providers → services 금지

---

## 관련 문서

### 계층별 가이드
- [events/eventBus/claude.md](./events/eventBus/claude.md) - EventBus 시스템 ✅
- [events/claude.md](./events/claude.md) - Events 계층 (Phase 1.12)
- [features/claude.md](./features/claude.md) - 기능별 모듈
- [services/claude.md](./services/claude.md) - 비즈니스 로직
- [providers/claude.md](./providers/claude.md) - 외부 서비스 통합

### 작업 관리
- [../../.claude/todos/TODO.md](../../.claude/todos/TODO.md) - Phase별 작업 목록
- [../../.claude/todos/PROGRESS.md](../../.claude/todos/PROGRESS.md) - 진행 현황
- [../../.claude/todos/phase-1-core.md](../../.claude/todos/phase-1-core.md) - Phase 1 상세

### 기술 문서
- [common/utils/__docs__/SYSTEM_LOGGER_GUIDE.md](./common/utils/__docs__/SYSTEM_LOGGER_GUIDE.md) - SystemLogger
- [common/utils/__docs__/SYSTEM_ERROR_GUIDE.md](./common/utils/__docs__/SYSTEM_ERROR_GUIDE.md) - SystemError

---

## 📊 진행도 요약

| Phase | 작업명 | 상태 | 완료일 |
|-------|--------|------|--------|
| 1.1 | EventBus 인프라 구축 | ✅ 완료 | 2026-01-11 |
| 1.12 | Events 아키텍처 통합 | 🔍 검토 중 | - |
| 1.3 | RecruitCacheService 이벤트 | 🔍 검토 중 | - |
| 1.11 | DebugLogger 마이그레이션 | ✅ 완료 | 2026-01-16 |

---

**최종 수정**: 2026-01-16
**현재 Phase**: 1.3 - RecruitCacheService 이벤트 통합 (🔍 검토 중)
