# features 계층 - 개발 가이드

> 기능별 모듈 작업 가이드

---

## 📋 이 계층의 역할

기능별로 관련 코드를 그룹화하여 관리합니다. 각 feature는 독립적인 모듈로 동작합니다.

---

## 구조

```
features/
├── alarmSubscribe/       # 알림 설정 (기존 + Phase 4 AI 통합)
├── recruitRequest/       # 공고 요청 (기존 + Phase 4 AI 통합)
├── notification/         # 알림 발송 (NEW - Phase 1.7)
├── errorReporting/       # 에러 리포팅 (NEW - Phase 2.1)
└── adminBroadcast/       # 관리자 공지 (NEW - Phase 2.2)
```

---

## 각 Feature 설명

### alarmSubscribe/ (기존 - Phase 1.5 수정, Phase 4 AI 통합)
**역할**: 사용자 알림 설정 UI 및 로직 (Slash Command + 자연어)

```
alarmSubscribe/
├── commands/            # /alarm-subscribe 명령어
├── handlers/            # 버튼/모달 핸들러
│   └── messageHandler.ts    # 자연어 처리 (Phase 4)
├── interactions/        # UI 컴포넌트
├── services/            # 알림 설정 서비스
│   └── notificationSettingsService.ts  # TODO 구현
└── types/
```

**작업 내용 (Phase 1.5)**:
- notificationSettingsService.ts 구현
- getUserAlertMode(), setUserAlertMode() 함수
- 미구현 버튼 핸들러 완성

**작업 내용 (Phase 4)**:
```typescript
// handlers/messageHandler.ts
import { aiService } from '@/services/aiService';
import { setNotificationSettings } from '@/providers/firebase/store/subscription';

export async function handleNaturalLanguageSubscribe(message: string, userId: string) {
  // AI로 의도 분석
  const intent = await aiService.parseUserIntent(message);

  if (intent.action === 'subscribe') {
    // "경기도 공고만 받을래" → 알림 설정 변경
    await setNotificationSettings(userId, {
      alertMode: 'SELECTED',
      regions: intent.regions || [],
      enabled: true
    });

    return { success: true, regions: intent.regions };
  } else if (intent.action === 'unsubscribe') {
    // "알림 끄기" → 알림 비활성화
    await setNotificationSettings(userId, {
      alertMode: 'ALL',
      regions: [],
      enabled: false
    });

    return { success: true, disabled: true };
  }
}
```

---

### recruitRequest/ (기존 - Phase 1.6 리뷰, Phase 4 AI 통합)
**역할**: 사용자 공고 요청 처리 (Slash Command + 자연어)

```
recruitRequest/
├── commands/            # /recruit-request 명령어
├── handlers/            # 명령어 핸들러
│   └── messageHandler.ts    # 자연어 처리 (Phase 4)
└── services/            # 공고 조회 로직
```

**작업 내용 (Phase 1.6)**:
- 기존 기능 리뷰
- 이벤트 발행 추가 (선택)

**작업 내용 (Phase 4)**:
```typescript
// handlers/messageHandler.ts
import { aiService } from '@/services/aiService';
import { recruitService } from '@/services/recruitService';

export async function handleNaturalLanguageRecruit(message: string, userId: string) {
  // AI로 의도 분석
  const intent = await aiService.parseUserIntent(message);

  if (intent.action === 'recruit') {
    // "서울에서 단기 알바 구해줘" → 공고 조회
    const recruits = await recruitService.getRecruitList();
    const filtered = intent.region
      ? recruits.filter(r => r.region === intent.region)
      : recruits;

    return { recruits: filtered };
  }
}
```

---

### notification/ (NEW - Phase 1.7)
**역할**: 알림 발송 비즈니스 로직 및 필터링

```
notification/
├── services/
│   └── NotificationService.ts   # 알림 발송 조율
├── filters/
│   └── RecruitFilter.ts         # 지역/모드별 필터링
└── types/
```

**작업 내용 (Phase 1.7)**:
```typescript
// NotificationService.ts
export class NotificationService {
  constructor() {
    // recruit.new 이벤트 리스너 등록
    eventBus.on('recruit.new', this.notifyNewRecruits);
  }

  async notifyNewRecruits(data) {
    const subscribers = await getAllActiveSubscribers();

    for (const subscriber of subscribers) {
      const filteredRecruits = this.filterRecruitsForUser(
        data.addedJobs,
        subscriber
      );

      if (filteredRecruits.length > 0) {
        await sendNotificationDM(subscriber.userId, {
          title: '🔔 새로운 채용 공고',
          recruits: filteredRecruits
        });
      }
    }
  }
}
```

---

### errorReporting/ (NEW - Phase 2.1)
**역할**: 에러 자동 리포팅

```
errorReporting/
├── services/
│   └── ErrorReportingService.ts
└── types/
```

**작업 내용 (Phase 2.1)**:
```typescript
// ErrorReportingService.ts
export class ErrorReportService {
  constructor() {
    eventBus.on('error.critical', this.reportCriticalError);
  }

  async reportCriticalError(error, context) {
    // 관리자 DM 전송
    await sendNotificationDM(adminUserId, {
      title: '🚨 Critical Error',
      description: error.message
    });

    // Firestore 저장
    await saveErrorLog({ error, context });
  }
}
```

---

### adminBroadcast/ (NEW - Phase 2.2)
**역할**: 관리자 전체 공지 기능

```
adminBroadcast/
├── commands/
│   └── slashCommand.ts          # /admin-broadcast 명령어
├── handlers/
│   └── modalHandler.ts          # 공지 입력 모달
├── services/
│   └── BroadcastService.ts      # 전체 발송 로직
├── interactions/
│   └── modals.ts                # 모달 UI
└── types/
```

**작업 내용 (Phase 2.2)**:
```typescript
// BroadcastService.ts
export class BroadcastService {
  constructor() {
    eventBus.on('admin.broadcast.request', this.sendBroadcast);
  }

  async sendBroadcast(content, author) {
    const subscribers = await getAllActiveSubscribers();

    let sentCount = 0;
    for (const subscriber of subscribers) {
      try {
        await sendNotificationDM(subscriber.userId, {
          title: '📢 공지사항',
          description: content
        });
        sentCount++;
      } catch (error) {
        console.error(`Failed for ${subscriber.userId}`);
      }
    }

    // 발송 통계 저장
    await saveBroadcast({ content, sentCount, totalCount: subscribers.length });
  }
}
```

---

## Feature 추가 가이드

### 1. 새 Feature 생성
```bash
mkdir -p src/features/myFeature/{commands,handlers,services,types}
```

### 2. claude.md 작성
```markdown
# myFeature - 개발 가이드

## 역할
...

## 작업 내용
...
```

### 3. 이벤트 정의
```typescript
// eventBus/types.ts
export enum EventType {
  MY_FEATURE_ACTION = 'myFeature.action',
}
```

### 4. 서비스 구현
```typescript
// features/myFeature/services/MyService.ts
export class MyService {
  constructor() {
    eventBus.on('myFeature.action', this.handleAction);
  }
}
```

---

## 의존성 규칙

### ✅ 허용
- features → services
- features → providers
- features → eventBus

### ❌ 금지
- features → events (Presentation 계층)
- features ↔ features (직접 참조)

**Feature 간 통신은 EventBus 사용**:
```typescript
// ✅ 올바름
eventBus.emit('notification.send', { ... });

// ❌ 잘못됨
import { NotificationService } from '@/features/notification';
```

---

*최종 수정: 2026-01-05*
