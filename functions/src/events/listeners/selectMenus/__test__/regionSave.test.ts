import "dotenv/config";
/**
 * 지역을 저장하는 핸들러 3개(추가, 제거, 초기화) 테스트 (design §2.9.5)
 *
 * 구독 조회와 저장만 가짜로 바꾸고, 핸들러와 화면 빌더는 실제 코드를 쓴다.
 */

import {
  ActionRow,
  type ButtonInteraction,
  type MessageActionRowComponent,
  type StringSelectMenuInteraction,
} from "discord.js";
import { type AlarmFilter, type AlarmSubscription, AlertMode, type CityEn } from "@/common/types";
import { subscribeAdd } from "@/events/listeners/buttons/subscribeAdd";
import { subscribeClear } from "@/events/listeners/buttons/subscribeClear";
import { subscribeRemove } from "@/events/listeners/buttons/subscribeRemove";
import { ALL_REGIONS_NOTICE } from "@/events/listeners/buttons/renderSubscribeManage";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import type { SubscribeCommand } from "@/features/alarmSubscribe/types";
import { subscribeManageButtons } from "@/providers/discord/builder/buttons/subscribeManageButtons";
import { expectEqual, reportResult, runCases } from "@/test/harness";
import { onRegionCitySelect } from "../onRegionCitySelect";
import { onRegionRemoveSelect } from "../onRegionRemoveSelect";

type Reply = { content?: string };
type Run = { saved: CityEn[][]; replies: Reply[] };

const ActionRowFromData = ActionRow as unknown as new (data: unknown) =>
  ActionRow<MessageActionRowComponent>;

const ALL: AlarmFilter<never> = { mode: AlertMode.ALL };

function subscription(
  regions: AlarmSubscription["regions"],
  sources: AlarmSubscription["sources"] = ALL,
): AlarmSubscription {
  return { userId: "u1", enabled: true, regions, sources, createdAt: 0, updatedAt: 0 };
}

function selected(...values: CityEn[]): AlarmSubscription["regions"] {
  return { mode: AlertMode.SELECTED, values };
}

/** 지역 화면이 달린 메시지에서 누른 인터랙션을 만든다. 옛 메시지라 화면은 SELECTED 기준이다. */
function fakeInteraction(run: Run, values: CityEn[] = []): unknown {
  const rows = subscribeManageButtons(subscription(selected("seoul")));
  return {
    customId: "test",
    values,
    user: { id: "u1" },
    message: { components: rows.map((row) => new ActionRowFromData(row.toJSON())) },
    isButton: () => true,
    update: async () => {},
    editReply: async (reply: Reply) => {
      run.replies.push(reply);
    },
  };
}

/** 구독 조회와 저장을 가짜로 바꾼 채 핸들러를 실행한다. */
async function runWith(
  sub: AlarmSubscription,
  handler: (run: Run) => Promise<void>,
): Promise<Run> {
  const run: Run = { saved: [], replies: [] };
  const { getSubscription, updateRegions } = alarmSubscriptionService;
  alarmSubscriptionService.getSubscription = async () => sub;
  alarmSubscriptionService.updateRegions = async (_userId, regions) => {
    run.saved.push(regions);
    return { ...sub, regions: selected(...regions) };
  };

  try {
    await handler(run);
  } finally {
    alarmSubscriptionService.getSubscription = getSubscription;
    alarmSubscriptionService.updateRegions = updateRegions;
  }
  return run;
}

const add = (city: CityEn) => (run: Run) =>
  onRegionCitySelect(fakeInteraction(run, [city]) as StringSelectMenuInteraction);
const remove = (city: CityEn) => (run: Run) =>
  onRegionRemoveSelect(fakeInteraction(run, [city]) as StringSelectMenuInteraction);
const buttonPayload = (run: Run) => ({
  interaction: fakeInteraction(run) as ButtonInteraction,
  mode: "test" as unknown as SubscribeCommand,
});
const clear = (run: Run) => subscribeClear(buttonPayload(run));
const addButton = (run: Run) => subscribeAdd(buttonPayload(run));
const removeButton = (run: Run) => subscribeRemove(buttonPayload(run));

function expectNotSaved(run: Run, content: string): void {
  expectEqual(run.saved, []);
  expectEqual(run.replies.map((reply) => reply.content), [content]);
}

export async function testRegionSave(): Promise<boolean> {
  return runCases("지역 저장 핸들러", [
    {
      name: "모든 지역: 옛 메시지에서 제거해도 저장하지 않음",
      run: async () => {
        expectNotSaved(await runWith(subscription(ALL), remove("seoul")), ALL_REGIONS_NOTICE);
      },
    },
    {
      name: "모든 지역: 옛 메시지에서 추가해도 저장하지 않음",
      run: async () => {
        expectNotSaved(await runWith(subscription(ALL), add("busan")), ALL_REGIONS_NOTICE);
      },
    },
    {
      name: "모든 지역: 옛 메시지에서 초기화해도 저장하지 않음",
      run: async () => {
        expectNotSaved(await runWith(subscription(ALL), clear), ALL_REGIONS_NOTICE);
      },
    },
    {
      name: "모든 지역: 옛 메시지의 추가·제거 버튼은 메뉴를 열지 않고 안내 화면을 그림",
      run: async () => {
        expectNotSaved(await runWith(subscription(ALL), addButton), ALL_REGIONS_NOTICE);
        expectNotSaved(await runWith(subscription(ALL), removeButton), ALL_REGIONS_NOTICE);
      },
    },
    {
      name: "선택 지역: 추가·제거 버튼은 메뉴를 엶",
      run: async () => {
        const sub = subscription(selected("seoul"));
        const added = await runWith(sub, addButton);
        const removed = await runWith(sub, removeButton);
        expectEqual(added.replies[0].content?.includes("1/2단계"), true);
        expectEqual(removed.replies.map((reply) => reply.content), ["제거할 지역을 선택하세요"]);
      },
    },
    {
      name: "선택 지역: 제거하면 남은 지역만 저장",
      run: async () => {
        const run = await runWith(subscription(selected("seoul", "busan")), remove("seoul"));
        expectEqual(run.saved, [["busan"]]);
      },
    },
    {
      name: "제한: 일반 공고 지역이 2개면 더 추가하지 않음",
      run: async () => {
        const run = await runWith(subscription(selected("seoul", "busan")), add("daegu"));
        expectNotSaved(run, "대한민국 지역은 최대 2개까지 선택할 수 있어요.");
      },
    },
    {
      name: "제한: 공고별로 세므로 elias 지역은 추가됨",
      run: async () => {
        const run = await runWith(subscription(selected("seoul", "busan")), add("fairyKingdom"));
        expectEqual(run.saved, [["seoul", "busan", "fairyKingdom"]]);
      },
    },
    {
      name: "초기화: 꺼진 공고의 지역은 남김",
      run: async () => {
        const sources = { mode: AlertMode.SELECTED, values: ["sria" as const] };
        const run = await runWith(subscription(selected("seoul", "fairyKingdom"), sources), clear);
        expectEqual(run.saved, [["fairyKingdom"]]);
      },
    },
  ]);
}

if (require.main === module) {
  reportResult(testRegionSave());
}
