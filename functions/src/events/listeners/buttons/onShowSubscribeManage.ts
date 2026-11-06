import type { ButtonInteraction } from "discord.js";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import { withDisabledComponents } from "@/providers/discord/builder/disableMessageComponents";
import { renderNoSubscription, renderSubscribeSettingsHub } from "./renderSubscribeSettingsHub";

/**
 * SUBSCRIBE_OPTION:MANAGE 버튼 핸들러.
 *
 * 현재 구독 설정을 조회해 설정 관리 화면(Embed + 지역·사이트 설정 버튼)으로 보여준다.
 * 진입 화면과, 지역 화면·사이트 메뉴의 뒤로가기가 이 화면으로 온다.
 * 설정이 없으면 안내 메시지를 노출한다.
 */
export async function onShowSubscribeManage(interaction: ButtonInteraction): Promise<void> {
  await withDisabledComponents(interaction, async () => {
    const sub = await alarmSubscriptionService.getSubscription(interaction.user.id);
    if (!sub) {
      await renderNoSubscription(interaction);
      return;
    }

    await renderSubscribeSettingsHub(interaction, sub);
  }, { loading: false });
}
