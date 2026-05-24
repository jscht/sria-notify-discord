# services 계층 - 개발 가이드

> 비즈니스 로직 작업 가이드

---

## 📋 이 계층의 역할

비즈니스 로직을 담당하며, 여러 Provider를 조율하고 트랜잭션을 관리합니다.

---

## 작업할 파일

```
services/
├── recruitService.ts          # 공고 조회 (기존)
├── recruitCacheService.ts     # 공고 캐시 관리 (기존 - Phase 1.3 수정)
├── crawlService.ts            # 크롤링 서비스 (기존)
├── notificationService.ts     # 알림 비즈니스 로직 (NEW - Phase 1.7)
├── errorReportService.ts      # 에러 리포팅 (NEW - Phase 2.1)
└── aiService.ts               # AI 통합 서비스 (NEW - Phase 2)
```

---

## recruitService.ts (기존 - Phase 1.6 리뷰)

### 역할
3-tier 캐싱 전략으로 공고 조회

### 구현
```typescript
export class RecruitService {
  async getRecruitList(): Promise<RecruitData[]> {
    // 1차: Redis 캐시 조회
    const cachedData = await getRecruitListFromRedis();
    if (cachedData) {
      console.log('[RecruitService] Cache hit: Redis');
      return cachedData;
    }

    // 2차: Firestore 조회
    const firestoreData = await getRecruitListFromFirestore();
    if (firestoreData) {
      console.log('[RecruitService] Cache hit: Firestore');
      await saveRecruitListToRedis(firestoreData, 1800); // TTL 30분
      return firestoreData;
    }

    // 3차: 크롤링 실행
    console.log('[RecruitService] Cache miss: Crawling...');
    const crawledData = await crawlService.crawlRecruitList();

    await Promise.all([
      saveRecruitListToRedis(crawledData, 1800),
      saveRecruitListToFirestore(crawledData)
    ]);

    return crawledData;
  }
}
```

---

## recruitCacheService.ts (기존 - Phase 1.3 수정)

### 역할
공고 캐시 업데이트 및 변경 감지

### 작업 내용 (Phase 1.3)
**이벤트 발행 추가**:

```typescript
import { eventBus } from '@/eventBus/EventBus';
import { EventType } from '@/eventBus/types';

export class RecruitCacheService {
  async setRecruitList(newJobs: Job[]): Promise<void> {
    const currentHashes = await getRecruitHashesFromRedis();
    const newHashes = this.generateHashes(newJobs);

    const { addedJobs, updatedJobs, deletedIds } = this.diffJobs(
      newJobs,
      newHashes,
      currentHashes
    );

    // 변경 사항이 있으면 이벤트 발행
    if (addedJobs.length > 0 || updatedJobs.length > 0 || deletedIds.length > 0) {
      console.log(`[RecruitCacheService] Changes detected:
        Added: ${addedJobs.length}
        Updated: ${updatedJobs.length}
        Deleted: ${deletedIds.length}`);

      // ⭐ 이벤트 발행 추가
      eventBus.emitEvent(EventType.RECRUIT_NEW, {
        type: EventType.RECRUIT_NEW,
        timestamp: new Date(),
        source: 'RecruitCacheService',
        data: { addedJobs, updatedJobs, deletedIds }
      });

      await Promise.all([
        saveRecruitHashesToRedis(newHashes),
        saveRecruitListToFirestore(newJobs)
      ]);
    }
  }

  private generateHashes(jobs: Job[]): JobHashes {
    // SHA-256 해시 생성
    const hashes: JobHashes = {};
    for (const job of jobs) {
      const content = JSON.stringify({
        title: job.title,
        region: job.region,
        startDate: job.startDate,
        endDate: job.endDate
      });
      hashes[job.id] = crypto.createHash('sha256').update(content).digest('hex');
    }
    return hashes;
  }

  private diffJobs(newJobs, newHashes, currentHashes) {
    // 추가/수정/삭제 감지
    const addedJobs = [];
    const updatedJobs = [];

    for (const job of newJobs) {
      const currentHash = currentHashes[job.id];
      const newHash = newHashes[job.id];

      if (!currentHash) addedJobs.push(job);
      else if (currentHash !== newHash) updatedJobs.push(job);
    }

    const deletedIds = Object.keys(currentHashes).filter(
      id => !newHashes[id]
    );

    return { addedJobs, updatedJobs, deletedIds };
  }
}
```

---

## notificationService.ts (NEW - Phase 1.7)

### 역할
구독자 조회, 필터링, 알림 발송 조율

