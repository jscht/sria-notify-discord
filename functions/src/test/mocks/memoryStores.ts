/**
 * 메모리 기반 가짜 저장소.
 *
 * 실제 Redis·Firestore에 연결하지 않고 서비스 코드를 실행하기 위해 쓴다.
 * 이 파일을 불러와도 `REDIS_URL`은 필요하지 않다.
 */

import "@/common/utils/systemLogger"; // RecruitCacheService가 쓰는 globalLogger 전역 등록
import type { RedisClientType } from "redis";
import type { AlarmSubscription, Recruit, RecruitSource } from "@/common/types";
import type { RecruitStore, SubscriptionStore } from "@/providers/firebase/store";
import { redisKeyManager } from "@/providers/redis/key";
import type { RecruitCacheStore, RecruitHashStore } from "@/providers/redis/store";
import { RecruitCacheService } from "@/services/recruitCacheService";
import type { RecruitSourceService } from "@/services/recruitSourceService";

/** 사이트 락 키. */
export function siteLockKey(source: RecruitSource): string {
  return `lock:recruit:sync:${source}`;
}

/** 사이트별 마지막 갱신 시각 키. */
export function lastSyncKey(source: RecruitSource): string {
  return redisKeyManager.recruit.getKeys().lastSync(source);
}

/** 가짜 `RecruitCacheStore`. 실제 저장소처럼 JSON으로 저장한다. */
export class MemoryRecruitCacheStore {
  readonly items = new Map<string, string>();

  async save(id: string, data: Recruit, expiration: number): Promise<void> {
    this.items.set(id, JSON.stringify(data));
  }

  async getAll(): Promise<Recruit[] | null> {
    if (this.items.size === 0) return null;
    return Array.from(this.items.values(), (json) => JSON.parse(json) as Recruit);
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }

  async expire(expiration: number): Promise<void> {}

  clear(): void {
    this.items.clear();
  }
}

/** 가짜 `RecruitHashStore`. */
export class MemoryRecruitHashStore {
  readonly hashes = new Map<string, string>();

  async save(id: string, hash: string, expiration: number): Promise<void> {
    this.hashes.set(id, hash);
  }

  async getAll(): Promise<Record<string, string> | null> {
    return this.hashes.size > 0 ? Object.fromEntries(this.hashes) : null;
  }

  async delete(id: string): Promise<void> {
    this.hashes.delete(id);
  }

  async expire(expiration: number): Promise<void> {}

  clear(): void {
    this.hashes.clear();
  }
}

/** 가짜 저장소를 연결한 실제 `RecruitCacheService`를 만든다. */
export function createMemoryCache() {
  const cacheStore = new MemoryRecruitCacheStore();
  const hashStore = new MemoryRecruitHashStore();
  const service = new RecruitCacheService(
    cacheStore as unknown as RecruitCacheStore,
    hashStore as unknown as RecruitHashStore
  );
  return { cacheStore, hashStore, service };
}

/** `MemoryRedisClient.multi()`가 돌려주는 명령 묶음. */
export interface MemoryMulti {
  del(key: string): MemoryMulti;
  hSet(key: string, entries: Record<string, string>): MemoryMulti;
  exec(): Promise<unknown[]>;
}

/**
 * 가짜 Redis 클라이언트(`hGetAll`, `multi`).
 *
 * `multi()` 안의 명령은 `exec()`에서 한 번에 적용한다. 실패하면 아무것도 적용하지 않는다.
 */
export class MemoryRedisClient {
  readonly hashes = new Map<string, Record<string, string>>();
  /** true면 다음 `exec()`가 실패한다. */
  failNextExec = false;

  async hGetAll(key: string): Promise<Record<string, string>> {
    return { ...this.hashes.get(key) };
  }

  multi(): MemoryMulti {
    const commands: Array<() => void> = [];
    const chain: MemoryMulti = {
      del: (key) => {
        commands.push(() => this.hashes.delete(key));
        return chain;
      },
      hSet: (key, entries) => {
        commands.push(() => this.hashes.set(key, { ...this.hashes.get(key), ...entries }));
        return chain;
      },
      exec: async () => {
        if (this.failNextExec) {
          this.failNextExec = false;
          throw new Error("multi 실행 실패");
        }
        commands.forEach((command) => command());
        return [];
      },
    };
    return chain;
  }

