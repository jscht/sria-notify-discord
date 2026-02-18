import "@/common/utils/systemLogger";
import { getFirestore } from "firebase-admin/firestore";
import type { RecruitData } from "@/crawlers/types";
import { FirebaseCollection } from "./../constants/collections";

interface RecruitListDoc {
  recruitList: RecruitData[];
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

  async getRecruitList(): Promise<RecruitData[] | null> {
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

  async saveRecruitList(data: RecruitData[]): Promise<void> {
    const docRef = this.getRecruitCollectionRef().doc(RecruitStore.INIT_DOC_ID);
    await docRef.set({ recruitList: data });
    globalLogger.info("Recruit list saved to Firestore successfully.");
  }
}
