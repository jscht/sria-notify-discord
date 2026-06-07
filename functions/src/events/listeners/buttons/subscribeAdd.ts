import type { ButtonInteraction, CommandInteraction } from "discord.js";
import type { SubscribeCommand } from "@/features/alarmSubscribe/types";
import { regionGroupSelectMenu } from "@/providers/discord/builder/selectMenus/regionSelectMenus";

export type SubscribeAddPayload = {
  interaction: CommandInteraction | ButtonInteraction;
  mode: SubscribeCommand;
  region?: string;
};

/**
 * 지역 추가 진입 — 권역 선택 메뉴를 노출한다(권역→시 2단계의 1단계).
 * ButtonInteraction에서 진입하므로 `update`로 같은 메시지를 메뉴로 교체한다(defer 불요).
 */
export async function subscribeAdd(payload: SubscribeAddPayload): Promise<void> {
  const { interaction } = payload;
  if (!interaction.isButton()) {
    return;
  }

  await interaction.update({
    content: "권역을 선택하세요",
    components: [regionGroupSelectMenu()],
  });
}
