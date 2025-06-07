import { Firestore } from "firebase-admin/firestore";
import { ConnectionStore } from "../store";
import { FirebaseCollection } from "../constants/collections";

export async function initConnectionCollection(db: Firestore, init: boolean = false) {
  const connStore = new ConnectionStore();
  const snapshot = await db.collection(FirebaseCollection.CONNECTION).limit(1).get();

  if (init || snapshot.empty) {
    await db.collection(FirebaseCollection.CONNECTION)
      .doc(connStore.getConnectionCheckDoc())
      .set({ conn: connStore.getConnectionCheckMessage() });
    DebugLogger.server("🛠️ connection 컬렉션 초기화 완료");
  } else {
    DebugLogger.server("⏩ connection 컬렉션은 이미 존재합니다. 초기화 생략");
  }
}