import { sriaPostings, type SriaSeed } from "./sriaPostings";

/**
 * sria 사이트 설정. `schedule`은 Firebase 스케줄 주기(배포 시점 확정).
 */
export interface SriaMockConfig {
  /** Firebase cron/interval 문자열. 예: "every 4 hours". */
  schedule: string;
  /** localId 시작값(스냅샷 안정 id: `sria:${idBase + i}`). */
  idBase: number;
  postings: SriaSeed[];
}

export const sriaConfig: SriaMockConfig = {
  schedule: "every 4 hours",
  idBase: 100000,
  postings: sriaPostings,
};
