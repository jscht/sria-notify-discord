import type { ButtonInteraction } from "discord.js";
import { AlertMode } from "@/common/types";
import { fullActionId } from "@/features/alarmSubscribe/constants/fullActionId";
import { onAlertRegionEdit } from "../../listeners/buttons/onAlertRegionEdit";
import type { ButtonHandler } from "./index";

/**
 * 지역 편집 버튼(REGION_EDIT:ADD|REMOVE|CLEAR) 어댑터.
 *
 * `buttonHandlers`는 `(interaction) => unknown` 시그니처를 요구하나 `onAlertRegionEdit`는
 * `{action, payload}`를 받으므로, 각 키에서 interaction을 받아 payload를 조립해 위임한다.
 * ADD/REMOVE는 모달 진입(defer 금지), CLEAR만 즉시 서비스 호출(`subscribeClear`).
 */
export const alertRegionEditHandlers: Record<string, ButtonHandler> = {
  [fullActionId.REGION_EDIT_ADD]: (i: ButtonInteraction) =>
    onAlertRegionEdit({
      action: fullActionId.REGION_EDIT_ADD,
      payload: { interaction: i, mode: AlertMode.SELECTED },
    }),
  [fullActionId.REGION_EDIT_REMOVE]: (i: ButtonInteraction) =>
    onAlertRegionEdit({
      action: fullActionId.REGION_EDIT_REMOVE,
      payload: { interaction: i, mode: AlertMode.SELECTED },
    }),
  [fullActionId.REGION_EDIT_CLEAR]: (i: ButtonInteraction) =>
    onAlertRegionEdit({
      action: fullActionId.REGION_EDIT_CLEAR,
      payload: { interaction: i, mode: AlertMode.SELECTED },
    }),
};
