import "dotenv/config";
/**
 * 작업 실패 때 잠긴 버튼을 되돌리는 동작 테스트
 *
 * 실제 discord.js 빌더로 만든 메시지를 쓰고, 응답 함수만 가짜로 바꾼다.
 */

import {
  ActionRow,
  type ButtonInteraction,
  type MessageActionRowComponent,
  type MessageComponentInteraction,
} from "discord.js";
import { onShowRegionSettings } from "@/events/listeners/buttons/onShowRegionSettings";
import { subscribeOptionActionId } from "@/features/alarmSubscribe/constants";
import { alarmSubscriptionService } from "@/features/alarmSubscribe/services/subscriptionService";
import { subscribeSettingsHubButtons } from "@/providers/discord/builder/buttons/subscribeSettingsHubButtons";
import { expectEqual, expectRejects, reportResult, runCases } from "@/test/harness";
import { withDisabledComponents } from "../disableMessageComponents";

type Row = { toJSON(): unknown };
type ButtonJson = { custom_id: string; label: string; disabled?: boolean };
type Call = { name: "update" | "editReply"; rows: Row[] };

const ActionRowFromData = ActionRow as unknown as new (data: unknown) =>
  ActionRow<MessageActionRowComponent>;

const PRESSED = subscribeOptionActionId.REGION;
const ORIGINAL_LABELS = ["📍 지역 설정", "🌐 사이트 설정", "⬅️ 뒤로"];

/**
 * 설정 관리 화면의 버튼을 누른 인터랙션을 만든다.
 *
 * @param calls 응답을 순서대로 기록할 배열
 * @param failEditReply 호출 순서(1부터)를 받아 실패 여부를 정한다
 */
function fakeInteraction(
  calls: Call[],
  failEditReply: (attempt: number) => boolean = () => false,
): MessageComponentInteraction {
  let attempt = 0;
  const record = (name: Call["name"]) => async ({ components }: { components: Row[] }) => {
    calls.push({ name, rows: components });
    if (name === "editReply" && failEditReply(++attempt)) throw new Error("수정 실패");
  };

  return {
    customId: PRESSED,
    user: { id: "u1" },
    message: {
      components: [new ActionRowFromData(subscribeSettingsHubButtons().toJSON())],
    },
    update: record("update"),
    editReply: record("editReply"),
  } as unknown as MessageComponentInteraction;
}

function buttons(call: Call): ButtonJson[] {
  return call.rows.flatMap((row) => (row.toJSON() as { components: ButtonJson[] }).components);
}

function disabledStates(call: Call): boolean[] {
  return buttons(call).map((button) => button.disabled ?? false);
}

function expectRestored(call: Call): void {
  expectEqual(call.name, "editReply");
  expectEqual(disabledStates(call), [false, false, false]);
  expectEqual(buttons(call).map((button) => button.label), ORIGINAL_LABELS);
}

export async function testDisableMessageComponents(): Promise<boolean> {
  return runCases("잠긴 버튼 복원", [
    {
      name: "성공: 잠근 뒤 작업하고 복원 응답을 보내지 않음",
      run: async () => {
        const calls: Call[] = [];
        await withDisabledComponents(fakeInteraction(calls), async () => {});

        expectEqual(calls.map(({ name }) => name), ["update"]);
        expectEqual(disabledStates(calls[0]), [true, true, true]);
        expectEqual(buttons(calls[0])[0].label, "⏳ 적용 중…");
      },
    },
    {
      name: "실패: 버튼과 원래 이름을 되돌리고 예외를 다시 던짐",
      run: async () => {
        const calls: Call[] = [];
        await expectRejects(withDisabledComponents(fakeInteraction(calls), async () => {
          throw new Error("작업 실패");
        }));

        expectEqual(calls.map(({ name }) => name), ["update", "editReply"]);
        expectRestored(calls[1]);
      },
    },
    {
      name: "실패: 복원 응답까지 실패해도 원래 예외가 전달됨",
      run: async () => {
        const interaction = fakeInteraction([], () => true);
        let thrown: unknown;
        await withDisabledComponents(interaction, async () => {
          throw new Error("작업 실패");
        }).catch((error) => {
          thrown = error;
        });

        expectEqual((thrown as Error).message, "작업 실패");
      },
    },
    {
      name: "실패: 화면을 그리는 editReply가 실패해도 복원을 시도함",
      run: async () => {
        const calls: Call[] = [];
        const interaction = fakeInteraction(calls, (attempt) => attempt === 1);
        await expectRejects(withDisabledComponents(interaction, async () => {
          await interaction.editReply({ components: [] });
        }));

        expectEqual(calls.map(({ name }) => name), ["update", "editReply", "editReply"]);
        expectRestored(calls[2]);
      },
    },
    {
      name: "실패: 잠금 응답이 실패하면 작업을 시작하지 않음",
      run: async () => {
        const interaction = fakeInteraction([]);
        interaction.update = (async () => {
          throw new Error("응답 실패");
        }) as unknown as MessageComponentInteraction["update"];

        let started = false;
        await expectRejects(withDisabledComponents(interaction, async () => {
          started = true;
        }));
        expectEqual(started, false);
      },
    },
    {
      name: "실제 핸들러: 지역 설정 버튼에서 구독 조회가 실패하면 버튼이 돌아옴",
      run: async () => {
        const calls: Call[] = [];
        const interaction = fakeInteraction(calls) as ButtonInteraction;
        const original = alarmSubscriptionService.getSubscription;
        alarmSubscriptionService.getSubscription = async () => {
          throw new Error("Firestore 실패");
        };

        try {
          await expectRejects(onShowRegionSettings(interaction));
        } finally {
          alarmSubscriptionService.getSubscription = original;
        }

        expectEqual(calls.map(({ name }) => name), ["update", "editReply"]);
        expectEqual(disabledStates(calls[0]), [true, true, true]);
        expectRestored(calls[1]);
      },
    },
  ]);
}

if (require.main === module) {
  reportResult(testDisableMessageComponents());
}
