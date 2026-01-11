import { EventEmitter } from 'events';

/**
 * EventBus - Singleton 패턴으로 구현된 중앙 이벤트 허브
 *
 * Node.js EventEmitter를 확장하여 애플리케이션 전역에서 비즈니스 이벤트를 발행하고 구독할 수 있습니다.
 *
 * @example
 * ```typescript
 * import { eventBus } from '@/eventBus/EventBus';
 *
 * // 이벤트 발행
 * eventBus.emitEvent('recruit.new', { addedJobs: [] });
 *
 * // 이벤트 구독
 * eventBus.onEvent('recruit.new', async (payload) => {
 *   console.log('New recruits:', payload);
 * });
 * ```
 */
export class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    // 메모리 누수 경고 방지를 위해 최대 리스너 수 설정
    this.setMaxListeners(100);
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
   * @param event - 이벤트 이름
   * @param payload - 이벤트 페이로드
   * @returns 이벤트 리스너가 있는 경우 true, 없는 경우 false
   *
   * @example
   * ```typescript
   * eventBus.emitEvent('recruit.new', {
   *   addedJobs: [job1, job2],
   *   updatedJobs: [],
   *   deletedIds: []
   * });
   * ```
   */
  emitEvent<T>(event: string, payload: T): boolean {
    return this.emit(event, payload);
  }

  /**
   * 타입 안전성을 제공하는 이벤트 구독 메서드
   *
   * @param event - 구독할 이벤트 이름
   * @param listener - 이벤트 발생 시 호출될 리스너 함수
   * @returns EventBus 인스턴스 (체이닝 지원)
   *
   * @example
   * ```typescript
   * eventBus.onEvent<RecruitNewEvent>('recruit.new', async (payload) => {
   *   await notificationService.notifyNewRecruits(payload.data);
   * });
   * ```
   */
  onEvent<T>(event: string, listener: (payload: T) => void | Promise<void>): this {
    return this.on(event, listener);
  }

  /**
   * 일회성 이벤트 구독 메서드
   *
   * @param event - 구독할 이벤트 이름
   * @param listener - 이벤트 발생 시 1회만 호출될 리스너 함수
   * @returns EventBus 인스턴스 (체이닝 지원)
   *
   * @example
   * ```typescript
   * eventBus.onceEvent('app.initialized', () => {
   *   console.log('App initialized');
   * });
   * ```
   */
  onceEvent<T>(event: string, listener: (payload: T) => void | Promise<void>): this {
    return this.once(event, listener);
  }

  /**
   * 이벤트 리스너 제거 메서드
   *
   * @param event - 이벤트 이름
   * @param listener - 제거할 리스너 함수
   * @returns EventBus 인스턴스 (체이닝 지원)
   *
   * @example
   * ```typescript
   * const handler = (payload) => console.log(payload);
   * eventBus.onEvent('recruit.new', handler);
   * // 나중에 제거
   * eventBus.offEvent('recruit.new', handler);
   * ```
   */
  offEvent<T>(event: string, listener: (payload: T) => void | Promise<void>): this {
    return this.off(event, listener);
  }

  /**
   * 특정 이벤트의 모든 리스너 제거
   *
   * @param event - 이벤트 이름
   * @returns EventBus 인스턴스 (체이닝 지원)
   *
   * @example
   * ```typescript
   * eventBus.removeAllListeners('recruit.new');
   * ```
   */
  removeAllListenersForEvent(event: string): this {
    return this.removeAllListeners(event);
  }

  /**
   * 특정 이벤트의 리스너 수 반환
   *
   * @param event - 이벤트 이름
   * @returns 리스너 수
   *
   * @example
   * ```typescript
   * const count = eventBus.listenerCountForEvent('recruit.new');
   * console.log(`Listeners: ${count}`);
   * ```
   */
  listenerCountForEvent(event: string): number {
    return this.listenerCount(event);
  }
}

/**
 * 전역에서 사용할 수 있는 EventBus 싱글톤 인스턴스
 *
 * @example
 * ```typescript
 * import { eventBus } from '@/eventBus/EventBus';
 *
 * eventBus.emitEvent('recruit.new', data);
 * ```
 */
export const eventBus = EventBus.getInstance();
