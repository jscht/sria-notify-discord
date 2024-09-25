import { getFirestore, doc, getDoc } from "firebase/firestore";
import { logger } from "firebase-functions";

export async function checkFirebaseConnection() {
  try {
    const db = getFirestore();
    const docRef = doc(db, "connection", "check");

    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      logger.info("Firestore connection successful");
      return true;
    } else {
      logger.warn("Document 'connection/check' does not exist");
      return false;
    }
  } catch (error) {
    logger.error("Firestore connection failed:", error);
    return false;
  }
}
