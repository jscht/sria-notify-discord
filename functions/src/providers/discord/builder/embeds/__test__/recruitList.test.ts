import "dotenv/config";
/**
 * 공고 목록 그리기 테스트 (design §6.1 #5, §2.9.2)
 *
 * 고정된 `RecruitDisplay` 목록을 간단히·자세히 두 모드로 그려 글자를 비교한다.
 */

import type { RecruitDisplay } from "@/common/types";
import { expectEqual, expectTrue, reportResult, runCases } from "@/test/harness";
import type { DisplayDetail } from "../recruitList";

const TOP_COUNT = 3;
const DETAILS: DisplayDetail[] = ["simple", "detailed"];

const SITE_URL = "https://example.com/recruit";
const JOB_URL_1 = "https://example.com/jobs/1";
const JOB_URL_3 = "https://example.com/jobs/3";
const SRIA_PERIOD = "2026.10.01 ~ 2026.10.15";
const ELIAS_PERIOD = "2026.10.11 14:00 ~ 2026.10.12 02:00";

function makeDisplay(overrides: Partial<RecruitDisplay> = {}): RecruitDisplay {
  return {
    source: "sria",
    sourceLabel: "sria",
    title: "[서울] 카페 스태프",
    postedBy: "한빛이벤트",
    period: SRIA_PERIOD,
    status: "접수중",
    ...overrides,
  };
}

/** 앞 3건이 화면에 나온다. url·status·period·extraFields가 있는 공고와 없는 공고를 섞었다. */
const SRIA_DISPLAYS: RecruitDisplay[] = [
  makeDisplay({
    url: JOB_URL_1,
    extraFields: [
      { name: "작성", value: "10.01 09:00" },
      { name: "마감", value: "D-5" },
    ],
  }),
  makeDisplay({
    title: "행사 안내",
    status: "발표중",
    extraFields: [{ name: "마감", value: "" }],
  }),
  makeDisplay({
    title: "[부산] 물류 보조",
    url: JOB_URL_3,
    period: undefined,
    status: undefined,
  }),
  makeDisplay({ title: "[대구] 네 번째 공고", status: "종료" }),
  makeDisplay({ title: "[광주] 다섯 번째 공고" }),
];

const ELIAS_DISPLAY: RecruitDisplay = makeDisplay({
  source: "elias",
  sourceLabel: "elias",
  title: "[세계수 교단] 교단 가입시키기",
  postedBy: "세계수 교단",
  period: ELIAS_PERIOD,
  status: "종료",
  extraFields: [{ name: "급여", value: "시급 협의" }],
});

/** 들어온 순서와 상관없이 sria가 먼저 나오는지 보려고 elias를 앞에 둔다. */
const ALL_DISPLAYS: RecruitDisplay[] = [ELIAS_DISPLAY, ...SRIA_DISPLAYS];

/** 어느 사이트도 상위 3건을 넘지 않는 목록. */
const NO_OVERFLOW_DISPLAYS: RecruitDisplay[] = [...SRIA_DISPLAYS.slice(0, 3), ELIAS_DISPLAY];

/** url이 없는 elias가 상위 3건을 넘는 목록. */
const ELIAS_OVERFLOW_DISPLAYS: RecruitDisplay[] = [1, 2, 3, 4].map((order) => ({
  ...ELIAS_DISPLAY,
  title: `[요정 왕국] 공고 ${order}`,
}));

const SIMPLE_SRIA_BLOCK = [
  "**🌐 sria** · 5건",
  `1. [[서울][접수중] 카페 스태프](${JOB_URL_1})`,
  `📅 ${SRIA_PERIOD}`,
  "2. [발표중] 행사 안내",
  `📅 ${SRIA_PERIOD}`,
  `3. [[부산] 물류 보조](${JOB_URL_3})`,
  `▸ 이 외 2건 더 있어요 · [전체 공고 보기](${SITE_URL})`,
].join("\n");

