import "@/common/utils/systemLogger";
import { CommandInteraction } from "discord.js";
import { RecruitService } from "../../../services";
import { isValidCityName, chooseEunNeun } from "@/common/utils";
import { sortByStartDateDesc } from "@/common/utils/recruitFilter";
import { recruitMessageEmbed } from "@/providers/discord/builder/embeds/recruitMessageEmbed";
import { getUserFacingSources, toDisplay } from "@/providers/recruit";
import { eventBus, EventType } from "@/events/bus";
import type { RecruitRequestedEvent, RecruitRequestCompletedEvent } from "@/events/bus";
import type { CityEn } from "@/common/types";

export async function onRecruitRequest(interaction: CommandInteraction) {
  await interaction.deferReply();

  const cityName = interaction.options.get("지역")?.value;
  const result = validateRegion(cityName);

  if (result === false) {
    await interaction.editReply(
      `⚠️ \`${cityName}\`${chooseEunNeun(cityName as string)} 존재하지 않는 지역이에요.`
    );
    return;
  }

  const region = result === true ? (cityName as string) : undefined;
  const userId = interaction.user.id;
  const startedAt = Date.now();

  try {
    eventBus.emitEvent<RecruitRequestedEvent>(EventType.RECRUIT_REQUESTED, {
      timestamp: startedAt,
      source: "onRecruitRequest",
      userId,
      region: region as CityEn | undefined,
    });
  } catch (e) {
    globalLogger.error("이벤트 발행 실패", e as Error, { event: EventType.RECRUIT_REQUESTED });
  }

  try {
    const recruitService = new RecruitService();
    const { data, tier, durationMs } = await recruitService.getRecruitList(region);

    try {
      eventBus.emitEvent<RecruitRequestCompletedEvent>(EventType.RECRUIT_REQUEST_COMPLETED, {
        timestamp: Date.now(),
        source: "onRecruitRequest",
        userId,
        region: region as CityEn | undefined,
        jobs: data ?? [],
        tier,
        durationMs,
      });
    } catch (e) {
      globalLogger.error("이벤트 발행 실패", e as Error, { event: EventType.RECRUIT_REQUEST_COMPLETED });
    }

    // 노출 사이트만 보여 준다. toDisplay()가 모르는 옛 소스 항목도 여기서 걸러진다.
    const visible = new Set(getUserFacingSources());
    const displays = sortByStartDateDesc(
      (data ?? []).filter((r) => visible.has(r.source)),
      (r) => r,
    ).map(toDisplay);

    if (displays.length === 0) {
      await interaction.editReply(`❌ \`${region ?? "전체"}\` 지역에 대한 공고가 없어요.`);
      return;
    }

    await interaction.editReply({ embeds: [recruitMessageEmbed(displays, region)] });
  } catch (error) {
    try {
      eventBus.emitEvent<RecruitRequestCompletedEvent>(EventType.RECRUIT_REQUEST_COMPLETED, {
        timestamp: Date.now(),
        source: "onRecruitRequest",
        userId,
        region: region as CityEn | undefined,
        jobs: [],
        tier: "error",
        durationMs: Date.now() - startedAt,
      });
    } catch (e) {/* swallow */}

    if (error instanceof Error) globalLogger.error("onRecruitRequest Error:", error);
    await interaction.editReply("⚠️ 공고 요청 처리 중 오류가 발생했어요.");
  }
}

function validateRegion(cityName: any): boolean | undefined {
  if (!cityName) {
    return undefined;
  }

  return isValidCityName(cityName);
}
