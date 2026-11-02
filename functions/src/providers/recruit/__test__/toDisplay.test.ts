import "dotenv/config";
/**
 * `toDisplay` 변환과 elias 제목 생성 테스트 (design §6.1 #2)
 */

import type { EliasRecruit } from "@/common/types";
import { toKorean } from "@/common/utils/cityName";
import { eliasConfig, toDisplay } from "@/providers/recruit";
import { expectEqual, expectTrue, reportResult, runCases } from "@/test/harness";
import { makeEliasRecruits, makeSriaRecruit } from "@/test/mocks/multiSource";

export async function testToDisplay(): Promise<boolean> {
  return runCases("toDisplay", [
    {
      name: "sria: 기간 시간 제거, 상태, 작성·마감 순서, url 유지",
      run: () => {
        const recruit = makeSriaRecruit(1, {
          title: "[서울] sria 공고",
          postedBy: "게시자 A",
          postedAt: "10.01 09:00",
          dayTxt: "2026.10.01 00:00 ~ 2026.10.15 23:59",
          dDay: "D-3",
          recruitmentStatus: "발표중",
        });

        expectEqual(toDisplay(recruit), {
          source: "sria",
          sourceLabel: "sria",
          title: "[서울] sria 공고",
          postedBy: "게시자 A",
          url: recruit.url,
          period: "2026.10.01 ~ 2026.10.15",
          status: "발표중",
          extraFields: [
            { name: "작성", value: "10.01 09:00" },
            { name: "마감", value: "D-3" },
          ],
        });
      },
    },
    {
      name: "sria: dDay가 빈 값이면 마감 칸이 빠짐",
      run: () => {
        const withPostedAt = makeSriaRecruit(2, { postedAt: "10.02 10:00", dDay: "" });
        const withoutBoth = makeSriaRecruit(3, { dDay: "" });

        expectEqual(toDisplay(withPostedAt).extraFields, [{ name: "작성", value: "10.02 10:00" }]);
        expectEqual(toDisplay(withoutBoth).extraFields, []);
      },
    },
    {
      name: "elias: status·fields를 그대로 넘기고 url이 없음",
      run: () => {
        const [generated] = makeEliasRecruits();
        const fields = [{ name: "급여", value: "시급 협의" }];
        const recruit: EliasRecruit = { ...generated, status: "종료", fields };

        const display = toDisplay(recruit);
        expectEqual(display.source, "elias");
        expectEqual(display.sourceLabel, "elias");
        expectEqual(display.title, recruit.title);
        expectEqual(display.postedBy, recruit.postedBy);
        expectEqual(display.period, recruit.period);
        expectEqual(display.status, "종료");
        expectEqual(display.extraFields, fields);
        expectEqual(display.url, undefined);
      },
    },
    {
      name: "elias: 제목이 [한글 지역] 제목 형식",
      run: () => {
        const allowed = eliasConfig.titles.map(
          ({ region, title }) => `[${toKorean(region)}] ${title}`
        );

        const recruits = makeEliasRecruits();
        expectTrue(recruits.length > 0, "elias 공고가 만들어지지 않음");
        for (const recruit of recruits) {
          expectTrue(allowed.includes(toDisplay(recruit).title), `제목 형식 오류: ${recruit.title}`);
        }
      },
    },
  ]);
}

if (require.main === module) {
  reportResult(testToDisplay());
}
