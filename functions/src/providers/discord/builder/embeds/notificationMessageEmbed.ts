import { APIEmbed, EmbedBuilder } from "discord.js";
import type { Job } from "@/common/types/job.d";
import type { AlarmSubscription } from "@/common/types";
import { AlertMode } from "@/common/types";
import { CITIES } from "@/common/constants/city";
import { ENV } from "@/common/utils";
import { formatJobTitleLink } from "./jobLink";

/** 임베드 description에 상세 표시할 상위 공고 개수. 초과분은 오버플로 요약으로 처리. */
const TOP_COUNT = 3;

/**
 * 구독 설정으로 지역 라벨 문자열을 조립한다.
 *
 * SELECTED 모드는 `regions`를 한글(CITIES) "·" 조인, ALL 모드는 "전체 지역".
 * `formatRegionList`는 "현재 선택 지역:" 프리픽스가 붙으므로 배너 요약에는 부적합 —
 * 여기서 직접 조립한다.
 *
 * @param settings 사용자 알림 구독 설정
 * @returns 지역 요약 라벨 (예: "서울·부산·대전" 또는 "전체 지역")
 */
function regionLabel(settings: AlarmSubscription): string {
  if (settings.alertMode === AlertMode.SELECTED) {
    return settings.regions.map((r) => CITIES[r]).join("·");
  }
  return "전체 지역";
}

/**
 * dayTxt에서 시간 부분을 제거해 날짜 범위만 남긴다.
 *
 * "2024.09.20 00:00 ~ 2024.09.26 23:59" → "2024.09.20 ~ 2024.09.26".
 * "~"로 split한 결과가 2조각이 아니면 원본을 그대로 반환한다(방어).
 *
 * @param dayTxt 원본 기간 문자열
 * @returns 시간이 제거된 "시작 ~ 종료" 문자열
 */
function trimDate(dayTxt: string): string {
  const parts = dayTxt.split("~").map((t) => t.trim().split(" ")[0]);
  return parts.length === 2 ? `${parts[0]} ~ ${parts[1]}` : dayTxt;
}

/**
 * 배너(푸시 알림) 요약용 message.content를 생성한다. (Phase 1.9 iterate §7)
 *
 * 임베드 필드 개행은 푸시 배너에 실리지 않으므로, 배너에 노출할 요약을
 * content 평문 2줄로 구성한다(개행 유지됨).
 * ```
 * 📢 {지역요약} · 총 {N}건
 *  ▽ 아래 목록에서 확인하세요
 * ```
 *
 * @param jobs 새로 등록된 공고 목록
 * @param settings 사용자 알림 구독 설정 (지역 라벨 조립용)
 * @returns 배너용 2줄 평문 문자열
 */
export function notificationBannerContent(
  jobs: Job[],
  settings: AlarmSubscription
): string {
  return [
    `📢 ${regionLabel(settings)} · 총 ${jobs.length}건`,
    " ▽ 아래 목록에서 확인하세요",
  ].join("\n");
}

/**
 * 새 공고 알림 DM용 임베드를 생성한다. (Phase 1.9 iterate §7 개편)
 *
 * 헤더(title/description) 역할은 배너 content가 담당하므로 임베드에는 두지 않는다.
 * description에 상위 3건을 블록으로 나열하고, 초과분은 오버플로 요약 한 줄로 접는다.
 * SELECTED 모드 + 오버플로가 있을 때만 지역 필터 안내문을 description 하단에 2줄로 붙인다
 * (footer.text는 개행 미지원이라 description에 둔다).
 *
 * @param jobs 새로 등록된 공고 목록 (이벤트 페이로드의 `Job[]`)
 * @param settings 사용자 알림 구독 설정 (footer 조건 판단용)
 * @returns 알림용 임베드 JSON
 */
export function notificationMessageEmbed(
  jobs: Job[],
  settings: AlarmSubscription
): APIEmbed {
  const baseUrl = ENV.SRIA_URL;

  const embed = new EmbedBuilder().setColor(0x00b0f4).setTimestamp();

  // 상위 3건: 번호+제목링크 / 날짜 / D-Day·상태 3줄 블록.
  const blocks = jobs.slice(0, TOP_COUNT).map((job, index) => {
    const r = job.value; // Job.value: RecruitData
    const titleLine = formatJobTitleLink(r.title, r.href, baseUrl);
    return `${index + 1}. ${titleLine}\n📅 ${trimDate(r.dayTxt)}\n⏳ ${r.dDay} · 🏷️ ${r.recruitmentStatus}`;
  });

  // 오버플로: 초과 건수 요약 + 전체 공고 링크(baseUrl 없으면 텍스트만).
  const hasOverflow = jobs.length > TOP_COUNT;
  if (hasOverflow) {
    const overflowCount = jobs.length - TOP_COUNT;
    blocks.push(
      baseUrl
        ? `▸ 이 외 ${overflowCount}건 더 있어요 · [전체 공고 확인하러 가기](${baseUrl})`
        : `▸ 이 외 ${overflowCount}건 더 있어요`
    );
  }

  // SELECTED 구독 + 오버플로일 때만: 전체 공고엔 선택 외 지역도 섞일 수 있음을 안내.
  // footer.text는 개행을 지원하지 않으므로 description 하단에 2줄로 넣는다(타임스탬프는 setTimestamp 유지).
  if (settings.alertMode === AlertMode.SELECTED && hasOverflow) {
    blocks.push("지역 필터로 조회된 공고예요\n전체 공고에는 다른 지역도 포함돼요");
  }

  embed.setDescription(blocks.join("\n\n"));
  return embed.toJSON();
}
