import dotenv from "dotenv";
dotenv.config();
import "@/common/utils/systemLogger";
import { bootstrapGateway } from "./bootstrapGateway";

/**
 * 게이트웨이 standalone 엔트리 (E안 · 프로세스 A) — WS-only.
 *
 * pm2가 `node lib/app/gateway.js`로 상시 기동한다(Oracle Cloud x86 Micro VM).
 * 이 프로세스의 유일한 제품 역할은 discord.js WS 게이트웨이 로그인을 상주시켜
 * 인터랙션(슬래시 커맨드·버튼 등)을 즉시 처리하는 것이다.
 *
 * HTTP 서버(express `app.listen`)를 두지 않는다:
 *  - 인터랙션은 HTTP가 아니라 WS로 수신하므로 인바운드 HTTP가 불필요하다.
 *  - discord.js가 활성 WS 연결 + heartbeat 타이머를 유지해 Node 이벤트 루프가
 *    비지 않으므로, listen 없이도 프로세스는 종료되지 않는다.
 *  - 인바운드 포트를 열지 않아 포트포워딩·공인 IP·방화벽 개방이 전부 불필요하다.
 *
 * 모니터링은 pull(인바운드 /health)이 아니라 push 방식으로 간다(Phase 1.13):
 *  - [A] dead-man's-switch: isReady() 게이팅 아웃바운드 heartbeat
 *  - [B] 자가 알림: WS/Redis 이상 시 관리자 DM
 *
 * 크롤·알림 발송(syncRecruits → REST DM)은 이 프로세스가 아니라 스케줄러 프로세스
 * (`app/scheduler.ts` onSchedule, Firebase Functions)가 담당한다. 두 프로세스는 공유
 * Redis(Upstash) + Firestore로만 협업한다.
 *
 * 재부팅 자동 부활: `pm2 startup` + `pm2 save` (배포 문서 참조).
 */
bootstrapGateway();

globalLogger.info("Gateway 프로세스 기동 (WS-only · 인터랙션 상주).");
