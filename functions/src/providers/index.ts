import { initFirebaseApp } from "./firebase";
import { initRedis } from "./redis";

// worker들의 서비스 초기화 작업 (promise.all, 그냥 await의 시간 측정 해보기)

// 서버 실행 -> 파이어베이스 서버/데이터베이스 연결 확인, 레디스 초기화, 디스코드 서버 연결 확인
// 외부 서비스 연결 해제도 설정 필요 
export async function initializeProviders() {
  console.time("worker time");
  try {
    await Promise.all([
      initFirebaseApp(),
      initRedis()
    ]);
    console.timeEnd("worker time");
    DebugLogger.server('All providers initialized successfully.');
  } catch (error) {
    if (error instanceof Error) {
      DebugLogger.error('Error during providers initialization:', error);
    }
    throw error;
  }
}
