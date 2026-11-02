import type { ButtonInteraction } from "discord.js";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import { firstSourceMenuButtons } from "@/providers/discord/builder/buttons/firstSourceQuestionButtons";
import {
  disableMessageComponents,
  restoreMessageComponents,
} from "@/providers/discord/builder/disableMessageComponents";
import {
  SOURCE_SELECT_MENU_CONTENT,
  SOURCE_SELECT_MENU_ID,
  sourceSelectMenu,
} from "@/providers/discord/builder/selectMenus/sourceSelectMenu";
import { renderNoSubscription } from "./renderSubscribeSettingsHub";

/**
 * SOURCE_SELECT:PICK 버튼 핸들러.
 *
 * 첫 구독 질문에서 사이트 메뉴를 연다.
 * 설정이 없으면 안내 메시지를 노출한다.
 */
export async function onSourceSelectPick(interaction: ButtonInteraction): Promise<void> {
  const original = interaction.message.components;
  await interaction.update({
    components: disableMessageComponents(interaction.message, interaction.customId),
  });

  try {
    const sub = await alarmSubscriptionService.getSubscription(interaction.user.id);
    if (!sub) {
      await renderNoSubscription(interaction);
      return;
    }

    await interaction.editReply({
      content: SOURCE_SELECT_MENU_CONTENT,
      embeds: [],
      components: [
        sourceSelectMenu(SOURCE_SELECT_MENU_ID.FIRST, sub.sources),
        firstSourceMenuButtons(),
      ],
    });
  } catch (e) {
    await interaction
      .editReply({ components: restoreMessageComponents(original) })
      .catch(() => {});
    throw e;
  }
}