### 구현
```typescript
import { eventBus } from '@/eventBus/EventBus';
import { EventType, RecruitNewEvent } from '@/eventBus/types';
import { SubscriptionStore } from '@/providers/firebase/store/subscription';
import { sendNotificationDM } from '@/providers/discord/utils/dmSender';
import { filterByRegion } from '@/features/notification/filters/RecruitFilter';

export class NotificationService {
  private readonly subscriptionStore = new SubscriptionStore();

  constructor() {
    // recruit.new 이벤트 리스너 등록
    eventBus.onEvent<RecruitNewEvent>(EventType.RECRUIT_NEW, (payload) => {
      this.notifyNewRecruits(payload.data);
    });
  }

  async notifyNewRecruits(data: {
    addedJobs: Job[];
    updatedJobs: Job[];
    deletedIds: string[];
  }): Promise<void> {
    const { addedJobs, updatedJobs } = data;
    const allNewRecruits = [...addedJobs, ...updatedJobs];

    if (allNewRecruits.length === 0) return;

    const subscribers = await this.subscriptionStore.getAllActiveSubscribers();
    console.log(`[NotificationService] Notifying ${subscribers.length} subscribers`);

    for (const subscriber of subscribers) {
      try {
        const filteredRecruits = this.filterRecruitsForUser(
          allNewRecruits,
          subscriber
        );

        if (filteredRecruits.length === 0) continue;

        await sendNotificationDM(subscriber.userId, {
          title: '🔔 새로운 채용 공고',
          recruits: filteredRecruits
        });

        eventBus.emitEvent(EventType.NOTIFICATION_SENT, {
          type: EventType.NOTIFICATION_SENT,
          timestamp: new Date(),
          source: 'NotificationService',
          data: { userId: subscriber.userId, count: filteredRecruits.length }
        });

      } catch (error) {
        console.error(`[NotificationService] Failed for user ${subscriber.userId}`);

        eventBus.emitEvent(EventType.NOTIFICATION_FAILED, {
          type: EventType.NOTIFICATION_FAILED,
          timestamp: new Date(),
          source: 'NotificationService',
          data: { userId: subscriber.userId, error: error.message }
        });
      }
    }
  }

  private filterRecruitsForUser(recruits: Job[], subscriber) {
    if (subscriber.alertMode === 'ALL') {
      return recruits;
    }
    return filterByRegion(recruits, subscriber.regions);
  }
}

export const notificationService = new NotificationService();
```

---

## errorReportService.ts (NEW - Phase 2.1)

### 역할
에러 포맷팅, 관리자 알림, Firestore 저장

### 구현
```typescript
import { eventBus } from '@/eventBus/EventBus';
import { EventType, ErrorCriticalEvent } from '@/eventBus/types';
import { sendNotificationDM } from '@/providers/discord/utils/dmSender';
import { saveErrorLog } from '@/providers/firebase/store/errorLog';

export class ErrorReportService {
  private adminUserId: string;

  constructor() {
    this.adminUserId = process.env.ADMIN_USER_ID || '';

    eventBus.onEvent<ErrorCriticalEvent>(EventType.ERROR_CRITICAL, (payload) => {
      this.reportCriticalError(payload.data.error, payload.data.context);
    });
  }

  async reportCriticalError(error: Error, context: Record<string, any>): Promise<void> {
    try {
      // 관리자 DM 전송
      await sendNotificationDM(this.adminUserId, {
        title: '🚨 Critical Error',
        description: `**Error**: ${error.message}\n\n**Context**: \`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\``,
        color: 0xFF0000
      });

      // Firestore 저장
      await saveErrorLog({
        type: 'critical',
        message: error.message,
        stack: error.stack || '',
        context,
        notifiedAdmin: true,
        createdAt: new Date()
      });

      console.log('[ErrorReportService] Error reported successfully');
    } catch (reportError) {
      console.error('[ErrorReportService] Failed to report error:', reportError);
    }
  }
}

export const errorReportService = new ErrorReportService();
```

---

## aiService.ts (NEW - Phase 2)

### 역할
AI 자연어 처리 및 의도 분석

### 구현
```typescript
import { HfInference } from '@huggingface/inference';

export class AIService {
  private hf: HfInference;

  constructor() {
    this.hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
  }

  /**
   * 자연어 의도 분석
   */
  async parseUserIntent(message: string): Promise<{
    action: 'recruit' | 'subscribe' | 'unsubscribe' | 'unknown';
    region?: string;
    regions?: string[];
  }> {
    try {
      // Zero-shot classification으로 의도 분류
      const result = await this.hf.zeroShotClassification({
        model: 'facebook/bart-large-mnli',
        inputs: message,
        parameters: {
          candidate_labels: ['공고 조회', '알림 설정', '알림 해제']
        }
      });

      const topLabel = result.labels[0];

      if (topLabel === '공고 조회') {
        return {
          action: 'recruit',
          region: this.extractRegion(message)
        };
      } else if (topLabel === '알림 설정') {
        return {
          action: 'subscribe',
          regions: this.extractRegions(message)
        };
      } else if (topLabel === '알림 해제') {
        return {
          action: 'unsubscribe'
        };
      }

      return { action: 'unknown' };

    } catch (error) {
      console.error('[AIService] Intent parsing failed:', error);
      return { action: 'unknown' };
    }
  }

  /**
   * 지역 추출 (단일)
   */
  private extractRegion(message: string): string | undefined {
    const regions = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종'];

    for (const region of regions) {
      if (message.includes(region)) {
        return region;
      }
    }

    return undefined;
  }

  /**
   * 지역 추출 (복수)
   */
  private extractRegions(message: string): string[] {
    const allRegions = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종'];
    const found: string[] = [];

    for (const region of allRegions) {
      if (message.includes(region)) {
        found.push(region);
      }
    }

    return found;
  }
}

export const aiService = new AIService();
```

---

## 의존성 규칙

### ✅ 허용
- services → providers
- services → eventBus

### ❌ 금지
- services → events (Presentation 계층)
- services → features

---

## 작업 순서

### Phase 1.3 (recruitCacheService)
1. EventBus import 추가
2. setRecruitList()에서 이벤트 발행 추가
3. 로그 개선

### Phase 1.7 (notificationService)
1. notificationService.ts 생성
2. recruit.new 이벤트 리스너 등록
3. 구독자 필터링 로직 구현
4. DM 발송 조율

### Phase 2.1 (errorReportService)
1. errorReportService.ts 생성
2. error.critical 이벤트 리스너 등록
3. 관리자 DM 전송 로직
4. Firestore 저장 로직

### Phase 2 (aiService)
1. aiService.ts 생성
2. Hugging Face 클라이언트 초기화
3. parseUserIntent() 구현
4. 지역 추출 로직 구현

---

*최종 수정: 2026-01-05*
