import "dotenv/config";
/**
 * 권역 선택 뒤 화면 교체 순서와 뒤로 버튼 테스트 (design §2.9.5)
 */

import {
  ActionRow,
  type MessageActionRowComponent,
  type StringSelectMenuInteraction,
} from "discord.js";
import { AlertMode } from "@/common/types";
import {
  regionCityBackButtons,
  regionMenuBackButtons,
} from "@/providers/discord/builder/buttons/subscribeSettingsHubButtons";
import { regionGroupSelectMenu } from "@/providers/discord/builder/selectMenus/regionSelectMenus";
import { expectEqual, reportResult, runCases } from "@/test/harness";
import { onRegionGroupSelect } from "../onRegionGroupSelect";

type Row = { toJSON(): unknown };
type Payload = { components: Row[] };
type RowJson = { components: { custom_id: string; disabled?: boolean }[] };

const ActionRowFromData = ActionRow as unknown as new (data: unknown) =>
  ActionRow<MessageActionRowComponent>;

/** 권역 메뉴가 달린 메시지에서 값을 고른 인터랙션을 만들고, 응답을 순서대로 기록한다. */
function fakeInteraction(calls: [string, Row[]][]): StringSelectMenuInteraction {
  const group = regionGroupSelectMenu({ mode: AlertMode.ALL }).toJSON();
  const record = (name: string) => async (payload: Payload) => {
    calls.push([name, payload.components]);
  };

  return {
    customId: "region-group-select",
    values: ["gyeonggi"],
    message: { components: [new ActionRowFromData(group)] },
    update: record("update"),
    editReply: record("editReply"),
  } as unknown as StringSelectMenuInteraction;
}

function rowComponents(row: Row): RowJson["components"] {
  return (row.toJSON() as RowJson).components;
}

function customIds(rows: Row[]): string[] {
  return rows.flatMap((row) => rowComponents(row).map((c) => c.custom_id));
}

export async function testRegionGroupSelect(): Promise<boolean> {
  return runCases("권역 선택 화면 교체", [
    {
      name: "순서: 고른 메뉴를 잠근 뒤 시 메뉴와 뒤로 버튼으로 바꿈",
      run: async () => {
        const calls: [string, Row[]][] = [];
        await onRegionGroupSelect(fakeInteraction(calls));

        expectEqual(calls.map(([name]) => name), ["update", "editReply"]);

        const [, locked] = calls[0];
        expectEqual(customIds(locked), ["region-group-select"]);
        expectEqual(rowComponents(locked[0])[0].disabled, true);

        const [, swapped] = calls[1];
        expectEqual(customIds(swapped), ["region-city-select", "REGION_EDIT:ADD"]);
      },
    },
    {
      name: "뒤로: 권역·제거 메뉴는 지역 설정, 시 메뉴는 권역 메뉴로 감",
      run: () => {
        expectEqual(customIds([regionMenuBackButtons()]), ["SUBSCRIBE_OPTION:REGION"]);
        expectEqual(customIds([regionCityBackButtons()]), ["REGION_EDIT:ADD"]);
      },
    },
  ]);
}

if (require.main === module) {
  reportResult(testRegionGroupSelect());
}
