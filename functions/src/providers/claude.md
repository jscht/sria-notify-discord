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

### dmSender.ts (Phase 1.8 확정 계약)
**역할**: Discord DM 발송, Rate Limit·차단 처리 (graceful degradation)

> **구현 SoT**: `providers/discord/utils/dmSender.ts`
> **계약**: 시그니처는 **embeds 기반 포맷 무관**(format-agnostic) — 후속 4개 Phase(1.9/1.10/2.1/2.2)의 공유 계약이므로 `title/recruits` 같은 포맷을 시그니처에 박지 않는다.

```typescript
import type { MessageCreateOptions } from "discord.js";
import { client } from "@/providers/discord/client";
import { providerLogger } from "@/common/utils/systemLogger";

export interface DmPayload {
  embeds?: MessageCreateOptions["embeds"]; // 호출 측 빌더 산출물 (예: notificationMessageEmbed)
  content?: string;
}

export interface DmSendResult {
  ok: boolean;          // 전송 성공 여부 (skip도 ok=false)
  skipped?: boolean;    // DM 차단(50007) 등 "보낼 수 없는 정상 상태"
  reason?: string;      // "dm_disabled" | "unknown_user" | "max_retries"
  errorCode?: number;   // Discord API 에러 코드 (기록용)
  durationMs: number;
  attempts: number;
}

// 포맷 무관 — 임베드는 호출 측(이벤트 핸들러)이 빌더로 완성해 전달.
// provider 계층은 throw 금지 — 모든 결과를 DmSendResult로 흡수 반환.
export async function sendNotificationDM(
  userId: string,
  payload: DmPayload
): Promise<DmSendResult>;
```

**에러 분류** (`error.code` switch + RateLimitError 방어):

| 코드/유형 | 처리 | 재시도 | 로깅 |
|-----------|------|--------|------|
| `50007` (DM 차단/공유 길드 없음) | graceful skip `{ ok:false, skipped:true, reason:"dm_disabled" }` | ❌ | `providerLogger.warn` |
| `10013` (Unknown User) | 실패 `{ ok:false, reason:"unknown_user" }` | ❌ | `providerLogger.error` |
| 429 / `RateLimitError` | 대기 후 재시도 | ✅ | `providerLogger.warn` |
| 그 외 미지 코드 | 짧은 backoff 후 재시도, 소진 시 `{ ok:false, reason:"max_retries" }` | ✅ (최대 3회) | `providerLogger.error` |
| 성공 | `{ ok:true }` | — | `providerLogger.info` |

**discord.js 14.17 rate limit 단위 (중요)**:
- 기본 설정(`rejectOnRateLimit: null`)에서 discord.js REST는 rate limit을 **내부 큐로 흡수·대기**하므로 보통 `RateLimitError`를 throw하지 않는다(내부 `retries: 3` 포함).
- 방어적으로 `RateLimitError`를 받을 경우 `retryAfter`/`timeToReset`는 **밀리초(ms)** 단위다 — 원시 HTTP의 `retry_after`(초)와 다르므로 **`*1000` 보정 금지**.
- 구독자 간 발송 간격은 v14 REST 내장 큐에 위임한다. `setTimeout` 기반 순차 발송 헬퍼(`sendBulkNotifications`)는 본 Phase 범위가 아니며, 순차 발송 블로킹 비용은 Phase 1.9 E2E에서 실측한다.

**금지 사항**:
- `console.log`/`console.error` 금지 → 성공(info)/skip(warn)/실패(error) 모두 `providerLogger`(LogSource `provider`).
- provider 계층은 services/features 참조 금지.

---

## firebase/store/subscription.ts (NEW - Phase 1.4)

### 역할
사용자 알림 설정 CRUD

### Firestore 스키마
```
users/{userId}/notifications/settings   (문서 ID는 고정값 "settings")
{
  alertMode: 'ALL' | 'SELECTED',
  regions: CityEn[],
  enabled: boolean,
  createdAt: Timestamp,   // 앱 계층은 number(ms)로 인지 — store가 Timestamp ↔ number 변환
  updatedAt: Timestamp
}
```

### 구현

> **구현 SoT**: `providers/firebase/store/subscription.ts` (class `SubscriptionStore`)
> **타입 SoT**: `@/common/types` (`AlarmSubscription` / `AlarmSubscriptionInput` / `AlertMode`)
>
> 예시 코드를 복제하지 않고 시그니처·계약만 요약한다 (문서-코드 드리프트 방지). 정확한 구현은 위 파일 참조.

| 메서드 | 반환 | 비고 |
|--------|------|------|
| `getNotificationSettings(userId)` | `AlarmSubscription \| null` | 없으면 `null` (자동 생성 X) |
| `setNotificationSettings(userId, input)` | `void` | CQS 쓰기 전용. 신규=createdAt+updatedAt, 기존=updatedAt만 |
| `updateAlertMode(userId, mode)` | `void` | `update()` — 문서 없으면 NOT_FOUND throw |
| `updateAlertRegions(userId, regions)` | `void` | `update()` |
| `toggleNotificationEnabled(userId, enabled)` | `void` | `update()` |
| `getAllActiveSubscribers()` | `AlarmSubscription[]` | `collectionGroup('notifications')` + `enabled==true` |

**계약**:
- `Timestamp ↔ number` 변환은 store 경계(`toAlarmSubscription` 헬퍼)에서만 수행 — 외부 코드는 항상 `number`(ms)
- 쓰기 메서드는 `void`, 읽기 메서드만 데이터 반환 (CQS). 부분 업데이트는 `setNotificationSettings` 선행 전제
- `ProxyStore` 패턴 준수: `private readonly db = getFirestore()`, private `getSettingsRef`, `providerLogger` 사용
- 인스턴스화: `const subscriptionStore = new SubscriptionStore();` (싱글톤 export 없음)

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

### Phase 1.4 (subscription.ts) ✅ 완료
- class `SubscriptionStore` 6개 메서드 구현 (CQS, `update()` 부분 업데이트, `Timestamp↔number` 격리)
- 상세: 위 `firebase/store/subscription.ts` 섹션 참조

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

*최종 수정: 2026-05-25*
