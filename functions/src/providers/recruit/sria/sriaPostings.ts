import type { Dday, RecruitmentStatus } from "@/common/types";

/**
 * sria 스냅샷 공고 데이터(사용자 편집). (Phase 1.10)
 *
 * sria는 규칙 없이 "소스가 준 데이터를 반영"하는 사이트라, 여기 항목이 곧 스냅샷 전체 내용이다.
 * (temp와 달리 제목만이 아니라 마감·기간·상태까지 직접 적는다.)
 */
export interface SriaSeed {
  title: string;
  dDay: Dday;
  dayTxt: string;
  recruitmentStatus: RecruitmentStatus;
}

export const sriaPostings: SriaSeed[] = [
  { title: "[서울] 주말 카페 오픈 단기 스태프 모집", dDay: "D-5", dayTxt: "2026.09.06 ~ 2026.09.13", recruitmentStatus: "접수중" },
  { title: "[경기] 물류센터 상하차 일용직 (일당 지급)", dDay: "D-3", dayTxt: "2026.09.06 ~ 2026.09.11", recruitmentStatus: "접수중" },
  { title: "[인천] 박람회 행사 진행요원 2일 단기", dDay: "D-7", dayTxt: "2026.09.06 ~ 2026.09.15", recruitmentStatus: "접수중" },
  { title: "[부산] 필기전형 감독관 및 진행요원 모집", dDay: "D-2", dayTxt: "2026.09.06 ~ 2026.09.10", recruitmentStatus: "접수중" },
  { title: "[대구] 물류 피킹/포장 주말 단기 알바", dDay: "D-4", dayTxt: "2026.09.06 ~ 2026.09.12", recruitmentStatus: "접수중" },
  { title: "[대전] 콘서트 안내 스태프 하루 단기", dDay: "D-6", dayTxt: "2026.09.06 ~ 2026.09.14", recruitmentStatus: "접수중" },
  { title: "[광주] 시험 감독 보조 진행요원 모집", dDay: "D-1", dayTxt: "2026.09.06 ~ 2026.09.09", recruitmentStatus: "발표중" },
  { title: "[울산] 제조 라인 단기 보조 (주말 근무)", dDay: "D-8", dayTxt: "2026.09.06 ~ 2026.09.16", recruitmentStatus: "접수중" },
];
