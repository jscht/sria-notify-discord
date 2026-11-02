import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { sourceSelectActionId } from "@/features/alarmSubscribe/constants";

function keepAllButton(): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(sourceSelectActionId.KEEP_ALL)
    .setLabel("모두 받기")
    .setStyle(ButtonStyle.Secondary);
}

/**
 * 첫 구독 사이트 질문의 버튼 행.
 *
 * 🌐 사이트 고르기(PICK) / 모두 받기(KEEP_ALL)
 */
export function firstSourceQuestionButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(sourceSelectActionId.PICK)
      .setLabel("🌐 사이트 고르기")
      .setStyle(ButtonStyle.Primary),
    keepAllButton(),
  );
}

/**
 * 첫 구독 사이트 메뉴 아래에 두는 버튼 행.
 *
 * 모두 받기(KEEP_ALL)
 */
export function firstSourceMenuButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(keepAllButton());
}
