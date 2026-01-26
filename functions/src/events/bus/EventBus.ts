import { EventEmitter } from 'events';
import type { EventType } from './types';
import { EVENT_BUS_CONFIG } from './constants';
import { eventLogger } from './utils/eventLogger';

/**
 * EventBus - Singleton 패턴으로 구현된 중앙 이벤트 허브
 *
 * Node.js EventEmitter를 확장하여 애플리케이션 전역에서 비즈니스 이벤트를 발행하고 구독할 수 있습니다.
 *
 * @example
 * ```typescript
 * import { eventBus, EventType } from '@/events';
 *
 * // 이벤트 발행
 * eventBus.emitEvent(EventType.RECRUIT_NEW, {
 *   timestamp: Date.now(),
 *   addedJobs: [],
 *   updatedJobs: [],
 *   deletedIds: []
 * });
 *
 * // 이벤트 구독
 * eventBus.onEvent(EventType.RECRUIT_NEW, async (payload) => {
 *   console.log('New recruits:', payload);
 * });
 * ```
 */
export class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    // 메모리 누수 경고 방지를 위해 최대 리스너 수 설정
    this.setMaxListeners(EVENT_BUS_CONFIG.MAX_LISTENERS);

    // EventBus 초기화 로그
    eventLogger.busInitialized();
  }

  /**
   * EventBus의 싱글톤 인스턴스를 반환합니다.
   *
   * @returns EventBus 싱글톤 인스턴스
   */
  static getInstance(): EventBus {
    if (!this.instance) {
      this.instance = new EventBus();
    }
    return this.instance;
  }

  /**
   * 타입 안전성을 제공하는 이벤트 발행 메서드
   *
   * @param event - 이벤트 타입 (EventType enum)
   * @param payload - 이벤트 페이로드
   * @returns 이벤트 리스너가 있는 경우 true, 없는 경우 false
   *
   * @example
   * ```typescript
   * eventBus.emitEvent(EventType.RECRUIT_NEW, {
   *   timestamp: Date.now(),
   *   addedJobs: [job1, job2],
   *   updatedJobs: [],
   *   deletedIds: []
   * });
   * ```
   */
  emitEvent<T>(event: EventType, payload: T): boolean {
    const hasListeners = this.listenerCount(event) > 0;
    const result = this.emit(event, payload);

    // 이벤트 발행 로그
    eventLogger.emitted(event, hasListeners);

    return result;
  }

  /**
   * 타입 안전성을 제공하는 이벤트 구독 메서드
   *
   * @param event - 구독할 이벤트 타입 (EventType enum)
   * @param listener - 이벤트 발생 시 호출될 리스너 함수
   * @returns EventBus 인스턴스 (체이닝 지원)
   *
   * @example
   * ```typescript
   * eventBus.onEvent<RecruitNewEvent>(EventType.RECRUIT_NEW, async (payload) => {
   *   await notificationService.notifyNewRecruits(payload);
   * });
   * ```
   */
  onEvent<T>(event: EventType, listener: (payload: T) => void | Promise<void>): this {
    this.on(event, listener);

    // 리스너 등록 로그
    eventLogger.listenerAdded(event, this.listenerCount(event));

    return this;
  }

  /**
   * 일회성 이벤트 구독 메서드
   *
   * @param event - 구독할 이벤트 타입 (EventType enum)
   * @param listener - 이벤트 발생 시 1회만 호출될 리스너 함수
   * @returns EventBus 인스턴스 (체이닝 지원)
   *
   * @example
   * ```typescript
   * eventBus.onceEvent(EventType.RECRUIT_CRAWL_COMPLETED, () => {
   *   console.log('Crawl completed');
   * });
   * ```
   */
  onceEvent<T>(event: EventType, listener: (payload: T) => void | Promise<void>): this {
    return this.once(event, listener);
  }

  /**
   * 이벤트 리스너 제거 메서드
   *
   * @param event - 이벤트 타입 (EventType enum)
   * @param listener - 제거할 리스너 함수
   * @returns EventBus 인스턴스 (체이닝 지원)
   *
   * @example
   * ```typescript
   * const handler = (payload) => console.log(payload);
   * eventBus.onEvent(EventType.RECRUIT_NEW, handler);
   * // 나중에 제거
   * eventBus.offEvent(EventType.RECRUIT_NEW, handler);
   * ```
   */
  offEvent<T>(event: EventType, listener: (payload: T) => void | Promise<void>): this {
    this.off(event, listener);

    // 리스너 제거 로그
    eventLogger.listenerRemoved(event, this.listenerCount(event));

    return this;
  }

  /**
   * 특정 이벤트의 모든 리스너 제거
   *
   * @param event - 이벤트 타입 (EventType enum)
   * @returns EventBus 인스턴스 (체이닝 지원)
   *
   * @example
   * ```typescript
   * eventBus.removeAllListenersForEvent(EventType.RECRUIT_NEW);
   * ```
   */
  removeAllListenersForEvent(event: EventType): this {
    this.removeAllListeners(event);

    // 모든 리스너 제거 로그
    eventLogger.allListenersRemoved(event);

    return this;
  }

  /**
   * 특정 이벤트의 리스너 수 반환
   *
   * @param event - 이벤트 타입 (EventType enum)
   * @returns 리스너 수
   *
   * @example
   * ```typescript
   * const count = eventBus.listenerCountForEvent(EventType.RECRUIT_NEW);
   * console.log(`Listeners: ${count}`);
   * ```
   */
  listenerCountForEvent(event: EventType): number {
    return this.listenerCount(event);
  }
}

/**
 * 전역에서 사용할 수 있는 EventBus 싱글톤 인스턴스
 *
 * @example
 * ```typescript
 * import { eventBus, EventType } from '@/eventBus';
 *
 * eventBus.emitEvent(EventType.RECRUIT_NEW, data);
 * ```
 */
export const eventBus = EventBus.getInstance();
