import { Firestore } from "firebase-admin/firestore";
import { ProxyStore } from "../store";
import { FirebaseCollection } from "../constants/collections";

export async function initProxyCollection(db: Firestore, init: boolean = false) {
  const proxyStore = new ProxyStore();
  const snapshot = await db.collection(FirebaseCollection.PROXY).limit(1).get();

  if (init || snapshot.empty) {
    await db.collection(FirebaseCollection.PROXY)
      .doc(proxyStore.getInitDoc())
      .set({});
    DebugLogger.server("🛠️ proxy 컬렉션 초기화 완료");
  } else {
    DebugLogger.server("⏩ proxy 컬렉션은 이미 존재합니다. 초기화 생략");
  }
}