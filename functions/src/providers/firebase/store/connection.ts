import "@/common/utils/systemLogger";
import { getFirestore } from "firebase-admin/firestore";
import { FirebaseCollection } from "./../constants/collections";

export class ConnectionStore {
  private readonly db = getFirestore();
  private static readonly CONFIRMATION_MESSAGE = "bestätigt";
  private static readonly INIT_DOC_ID = "check";

  constructor() {}

  private getFirebaseConnectionRef() {
    return this.db.collection(FirebaseCollection.CONNECTION);
  }

  getConnectionCheckDoc() {
    return ConnectionStore.INIT_DOC_ID;
  }

  getConnectionCheckMessage() {
    return ConnectionStore.CONFIRMATION_MESSAGE;
  }

  async getRecruitList() {
    try {
      const docRef = this.getFirebaseConnectionRef().doc(ConnectionStore.INIT_DOC_ID);
      const snapshot = await docRef.get();

      if (!snapshot.exists) {
        globalLogger.warn("No recruit list found in Firestore.");
        return null;
      }

      return snapshot.data();
    } catch (error) {
      throw error;
    }
  }
}