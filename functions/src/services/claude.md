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
      eventBus.emitEvent(EventType.RECRUIT_CHANGED, {
        type: EventType.RECRUIT_CHANGED,
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

## notificationService.ts (Phase 1.7, Phase 1.15)

### 역할
알림 스케줄러. 사이트를 갱신하고 지난 알림 때 목록과 비교한 뒤, 구독자별로 판정해 `NOTIFICATION_SEND`를 발행한다. 실제 DM 발송은 `NotificationSendHandler`가 맡는다.

### 구현

> **구현 SoT**: `services/notificationService.ts` (class `NotificationService`)
>
> 예시 코드를 복제하지 않고 시그니처·계약만 요약한다. 정확한 구현은 위 파일 참조.

| 이름 | 반환 | 비고 |
|------|------|------|
| `runNotification()` | `number` | 알림 1회 실행. 발송을 시도한 구독자 수를 돌려준다. DM이 실패해도 센다. 건너뛰거나 저장만 했으면 0 |
| `notifyRecruits(current, changedIds)` | `number` | 구독자별 판정과 `NOTIFICATION_SEND` 발행 |
| `getNotificationService()` | `NotificationService` | 처음 부를 때 만든다. 파일을 불러올 때 만들면 Redis 초기화 전이라 예외가 나므로, Redis 초기화 뒤에만 부른다 |

**실행 시각**: `schedulers/jobs.ts`의 `SCHEDULED_JOBS`에 있는 `notificationScheduler` 작업이다. 매일 06~20시 짝수 정시(한국 시간)에 돈다. 22~04시 사이 바뀐 공고는 06시 알림이 보낸다.

**`runNotification` 순서**:
1. 알림 락(`lock:notification`)을 잡는다. 못 잡으면 다른 실행이 진행 중이므로 바로 끝낸다
2. 사이트마다 `syncRecruits(source, FRESH_SYNC_OPTIONS)`로 갱신한다. 최근 5분 안에 갱신했으면 건너뛰고, 진행 중인 갱신은 끝날 때까지 기다린다
3. 최신 공고 목록을 지난 알림 때 목록(`recruit:notified:all`, 공고 ID → 비교값)과 비교해 새 공고와 내용이 바뀐 공고를 찾는다
4. `notifyRecruits`로 발송한다
5. 지난 알림 때 목록을 최신 목록으로 통째로 바꾼다. 발송 뒤에 저장하므로 발송 중 멈추면 다음 알림이 다시 보낸다 (누락보다 중복을 택한다)
6. Firestore 공고 목록을 저장한다. 실패해도 알림은 성공으로 끝나고 다음 알림에서 다시 저장한다

| 상황 | 처리 |
|------|------|
| 지난 알림 때 목록이 없음 (첫 실행이거나 키를 지움) | 저장만 하고 보내지 않는다. 이미 받은 공고를 다시 보내지 않기 위해서다 |
| 갱신에 실패한 사이트가 있고 최신 공고 목록이 비어 있음 | 경고 로그만 남기고 아무것도 저장하지 않는다. 비교 기준과 Firestore 목록을 지키기 위해서다 |
| 모든 사이트가 정상이고 공고가 0건 | 지난 알림 때 목록과 Firestore 목록을 비운다 |
| 구독자 목록 읽기 실패 | 예외를 그대로 전달한다. 지난 알림 때 목록을 저장하지 않으므로 다음 알림이 다시 시도한다 |

**`notifyRecruits` 판정 순서**:
1. 숨긴 사이트(`userFacing: false`)의 공고를 뺀다. `sources`가 `ALL`인 구독자에게도 가지 않는다
2. 접수중 → 발표중 → 종료 순서로, 같은 상태 안에서는 시작 날짜 최신순으로 정렬한다
3. 구독자마다 `sources`와 `regions`로 거른다
4. 거른 공고 중 바뀐 공고가 없으면 그 구독자는 건너뛴다
5. 거른 공고 전체를 `RecruitDisplay`로 바꿔 `NOTIFICATION_SEND`를 발행한다. 바뀌지 않은 공고도 함께 보낸다

**계약**:
- 사이트 갱신(`recruitService.syncRecruits`)은 DM을 보내지 않는다. `RECRUIT_CHANGED`는 발행되지만 구독하는 핸들러가 없다
- 최신 공고 목록에서 사라진 공고는 DM을 일으키지 않는다
- 구독자 한 명의 오류는 나머지 발송을 막지 않는다
- 쓰는 객체는 생성자로 받는다(`NotificationDeps`). 테스트는 가짜를 넘긴다

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

### Phase 1.7, Phase 1.15 (notificationService)
1. notificationService.ts 생성
2. `runNotification` 구현 후 `SCHEDULED_JOBS`에 알림 작업 등록
3. 구독자별 판정(`notifyRecruits`) 구현
4. `NOTIFICATION_SEND` 발행 (DM 발송은 `NotificationSendHandler`)

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

*최종 수정: 2026-11-01*
