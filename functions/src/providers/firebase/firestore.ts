import { getFirestore } from "firebase-admin/firestore";
import { ResponseRecruitData } from "../../types/responseRecruitData";

export class RecruitFireStore {
  private readonly db = getFirestore();

  constructor() {}

  #getRecruitListDocRef() {
    return this.db.doc("recruit/list");
  }

  async getRecruitList() {
    try {
      const docRef = this.#getRecruitListDocRef();
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        DebugLogger.warn("No recruit list found in Firestore.");
        return null;
      }
      return docSnap.data();
    } catch (error) {
      if (error instanceof Error) {
        DebugLogger.error("Error retrieving recruit list from Firestore:", error);
      }
      throw new Error("Failed to retrieve recruit list from Firestore.");
    }
  }

  async saveRecruitList(data: ResponseRecruitData[]) {
    try {
      const docRef = this.#getRecruitListDocRef();
      await docRef.set({ recruitList: data });
      DebugLogger.server("Recruit list saved to Firestore successfully.");
    } catch (error) {
      if (error instanceof Error) {
        DebugLogger.error("Error saving recruit list to Firestore:", error);
      }
      throw new Error("Failed to save recruit list to Firestore.");
    }
  }
}
