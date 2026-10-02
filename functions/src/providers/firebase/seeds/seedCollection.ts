import "@/common/utils/systemLogger";
import { getFirestore } from "firebase-admin/firestore";
import { SystemError } from "@/common/utils";
import { initConnectionCollection } from "./initConnectionCollection";
import { initRecruitCollection } from "./initRecruitCollection";

export async function seedCollection(init = false) {
  const db = getFirestore();

  try {
    await Promise.all([
      initConnectionCollection(db, init),
      initRecruitCollection(db, init),
    ]);

    globalLogger.info("✅ 초기화 작업 완료!");
  } catch (error) {
    // exit/throw 없음 — 로깅 후 정상 반환(swallow).
    // 호출부(initFirebaseApp.ts)가 fire-and-forget이므로 rethrow하면
    // unhandled promise rejection으로 프로세스가 죽는다(§2.2 함정).
    SystemError.firestoreError(
      "초기화 컬렉션 시드 실패 (계속 진행)",
      error instanceof Error ? error : undefined,
      { init },
    );
  }
}
