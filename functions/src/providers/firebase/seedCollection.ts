import { getFirestore } from "firebase-admin/firestore";

enum FirebaseCollection {
  CONNECTION = "connection",
  RECRUIT = "recruit",
  PROXY = "proxy"
}

export async function seedCollection(init: boolean = false) {
  const db = getFirestore();
  const tasks = [];

  async function isCollectionEmpty(collection: FirebaseCollection) {
    const snapshot = await db.collection(collection).limit(1).get();
    return snapshot.empty;
  }

  const { PROXY, CONNECTION, RECRUIT } = FirebaseCollection;

  try {
    // proxy 컬렉션
    if (init || await isCollectionEmpty(PROXY)) {
      tasks.push(
        db.collection(PROXY).doc("init").set({})
      );
      DebugLogger.server("🛠️ proxy 컬렉션 초기화 예정");
    } else {
      DebugLogger.server("⏩ proxy 컬렉션은 이미 존재합니다. 초기화 생략");
    }

    // connection 컬렉션
    if (init || await isCollectionEmpty(CONNECTION)) {
      tasks.push(
        db.collection(CONNECTION).doc("check").set({
          conn: "bestätigt",
        })
      );
      DebugLogger.server("🛠️ connection 컬렉션 초기화 예정");
    } else {
      DebugLogger.server("⏩ connection 컬렉션은 이미 존재합니다. 초기화 생략");
    }

    // recruit 컬렉션
    if (init || await isCollectionEmpty(RECRUIT)) {
      tasks.push(
        db.collection(RECRUIT).doc("init").set({})
      );
      DebugLogger.server("🛠️ recruit 컬렉션 초기화 예정");
    } else {
      DebugLogger.server("⏩ recruit 컬렉션은 이미 존재합니다. 초기화 생략");
    }

    await Promise.all(tasks);
    DebugLogger.server("✅ 초기화 작업 완료!");
  } catch (error) {
    if (error instanceof Error) {
        DebugLogger.error("❌ 초기화 실패:", error);
    }
    process.exit(1);
  }
}
