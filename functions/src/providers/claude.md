# providers 계층 - 개발 가이드

> 외부 서비스 통합 작업 가이드

---

## 📋 이 계층의 역할

외부 API 호출, 데이터 변환, 연결 관리를 담당합니다.

---

## 구조

```
providers/
├── discord/              # Discord API
│   ├── utils/           # DM 발송 등 (NEW - Phase 1.8)
│   ├── builder/         # UI 컴포넌트
│   └── client.ts
│
├── firebase/            # Firestore
│   └── store/
│       ├── subscription.ts    # (NEW - Phase 1.4)
│       ├── errorLog.ts        # (NEW - Phase 2.1)
│       └── broadcast.ts       # (NEW - Phase 2.2)
│
├── redis/               # Redis 캐시
│   └── store/
│
└── ai/                  # AI Provider (NEW - Phase 2)
    └── huggingface/
        ├── client.ts
        └── models.ts
```

---

## discord/utils/ (NEW - Phase 1.8)

### dmSender.ts
**역할**: Discord DM 발송, Rate Limit 처리

```typescript
import { Client } from 'discord.js';

export async function sendNotificationDM(
  userId: string,
  options: {
    title: string;
    description?: string;
    recruits?: RecruitData[];
    color?: number;
  }
): Promise<void> {
  const client = getDiscordClient();

  try {
    const user = await client.users.fetch(userId);

    const embed = {
      title: options.title,
      description: options.description || '',
      color: options.color || 0x5865F2,
      fields: options.recruits?.map(r => ({
        name: r.title,
        value: `지역: ${r.region}\n기간: ${r.startDate} ~ ${r.endDate}`,
        inline: false
      })) || [],
      timestamp: new Date().toISOString()
    };

    await user.send({ embeds: [embed] });

    console.log(`[dmSender] DM sent to ${userId}`);

  } catch (error) {
    if (error.code === 50007) {
      console.error(`[dmSender] User ${userId} has DMs disabled`);
    } else {
      console.error(`[dmSender] Failed to send DM to ${userId}:`, error);
      throw error;
    }
  }
}

// Rate Limit 처리 (Discord: 5 req/5s per user)
export async function sendBulkNotifications(
  userIds: string[],
  options: any
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const userId of userIds) {
    try {
      await sendNotificationDM(userId, options);
      sent++;

      // Rate Limit 대기 (1초)
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      failed++;
    }
  }

  return { sent, failed };
}
```

---

## firebase/store/subscription.ts (NEW - Phase 1.4)

### 역할
사용자 알림 설정 CRUD

### Firestore 스키마
```
users/{userId}/notifications/settings
{
  alertMode: 'ALL' | 'SELECTED',
  regions: string[],
  enabled: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 구현
```typescript
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

export async function getNotificationSettings(userId: string) {
  const doc = await db
    .collection('users')
    .doc(userId)
    .collection('notifications')
    .doc('settings')
    .get();

  if (!doc.exists) {
    // 기본값 반환
    return {
      alertMode: 'ALL',
      regions: [],
      enabled: false
    };
  }

  return doc.data();
}

export async function setNotificationSettings(
  userId: string,
  settings: {
    alertMode: 'ALL' | 'SELECTED';
    regions: string[];
    enabled: boolean;
  }
) {
  await db
    .collection('users')
    .doc(userId)
    .collection('notifications')
    .doc('settings')
    .set({
      ...settings,
      updatedAt: new Date()
    }, { merge: true });
}

export async function getAllActiveSubscribers() {
  const snapshot = await db
    .collectionGroup('notifications')
    .where('enabled', '==', true)
    .get();

  return snapshot.docs.map(doc => ({
    userId: doc.ref.parent.parent!.id,
    ...doc.data()
  }));
}
```

---

## firebase/store/errorLog.ts (NEW - Phase 2.1)

### 역할
에러 로그 저장

### Firestore 스키마
```
errors/{errorId}
{
  type: 'critical' | 'warning',
  message: string,
  stack: string,
  context: object,
  notifiedAdmin: boolean,
  createdAt: Timestamp
}
```

### 구현
```typescript
export async function saveErrorLog(error: {
  type: string;
  message: string;
  stack: string;
  context: any;
  notifiedAdmin: boolean;
  createdAt: Date;
}) {
  await db.collection('errors').add(error);
}

export async function getErrorLogs(filters?: {
  type?: string;
  limit?: number;
}) {
  let query = db.collection('errors').orderBy('createdAt', 'desc');

  if (filters?.type) {
    query = query.where('type', '==', filters.type);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
```

---

## firebase/store/broadcast.ts (NEW - Phase 2.2)

### 역할
공지 이력 저장

### Firestore 스키마
```
broadcasts/{broadcastId}
{
  content: string,
  author: { userId: string, username: string },
  targetUsers: number,
  sentCount: number,
  failedCount: number,
  createdAt: Timestamp,
  completedAt: Timestamp
}
```

### 구현
```typescript
export async function saveBroadcast(data: {
  content: string;
  author: { userId: string; username: string };
  targetUsers: number;
  sentCount: number;
  failedCount: number;
}) {
  await db.collection('broadcasts').add({
    ...data,
    createdAt: new Date(),
    completedAt: new Date()
  });
}

export async function getBroadcastHistory(limit = 10) {
  const snapshot = await db
    .collection('broadcasts')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
```

---

## ai/huggingface/ (NEW - Phase 2)

### client.ts
**역할**: Hugging Face API 클라이언트

```typescript
import { HfInference } from '@huggingface/inference';

export class HuggingFaceClient {
  private hf: HfInference;

  constructor() {
    this.hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
  }

  async zeroShotClassification(inputs: string, candidateLabels: string[]) {
    return await this.hf.zeroShotClassification({
      model: 'facebook/bart-large-mnli',
      inputs,
      parameters: { candidate_labels: candidateLabels }
    });
  }

  async textClassification(inputs: string) {
    return await this.hf.textClassification({
      model: 'facebook/bart-large-mnli',
      inputs
    });
  }
}

export const huggingFaceClient = new HuggingFaceClient();
```

### models.ts
**역할**: 무료 모델 설정

```typescript
export const FREE_MODELS = {
  NLP: {
    primary: 'facebook/bart-large-mnli',
    fallback: 'google/flan-t5-base'
  }
};

export const FREE_TIER_LIMITS = {
  requestsPerMinute: 100,
  requestsPerDay: 10000,
  maxTokensPerRequest: 1024,
  timeout: 30000  // 30초
};
```

---

## 작업 순서

### Phase 1.4 (subscription.ts)
1. Firestore 스키마 설계
2. getNotificationSettings() 구현
3. setNotificationSettings() 구현
4. getAllActiveSubscribers() 구현

### Phase 1.8 (dmSender.ts)
1. sendNotificationDM() 구현
2. Rate Limit 처리 추가
3. 에러 핸들링 (DM 차단 등)

### Phase 2.1 (errorLog.ts)
1. saveErrorLog() 구현
2. getErrorLogs() 구현

### Phase 2.2 (broadcast.ts)
1. saveBroadcast() 구현
2. getBroadcastHistory() 구현

### Phase 2 (ai/huggingface/)
1. client.ts 생성
2. HfInference 클라이언트 초기화
3. models.ts 설정

---

*최종 수정: 2026-01-05*
