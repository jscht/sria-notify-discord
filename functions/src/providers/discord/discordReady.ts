/**
 * Discord client ready 채널 — leaf 모듈 (의존 0).
 *
 * `initDiscordBot`이 `client.login()`을 fire-and-forget이 아닌 async로 전환하면서도,
 * HTTP 부팅(`initializeProviders`의 `Promise.all`)과는 **비결합**으로 ready 시점을
 * 알리기 위한 일방향 빗장(latch)이다.
 *
 * 의존성 0 — `events`/`dmSender`/`client` 어느 것도 import하지 않는다.
 * 이 파일이 import 순환의 차단점이다(R3): `dmSender`는 ready를 기다리려고
 * `initDiscordBot`이 아니라 **이 leaf**를 직접 import한다.
 *
 * 빗장 의미(일방향): 최초 ClientReady(또는 login 실패 catch)에 한 번 열리면 고정된다.
 * 이후 `getDiscordReady()` await는 즉시 통과(heartbeat 아님). DM 발송은 REST이므로
 * 게이트웨이 WS가 잠깐 끊겨도 동작한다(discord.js 자동 재연결).
 * 재연결 재무장은 미구현 → Phase 1.13.
 */
let resolveReady: () => void;

/** ClientReady(또는 login 실패) 시 1회 resolve되는 일방향 빗장. */
export const discordReady: Promise<void> = new Promise<void>((resolve) => {
  resolveReady = resolve;
});

/** ready까지 대기. 이미 열렸으면 즉시 통과. */
export function getDiscordReady(): Promise<void> {
  return discordReady;
}

/** 빗장을 연다. 여러 번 호출돼도 첫 호출만 의미 있음(이후 no-op). */
export function markDiscordReady(): void {
  resolveReady();
}