const SIMPLE_ELIAS_BLOCK = [
  "**🌐 elias** · 1건",
  "1. [세계수 교단][종료] 교단 가입시키기",
  `📅 ${ELIAS_PERIOD}`,
].join("\n");

const DETAILED_SRIA_BLOCK = [
  `**🌐 sria** · 5건\n1. [[서울][접수중] 카페 스태프](${JOB_URL_1})\n📅 ${SRIA_PERIOD} | 한빛이벤트 | 작성 10.01 09:00 | 마감 D-5`,
  `2. [발표중] 행사 안내\n📅 ${SRIA_PERIOD} | 한빛이벤트`,
  `3. [[부산] 물류 보조](${JOB_URL_3})\n한빛이벤트`,
  `▸ 이 외 2건 더 있어요 · [전체 공고 보기](${SITE_URL})`,
].join("\n\n");

const DETAILED_ELIAS_BLOCK = [
  "**🌐 elias** · 1건",
  "1. [세계수 교단][종료] 교단 가입시키기",
  `📅 ${ELIAS_PERIOD} | 세계수 교단 | 급여 시급 협의`,
].join("\n");

function firstLine(text: string): string {
  return text.split("\n")[0];
}

function lastLine(text: string): string {
  const lines = text.split("\n");
  return lines[lines.length - 1];
}

/** 블록에서 번호가 붙은 공고 줄만 고른다. */
function itemLines(block: string): string[] {
  return block.split("\n").filter((line) => /^\d+\. /.test(line));
}

