import { getFirestore } from "firebase-admin/firestore";
import { ResponseRecruitData } from "../../../types/responseRecruitData";

export class RecruitStore {
  private readonly db = getFirestore();

  constructor() {}

  #getRecruitCollectionRef() {
    return this.db.collection("recruit"); // doc("recruit/list");
  }

  async getRecruitList() {
    try {
      const docRef = this.#getRecruitCollectionRef().doc("list");
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
      const docRef = this.#getRecruitCollectionRef().doc("list");
      await docRef.set({ recruitList: data });
      DebugLogger.server("Recruit list saved to Firestore successfully.");
    } catch (error) {
      throw error;
    }
  }
}
