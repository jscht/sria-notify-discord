import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import {
  alertRegionEditActionId,
  sourceSelectActionId,
  subscribeOptionActionId,
} from "@/features/alarmSubscribe/constants";

/**
 * 설정 관리 화면의 버튼 행.
 *
 * 📍 지역 설정(REGION) / 🌐 사이트 설정(OPEN) / ⬅️ 뒤로(BACK, 진입 화면으로 돌아감)
 */
export function subscribeSettingsHubButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(subscribeOptionActionId.REGION)
      .setLabel("📍 지역 설정")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(sourceSelectActionId.OPEN)
      .setLabel("🌐 사이트 설정")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(subscribeOptionActionId.BACK)
      .setLabel("⬅️ 뒤로")
      .setStyle(ButtonStyle.Secondary),
  );
}

/**
 * 사이트 메뉴 화면의 버튼 행.
 *
 * ⬅️ 뒤로(MANAGE, 설정 관리 화면으로 돌아감)
 */
export function sourceMenuBackButtons(): ActionRowBuilder<ButtonBuilder> {
  return backButtonRow(subscribeOptionActionId.MANAGE);
}

/**
 * 권역 선택 메뉴와 지역 제거 메뉴 아래의 버튼 행.
 *
 * ⬅️ 뒤로(REGION, 지역 설정 화면으로 돌아감)
 */
export function regionMenuBackButtons(): ActionRowBuilder<ButtonBuilder> {
  return backButtonRow(subscribeOptionActionId.REGION);
}

/**
 * 시 선택 메뉴 아래의 버튼 행.
 *
 * ⬅️ 뒤로(ADD, 권역 선택 메뉴로 돌아감)
 */
export function regionCityBackButtons(): ActionRowBuilder<ButtonBuilder> {
  return backButtonRow(alertRegionEditActionId.ADD);
}

function backButtonRow(customId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(customId)
      .setLabel("⬅️ 뒤로")
      .setStyle(ButtonStyle.Secondary),
  );
}
