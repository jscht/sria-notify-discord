import { Express } from "express";
import { onRequest } from "firebase-functions/v2/https";

export function firebaseDeploy(app: Express) {
  try {
    return onRequest({
      region: "asia-northeast3",
      memory: "1GiB",
      timeoutSeconds: 180,

      // ──────────────────────────────────────────────────────────────
      // 운영 전환 시 활성화: 인스턴스를 항상 warm 유지하여 Discord 봇이
      // 재배포/재시작 직후부터 즉시 온라인 상태가 되도록 함.
      // - Firebase Blaze 요금제 필요 (월 단위 추가 과금)
      // - 비용/트래픽 패턴 검토 후 적용:
      //     minInstances: 1,
      // - 동시 처리 한도를 늘리려면 함께 검토:
      //     concurrency: 80,
      // 참고: cold start 모델에서는 첫 요청 전까지 봇 로그인이 일어나지
      //       않으므로, 항상 가용해야 하는 운영 환경에서만 활성화.
      // ──────────────────────────────────────────────────────────────
    }, app);
  } catch (error) {
    throw error;
  }
}