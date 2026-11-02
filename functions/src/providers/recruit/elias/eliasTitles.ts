import type { CityEn } from "@/common/types";

/**
 * elias 공고 목록(사용자 편집). (Phase 1.15)
 *
 * 공고 하나를 지역·제목·게시자 한 줄로 적는다. 생성기가 나머지를 만들어 준다.
 * 자세한 작성법은 같은 폴더의 README.md 참고.
 */
export interface EliasTitle {
  /** 지역. 고를 수 있는 지역만 허용하므로 오타는 컴파일 오류가 난다. */
  region: CityEn;
  /** 지역 표시를 뺀 공고 제목. 생성기가 `[지역] 제목` 형식으로 만든다. */
  title: string;
  /** 게시자. */
  postedBy: string;
}

export const eliasTitles: EliasTitle[] = [
  { region: "fairyKingdom", title: "어제 팔리지 않은 빵 판매", postedBy: "요정 왕국" },
  { region: "worldTreeOrder", title: "교단 가입시키기", postedBy: "세계수 교단" },
];