export async function testRecruitList(): Promise<boolean> {
  // sria 꼬리줄의 주소를 .env 값과 상관없이 고정한다.
  // ENV는 모듈을 불러올 때 값을 읽으므로, 값을 먼저 정하고 실행 중에 불러온다.
  process.env.SRIA_URL = SITE_URL;
  const { formatRecruitGroups, formatRecruitLine } = await import("../recruitList");

  const render = (displays: RecruitDisplay[], detail: DisplayDetail) =>
    formatRecruitGroups(displays, { detail, topCount: TOP_COUNT });

  /** 두 모드의 제목 줄이 같게 나오는지 본다. 간단히의 기간이 끼지 않게 period를 뺀다. */
  const titleLine = (display: RecruitDisplay, detail: DisplayDetail) =>
    firstLine(formatRecruitLine({ ...display, period: undefined }, 1, detail));

  return runCases("공고 목록 그리기", [
    {
      name: "공통: [서울] 제목은 지역 바로 뒤에 상태가 들어감",
      run: () => {
        for (const detail of DETAILS) {
          expectEqual(titleLine(makeDisplay(), detail), "1. [서울][접수중] 카페 스태프", detail);
        }
      },
    },
    {
      name: "공통: […]로 시작하지 않는 제목은 맨 앞에 [상태]가 붙음",
      run: () => {
        const display = makeDisplay({ title: "카페 스태프" });
        for (const detail of DETAILS) {
          expectEqual(titleLine(display, detail), "1. [접수중] 카페 스태프", detail);
        }
      },
    },
    {
      name: "공통: status가 없으면 제목이 그대로",
      run: () => {
        const display = makeDisplay({ status: undefined });
        for (const detail of DETAILS) {
          expectEqual(titleLine(display, detail), "1. [서울] 카페 스태프", detail);
        }
      },
    },
    {
      name: "공통: url이 있으면 상태를 넣은 제목 전체가 링크",
      run: () => {
        const display = makeDisplay({ url: JOB_URL_1 });
        for (const detail of DETAILS) {
          expectEqual(
            titleLine(display, detail),
            `1. [[서울][접수중] 카페 스태프](${JOB_URL_1})`,
            detail
          );
        }
      },
    },
    {
      name: "간단히: 제목 다음 줄에 기간이 오고 게시자·extraFields가 없음",
      run: () => {
        expectEqual(
          formatRecruitLine(SRIA_DISPLAYS[0], 1, "simple"),
          `1. [[서울][접수중] 카페 스태프](${JOB_URL_1})\n📅 ${SRIA_PERIOD}`
        );
      },
    },
    {
      name: "간단히: 기간의 시각을 그대로 보여 줌",
      run: () => {
        expectEqual(
          formatRecruitLine(makeDisplay({ period: ELIAS_PERIOD }), 1, "simple"),
          `1. [서울][접수중] 카페 스태프\n📅 ${ELIAS_PERIOD}`
        );
      },
    },
    {
      name: "간단히: period가 없으면 기간 부분이 빠짐",
      run: () => {
        expectEqual(
          formatRecruitLine(makeDisplay({ period: undefined }), 1, "simple"),
          "1. [서울][접수중] 카페 스태프"
        );
      },
    },
    {
      name: "자세히: 기간 | 게시자 | 추가 칸 순서이고 '게시' 글자·상태 칸이 없음",
      run: () => {
        expectEqual(
          formatRecruitLine(SRIA_DISPLAYS[0], 1, "detailed"),
          [
            `1. [[서울][접수중] 카페 스태프](${JOB_URL_1})`,
            `📅 ${SRIA_PERIOD} | 한빛이벤트 | 작성 10.01 09:00 | 마감 D-5`,
          ].join("\n")
        );
      },
    },
    {
      name: "자세히: 값이 빈 칸은 빠짐",
      run: () => {
        const deadline = { name: "마감", value: "D-5" };
        const detailLine = (overrides: Partial<RecruitDisplay>) =>
          lastLine(formatRecruitLine(makeDisplay(overrides), 1, "detailed"));

        expectEqual(
          detailLine({ period: undefined, extraFields: [deadline] }),
          "한빛이벤트 | 마감 D-5"
        );
        expectEqual(
          detailLine({ postedBy: "", extraFields: [deadline] }),
          `📅 ${SRIA_PERIOD} | 마감 D-5`
        );
        expectEqual(
          detailLine({
            extraFields: [
              { name: "작성", value: "" },
              deadline,
            ],
          }),
          `📅 ${SRIA_PERIOD} | 한빛이벤트 | 마감 D-5`
        );
      },
    },
    {
      name: "자세히: 칸이 없으면 둘째 줄이 없음",
      run: () => {
        for (const extraFields of [undefined, [], [{ name: "마감", value: "" }]]) {
          const display = makeDisplay({ period: undefined, postedBy: "", extraFields });
          expectEqual(
            formatRecruitLine(display, 1, "detailed"),
            "1. [서울][접수중] 카페 스태프"
          );
        }
      },
    },
    {
      name: "묶음: 간단히 전체 글자가 설계 모양과 같음",
      run: () => {
        expectEqual(render(ALL_DISPLAYS, "simple").blocks, [SIMPLE_SRIA_BLOCK, SIMPLE_ELIAS_BLOCK]);
      },
    },
    {
      name: "묶음: 자세히 전체 글자가 설계 모양과 같음",
      run: () => {
        expectEqual(render(ALL_DISPLAYS, "detailed").blocks, [
          DETAILED_SRIA_BLOCK,
          DETAILED_ELIAS_BLOCK,
        ]);
      },
    },
    {
      name: "묶음: elias가 먼저 들어와도 순서가 sria → elias",
      run: () => {
        for (const detail of DETAILS) {
          expectEqual(
            render(ALL_DISPLAYS, detail).blocks.map(firstLine),
            ["**🌐 sria** · 5건", "**🌐 elias** · 1건"],
            detail
          );
        }
      },
    },
    {
      name: "묶음: 상위 3건을 사이트마다 따로 셈",
      run: () => {
        const displays = [...SRIA_DISPLAYS, ...ELIAS_OVERFLOW_DISPLAYS];
        for (const detail of DETAILS) {
          const counts = render(displays, detail).blocks.map((b) => itemLines(b).length);
          expectEqual(counts, [3, 3], detail);
        }
      },
    },
    {
      name: "묶음: 상위 3건 밖 공고는 그리지 않고 사이트 건수에는 셈",
      run: () => {
        for (const detail of DETAILS) {
          const [sriaBlock] = render(ALL_DISPLAYS, detail).blocks;
          expectTrue(firstLine(sriaBlock).endsWith("· 5건"), `${detail}: 건수 오류`);
          expectTrue(!sriaBlock.includes("네 번째 공고"), `${detail}: 4번째 공고가 그려짐`);
          expectTrue(!sriaBlock.includes("다섯 번째 공고"), `${detail}: 5번째 공고가 그려짐`);
        }
      },
    },
    {
      name: "꼬리줄: sria는 이 외 2건과 전체 공고 링크",
      run: () => {
        for (const detail of DETAILS) {
          const [sriaBlock] = render(ALL_DISPLAYS, detail).blocks;
          expectEqual(
            lastLine(sriaBlock),
            `▸ 이 외 2건 더 있어요 · [전체 공고 보기](${SITE_URL})`,
            detail
          );
        }
      },
    },
    {
      name: "꼬리줄: url이 없는 elias는 링크가 없음",
      run: () => {
        for (const detail of DETAILS) {
          const [, eliasBlock] = render(ALL_DISPLAYS, detail).blocks;
          expectTrue(!eliasBlock.includes("전체 공고 보기"), `${detail}: 링크가 그려짐`);
          expectTrue(!eliasBlock.includes("이 외"), `${detail}: 이 외 건수가 그려짐`);
        }
      },
    },
    {
      name: "꼬리줄: url이 없는 elias가 3건을 넘으면 이 외 건수만 나옴",
      run: () => {
        for (const detail of DETAILS) {
          const [eliasBlock] = render(ELIAS_OVERFLOW_DISPLAYS, detail).blocks;
          expectEqual(lastLine(eliasBlock), "▸ 이 외 1건 더 있어요", detail);
        }
      },
    },
    {
      name: "꼬리줄: 밖 공고가 없으면 간단히는 없고 자세히는 링크만 나옴",
      run: () => {
        const sriaOnly = NO_OVERFLOW_DISPLAYS.filter(({ source }) => source === "sria");

        const [simpleBlock] = render(sriaOnly, "simple").blocks;
        expectTrue(!simpleBlock.includes("전체 공고 보기"), "간단히에 링크가 그려짐");

        const [detailedBlock] = render(sriaOnly, "detailed").blocks;
        expectEqual(lastLine(detailedBlock), `🔗 [전체 공고 보기](${SITE_URL})`);
      },
    },
    {
      name: "꼬리줄: 자세히 + 밖 공고 없음 + url 없음이면 꼬리줄이 없음",
      run: () => {
        const { blocks } = render([ELIAS_DISPLAY], "detailed");
        expectEqual(blocks, [DETAILED_ELIAS_BLOCK]);
      },
    },
    {
      name: "hasOverflow: 이 외 건수가 붙은 블록이 있으면 true",
      run: () => {
        for (const detail of DETAILS) {
          expectEqual(render(ALL_DISPLAYS, detail).hasOverflow, true, detail);
          expectEqual(render(ELIAS_OVERFLOW_DISPLAYS, detail).hasOverflow, true, detail);
        }
      },
    },
    {
      name: "hasOverflow: 이 외 건수가 붙은 블록이 없으면 false",
      run: () => {
        for (const detail of DETAILS) {
          expectEqual(render(NO_OVERFLOW_DISPLAYS, detail).hasOverflow, false, detail);
        }
      },
    },
  ]);
}

if (require.main === module) {
  reportResult(testRecruitList());
}
