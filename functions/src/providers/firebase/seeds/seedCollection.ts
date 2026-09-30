import "@/common/utils/systemLogger";
import { getFirestore } from "firebase-admin/firestore";
import { initConnectionCollection } from "./initConnectionCollection";
import { initRecruitCollection } from "./initRecruitCollection";

export async function seedCollection(init: boolean = false) {
  const db = getFirestore();

  try {
    await Promise.all([
      initConnectionCollection(db, init),
      initRecruitCollection(db, init),
    ]);

    globalLogger.info("✅ 초기화 작업 완료!");
  } catch (error) {
    if (error instanceof Error) {
      globalLogger.error("❌ 초기화 실패:", error);
    }
    process.exit(1);
  }
}