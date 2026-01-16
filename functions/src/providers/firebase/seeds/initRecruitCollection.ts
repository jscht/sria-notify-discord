import "@/common/utils/logger";
import { Firestore } from "firebase-admin/firestore";
import { RecruitStore } from "../store";
import { FirebaseCollection } from "../constants/collections";

export async function initRecruitCollection(db: Firestore, init: boolean = false) {
  const recruitStore = new RecruitStore();
  const snapshot = await db.collection(FirebaseCollection.RECRUIT).limit(1).get();

  if (init || snapshot.empty) {
    await db.collection(FirebaseCollection.RECRUIT)
      .doc(recruitStore.getInitDoc())
      .set({});
    globalLogger.info("🛠️ recruit 컬렉션 초기화 완료");
  } else {
    globalLogger.info("⏩ recruit 컬렉션은 이미 존재합니다. 초기화 생략");
  }
}