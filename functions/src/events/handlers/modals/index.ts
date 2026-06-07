import type { ModalSubmitInteraction } from "discord.js";

export type ModalHandler = (interaction: ModalSubmitInteraction) => Promise<void>;

/**
 * 모달 제출 핸들러 맵.
 *
 * 모달 customId는 `isValidFullActionId` 게이트 밖이므로 `onInteraction`이 customId 키 일치로
 * 직접 라우팅한다. 현재 등록된 모달 핸들러는 없다(지역 선택은 StringSelectMenu 2단계로 이관).
 * 라우팅 골격 보존을 위해 빈 맵을 유지한다.
 */
export const modalHandler: Record<string, ModalHandler> = {};
