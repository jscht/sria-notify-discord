import type { ButtonInteraction } from "discord.js";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import { withDisabledComponents } from "@/providers/discord/builder/disableMessageComponents";
import { toggleSourceFilter, type SourceToggleKey } from "@/providers/recruit/sourceToggle";
import { renderSourceSettings } from "./renderSourceSettings";
import { renderNoSubscription } from "./renderSubscribeSettingsHub";

/**
 * SOURCE_SELECT:TOGGLE_* 버튼 핸들러.
 *
 * 공고 묶음 하나를 켜거나 끄고 바로 저장한다. 다른 창에서 먼저 바꿔서 마지막 묶음을 끄려는
 * 요청이 들어오면 저장하지 않고 화면만 다시 그린다.
 *
 * @param interaction 버튼 인터랙션
 * @param key 바꿀 공고 묶음
 */
export async function onSourceToggle(
  interaction: ButtonInteraction,
  key: SourceToggleKey,
): Promise<void> {
  const userId = interaction.user.id;

  await withDisabledComponents(interaction, async () => {
    const sub = await alarmSubscriptionService.getSubscription(userId);
    if (!sub) {
      await renderNoSubscription(interaction);
      return;
    }

    const next = toggleSourceFilter(sub.sources, key);
    const updated = next ? await alarmSubscriptionService.updateSources(userId, next) : sub;
    await renderSourceSettings(interaction, updated);
  });
}
