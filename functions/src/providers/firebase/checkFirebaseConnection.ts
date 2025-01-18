import { getFirestore } from "firebase-admin/firestore";

export async function checkFirebaseConnection() {
  try {
    const db = getFirestore();
    const docRef = db.doc("connection/check");

    const docSnap = await docRef.get();

    if (docSnap.exists) {
      DebugLogger.server("Firestore connection successful");
      return true;
    } else {
      DebugLogger.warn("Document 'connection/check' does not exist");
      return false;
    }
  } catch (error) {
    if (error instanceof Error) {
      DebugLogger.error("Firestore connection failed:", error);
    }
    return false;
  }
}
