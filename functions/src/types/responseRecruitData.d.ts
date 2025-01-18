type Href = `/jobs/${number}`;
type Dday = `D-${number}` | "오늘마감" | "";
type RecruitmentStatus = "접수중" | "발표중" | "종료";

export type ResponseRecruitData = {
  href: Href,
  title: string,
  dDay: Dday,
  dayTxt: string,
  recruitmentStatus: RecruitmentStatus
}
