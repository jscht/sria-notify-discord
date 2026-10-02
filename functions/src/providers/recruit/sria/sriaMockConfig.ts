import { sriaPostings, type SriaSeed } from "./sriaPostings";

/**
 * sria 사이트 설정. `intervalMinutes`는 스케줄 주기의 단일 출처(배포 시점 확정).
 * onSchedule 표현식과 상시 루프용 ms를 이 숫자 하나에서 파생한다.
 */
export interface SriaMockConfig {
  /** 스케줄 주기(분). 예: 240 = 4시간. */
  intervalMinutes: number;
  /** localId 시작값(스냅샷 안정 id: `sria:${idBase + i}`). */
  idBase: number;
  postings: SriaSeed[];
}

export const sriaConfig: SriaMockConfig = {
  intervalMinutes: 240,
  idBase: 100000,
  postings: sriaPostings,
};
