import "@/common/utils/systemLogger"; // globalLogger 전역 등록
import { RedisClientType } from "redis";
import type { JobHashes } from "@/common/types";
import { RecruitKeyManager } from "../key/recruitKeyManager";

/**
 * 빈 목록을 저장했음을 나타내는 표시 항목.
 * Redis 해시는 항목이 없으면 키도 사라져 "빈 목록"과 "저장한 적 없음"을 구분할 수 없다.
 */
const EMPTY_MARKER = "__empty__";

/**
 * 지난 알림 때 목록 저장소. 해시 `recruit:notified:all` (공고 ID → 비교값)
 *
 * 캐시가 아니라 어디까지 알렸는지 표시하는 기준이라 만료 시간을 두지 않는다.
 * 알림마다 통째로 바뀌므로 지금 목록에 없는 ID는 남지 않는다.
 */
export class NotifiedHashStore {
  constructor(
    private readonly client: RedisClientType,
    private readonly keyManager: RecruitKeyManager
  ) {}

  private getKey() {
    return this.keyManager.getKeys().notified;
  }

  /**
   * 지난 알림 때 목록을 읽는다.
   *
   * @returns 공고 ID → 비교값. 키가 없으면 null, 빈 목록을 저장했으면 빈 객체
   */
  async getAll(): Promise<JobHashes | null> {
    const stored = await this.client.hGetAll(this.getKey());
    // 키 없음을 먼저 판정한다. 표시 항목을 먼저 빼면 빈 목록도 키 없음으로 처리된다.
    if (Object.keys(stored).length === 0) return null;
    return Object.fromEntries(Object.entries(stored).filter(([id]) => id !== EMPTY_MARKER));
  }

  /**
   * 지난 알림 때 목록을 통째로 바꾼다.
   *
   * 지우기와 저장을 `multi()`로 묶는다. 지운 뒤 저장이 실패하면 키가 사라져
   * 다음 알림이 첫 실행으로 처리되고 DM이 빠지기 때문이다.
   *
   * @param hashes 공고 ID → 비교값. 비어 있으면 표시 항목을 저장한다
   */
  async clearAndSaveHashes(hashes: JobHashes): Promise<void> {
    const key = this.getKey();
    const entries = Object.keys(hashes).length > 0 ? hashes : { [EMPTY_MARKER]: "1" };
    await this.client.multi().del(key).hSet(key, entries).exec();
    globalLogger.info(`Saved notified hashes: ${Object.keys(hashes).length}`);
  }
}