  asClient(): RedisClientType {
    return this as unknown as RedisClientType;
  }
}

/** 가짜 `RedisManager`. 락과 문자열 값만 다룬다. 만료 시간은 적용하지 않는다. */
export class MemoryLockRedis {
  private readonly locks = new Map<string, string>();
  private readonly values = new Map<string, string>();
  private tokenCount = 0;

  async acquireLock(key: string, ttlMs: number): Promise<string | null> {
    return this.locks.has(key) ? null : this.hold(key);
  }

  async releaseLock(key: string, token: string): Promise<void> {
    if (this.locks.get(key) === token) this.locks.delete(key);
  }

  async getValue(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setValue(key: string, value: string, ttlMs: number): Promise<void> {
    this.values.set(key, value);
  }

  /** 락을 바로 잡는다. 다른 프로세스가 잡고 있는 상태를 만들 때 쓴다. */
  hold(key: string): string {
    this.tokenCount++;
    const token = `token-${this.tokenCount}`;
    this.locks.set(key, token);
    return token;
  }

  isLocked(key: string): boolean {
    return this.locks.has(key);
  }

  deleteValue(key: string): void {
    this.values.delete(key);
  }
}

/** 가짜 `RecruitSourceService`. 사이트 가져오기 시각을 기록한다. */
export class FakeRecruitSource {
  readonly lists: Record<RecruitSource, Recruit[]>;
  /** 가져오기가 실패할 사이트. */
  readonly failing = new Set<RecruitSource>();
  private fetchLog: Record<RecruitSource, number[]> = { sria: [], elias: [] };

  constructor(lists: Partial<Record<RecruitSource, Recruit[]>> = {}) {
    this.lists = { sria: lists.sria ?? [], elias: lists.elias ?? [] };
  }

  async fetchBySource(source: RecruitSource): Promise<Recruit[]> {
    this.fetchLog[source].push(Date.now());
    if (this.failing.has(source)) throw new Error(`${source} 가져오기 실패`);
    return [...this.lists[source]];
  }

  fetchCount(source: RecruitSource): number {
    return this.fetchLog[source].length;
  }

  /** 첫 번째 가져오기가 시작된 시각. 가져온 적이 없으면 예외를 낸다. */
  firstFetchAt(source: RecruitSource): number {
    const [startedAt] = this.fetchLog[source];
    if (startedAt === undefined) throw new Error(`${source}를 가져온 적이 없음`);
    return startedAt;
  }

  resetFetchLog(): void {
    this.fetchLog = { sria: [], elias: [] };
  }

  asService(): RecruitSourceService {
    return this as unknown as RecruitSourceService;
  }
}

/** 가짜 `RecruitStore`. */
export class FakeRecruitStore {
  /** Firestore 공고 목록. */
  list: Recruit[] | null = null;
  /** `saveRecruitList`에 넘어온 목록. 저장이 실패해도 기록한다. */
  readonly saveCalls: Recruit[][] = [];
  /** true면 `saveRecruitList`가 실패한다. */
  failSave = false;

  async getRecruitList(): Promise<Recruit[] | null> {
    return this.list;
  }

  async saveRecruitList(data: Recruit[]): Promise<void> {
    this.saveCalls.push(data);
    if (this.failSave) throw new Error("Firestore 저장 실패");
    this.list = data;
  }

  async setLastRefreshedAt(): Promise<void> {}

  asStore(): RecruitStore {
    return this as unknown as RecruitStore;
  }
}

/** 가짜 `SubscriptionStore`. */
export class FakeSubscriptionStore {
  /** true면 다음 구독자 목록 읽기가 실패한다. */
  failNextRead = false;

  constructor(private readonly subscribers: AlarmSubscription[]) {}

  async getAllActiveSubscribers(): Promise<AlarmSubscription[]> {
    if (this.failNextRead) {
      this.failNextRead = false;
      throw new Error("구독자 목록 읽기 실패");
    }
    return this.subscribers;
  }

  asStore(): SubscriptionStore {
    return this as unknown as SubscriptionStore;
  }
}
