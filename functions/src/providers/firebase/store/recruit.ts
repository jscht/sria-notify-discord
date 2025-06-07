import { getFirestore } from "firebase-admin/firestore";
import { ResponseRecruitData } from "../../../types/responseRecruitData";
import { FirebaseCollection } from "./../constants/collections";

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

  async getRecruitList() {
    try {
      const docRef = this.getRecruitCollectionRef().doc(RecruitStore.INIT_DOC_ID);
      const snapshot = await docRef.get();

      if (!snapshot.exists) {
        DebugLogger.warn("No recruit list found in Firestore.");
        return null;
      }

      return snapshot.data();
    } catch (error) {
      throw error;
    }
  }

  async saveRecruitList(data: ResponseRecruitData[]) {
    try {
      const docRef = this.getRecruitCollectionRef().doc(RecruitStore.INIT_DOC_ID);
      await docRef.set({ recruitList: data });
      DebugLogger.server("Recruit list saved to Firestore successfully.");
    } catch (error) {
      throw error;
    }
  }
}