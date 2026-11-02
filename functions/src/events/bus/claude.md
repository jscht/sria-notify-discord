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
  RECRUIT_CHANGED = 'recruit:changed',

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

export interface RecruitChangedEvent extends BaseEvent {
  type: EventType.RECRUIT_CHANGED;
  data: {
    addedJobs: Job[];
    updatedJobs: Job[];
    deletedIds: string[];
  };
}
```

---

### handlers/ (Phase 1.8)
**이벤트 핸들러 등록**

```
handlers/
└── NotificationSendHandler.ts  # NOTIFICATION_SEND → DM 발송 → NOTIFICATION_SENT 발행
```

`RECRUIT_CHANGED`를 구독하는 핸들러는 없다. 사이트 갱신은 DM을 보내지 않고, 알림 스케줄러(`notificationService.runNotification`)가 `NOTIFICATION_SEND`를 발행한다.

**예시: NotificationSendHandler.ts**
```typescript
import { eventBus, EventType } from '@/events/bus';
import type { NotificationSendEvent } from '@/events/bus';

export function registerNotificationSendHandlers(): void {
  eventBus.onEvent<NotificationSendEvent>(EventType.NOTIFICATION_SEND, async (payload) => {
    try {
      // payload.displays(RecruitDisplay[])로 배너 문구와 embed를 만들어 DM을 보낸다
      // 결과는 NOTIFICATION_SENT로 발행한다
    } catch (error) {
      // 발행한 쪽으로 다시 던지지 않는다
    }
  });
}
```

---

### utils/registerEventHandlers.ts (Phase 1.1)
**핸들러 자동 등록**

```typescript
import { registerNotificationSendHandlers } from '../handlers/NotificationSendHandler';

export function registerAllEventHandlers(): void {
  if (handlersRegistered) return;  // 중복 등록 방지

  registerNotificationSendHandlers();
  handlersRegistered = true;
}
```

**호출 위치**: Firebase·Redis 초기화가 끝난 뒤 부른다.
- 스케줄러: `app/scheduler.ts`의 `ready()`
- 게이트웨이: `app/bootstrapGateway.ts`

---

## 주의사항

### 1. 이벤트 루프 방지
```typescript
// ❌ 무한 루프
eventBus.on('recruit:changed', (payload) => {
  eventBus.emit('recruit:changed', payload);  // 재발행!
});

// ✅ 다른 이벤트 발행
eventBus.on('recruit:changed', (payload) => {
  eventBus.emit('notification.send', { ... });
});
```

### 2. 에러 처리
```typescript
// ✅ 모든 핸들러는 try-catch
eventBus.on('recruit:changed', async (payload) => {
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

*최종 수정: 2026-11-01*
