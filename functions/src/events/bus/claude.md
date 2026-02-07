# eventBus 계층 - 개발 가이드

> 비즈니스 이벤트 시스템 작업 가이드

---

## 📋 이 계층의 역할

Node.js EventEmitter 기반 중앙 이벤트 허브로, 애플리케이션 내 비즈니스 로직 간 통신을 담당합니다.

---

## 작업할 파일

### EventBus.ts (Phase 1.1)
**Singleton 패턴 구현**

```typescript
import { EventEmitter } from 'events';

export class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    this.setMaxListeners(100); // 메모리 누수 방지
  }

  static getInstance(): EventBus {
    if (!this.instance) {
      this.instance = new EventBus();
    }
    return this.instance;
  }

  emitEvent<T>(event: string, payload: T): boolean {
    return this.emit(event, payload);
  }

  onEvent<T>(event: string, listener: (payload: T) => void | Promise<void>): this {
    return this.on(event, listener);
  }
}

export const eventBus = EventBus.getInstance();
```

---

### types.ts (Phase 1.1)
**이벤트 타입 정의**

```typescript
export enum EventType {
  // Recruit Events
  CRAWL_STARTED = 'recruit.crawl.started',
  RECRUIT_NEW = 'recruit.new',

  // Notification Events
  NOTIFICATION_SEND = 'notification.send',
  NOTIFICATION_SENT = 'notification.sent',

  // Error Events
  ERROR_CRITICAL = 'error.critical',

  // Admin Events
  ADMIN_BROADCAST_REQUEST = 'admin.broadcast.request',

  // AI Events (Phase 2)
  AI_NLP_REQUEST = 'ai.nlp.request',
  AI_NLP_COMPLETED = 'ai.nlp.completed',
}

export interface BaseEvent {
  type: EventType;
  timestamp: Date;
  source: string;
}

export interface RecruitNewEvent extends BaseEvent {
  type: EventType.RECRUIT_NEW;
  data: {
    addedJobs: Job[];
    updatedJobs: Job[];
    deletedIds: string[];
  };
}
```

---

### handlers/ (Phase 1.7)
**이벤트 핸들러 등록**

```
handlers/
├── NotificationEventHandler.ts  # recruit.new → 알림 발송
├── ErrorEventHandler.ts          # error.critical → 관리자 알림
└── index.ts                      # 전체 핸들러 export
```

**예시: NotificationEventHandler.ts**
```typescript
import { eventBus } from '../EventBus';
import { EventType, RecruitNewEvent } from '../types';
import { notificationService } from '@/services/notificationService';

export function registerNotificationHandlers() {
  eventBus.onEvent<RecruitNewEvent>(EventType.RECRUIT_NEW, async (payload) => {
    await notificationService.notifyNewRecruits(payload.data);
  });
}
```

---

### utils/registerEventHandlers.ts (Phase 1.1)
**핸들러 자동 등록**

```typescript
import { registerNotificationHandlers } from '../handlers/NotificationEventHandler';
import { registerErrorHandlers } from '../handlers/ErrorEventHandler';

export function registerAllEventHandlers() {
  registerNotificationHandlers();
  registerErrorHandlers();

  console.log('[EventBus] All event handlers registered');
}
```

**app/index.ts에서 호출**:
```typescript
import { registerAllEventHandlers } from '@/eventBus/utils/registerEventHandlers';

registerAllEventHandlers();  // 모듈 레벨에서 1회만 실행
```

---

## 주의사항

### 1. 이벤트 루프 방지
```typescript
// ❌ 무한 루프
eventBus.on('recruit.new', (payload) => {
  eventBus.emit('recruit.new', payload);  // 재발행!
});

// ✅ 다른 이벤트 발행
eventBus.on('recruit.new', (payload) => {
  eventBus.emit('notification.send', { ... });
});
```

### 2. 에러 처리
```typescript
// ✅ 모든 핸들러는 try-catch
eventBus.on('recruit.new', async (payload) => {
  try {
    await processRecruits(payload);
  } catch (error) {
    console.error('Handler error:', error);
  }
});
```

### 3. Firebase Functions Cold Start
```typescript
// ✅ 모듈 레벨에서 1회만 등록
registerAllEventHandlers();

export const myFunction = https.onRequest((req, res) => {
  // 핸들러는 이미 등록됨
});
```

---

## 작업 순서 (Phase 1.1)

1. EventBus.ts 생성 (Singleton)
2. types.ts 생성 (이벤트 타입)
3. constants.ts 생성 (상수)
4. utils/registerEventHandlers.ts 생성
5. app/index.ts에서 registerAllEventHandlers() 호출

---

*최종 수정: 2026-01-05*
