/**
 * 크롤러 공통 타입
 */

export interface CrawlData {
  // 기본 크롤 데이터
}

type Href = `/jobs/${number}`;
type Dday = `D-${number}` | "오늘마감" | "";
type RecruitmentStatus = "접수중" | "발표중" | "종료";

export interface RecruitData extends CrawlData {
  href: Href;
  title: string;
  dDay: Dday;
  dayTxt: string;
  recruitmentStatus: RecruitmentStatus;
}

export interface ProxyData extends CrawlData {
  ipAddress: string;
  port: number | null;
  type: string | null;
  latency: number;
  lastCheckStatus: string | null;
}

export interface ProxyDoc extends ProxyData {
  available: boolean;
  used: boolean;
}
