import "@/common/utils/systemLogger";
import { getFirestore } from "firebase-admin/firestore";
import type { Recruit } from "@/common/types";
import { FirebaseCollection } from "./../constants/collections";

interface RecruitListDoc {
  recruitList: Recruit[];
  /** 마지막 성공 크롤(갱신) 시각(ms). Phase 1.10 — staleness 안내 as-of. */
  lastRefreshedAt?: number;
}

export class RecruitStore {
  private readonly db = getFirestore();
  private static readonly INIT_DOC_ID = "list";

  constructor() {}

  private getRecruitCollectionRef() {
    return this.db.collection(FirebaseCollection.RECRUIT);
  }

  getInitDoc() {
    return RecruitStore.INIT_DOC_ID;
  }

  async getRecruitList(): Promise<Recruit[] | null> {
    const docRef = this.getRecruitCollectionRef().doc(RecruitStore.INIT_DOC_ID);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      globalLogger.warn("No recruit list found in Firestore.");
      return null;
    }

    const data = snapshot.data() as Partial<RecruitListDoc> | undefined;

    if (!data?.recruitList || !Array.isArray(data.recruitList)) {
      globalLogger.warn("Recruit list is missing or invalid in Firestore document.");
      return null;
    }

    return data.recruitList;
  }

  async saveRecruitList(data: Recruit[]): Promise<void> {
    const docRef = this.getRecruitCollectionRef().doc(RecruitStore.INIT_DOC_ID);
    // Phase 1.10: 성공 크롤 시각을 함께 기록 → staleness 안내 as-of.
    await docRef.set({ recruitList: data, lastRefreshedAt: Date.now() });
    globalLogger.info("Recruit list saved to Firestore successfully.");
  }

  /**
   * 마지막 성공 수집 시각만 갱신한다(merge). (Phase 1.10)
   *
   * 스케줄 sync는 Redis diff만 수행하고 Firestore 목록은 재기록하지
   * 않으므로, 성공 시 as-of 표기용 `lastRefreshedAt`만 병합 갱신한다.
   */
  async setLastRefreshedAt(ts: number = Date.now()): Promise<void> {
    const docRef = this.getRecruitCollectionRef().doc(RecruitStore.INIT_DOC_ID);
    await docRef.set({ lastRefreshedAt: ts }, { merge: true });
  }

  /**
   * 마지막 성공 크롤(갱신) 시각(ms)을 반환한다. (Phase 1.10)
   * 문서·필드가 없으면 null.
   */
  async getLastRefreshedAt(): Promise<number | null> {
    const docRef = this.getRecruitCollectionRef().doc(RecruitStore.INIT_DOC_ID);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data() as Partial<RecruitListDoc> | undefined;
    return typeof data?.lastRefreshedAt === "number" ? data.lastRefreshedAt : null;
  }
}
