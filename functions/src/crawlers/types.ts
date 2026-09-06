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

/** Playwright `newContext({ proxy })`에 주입하는 프록시 설정. (Phase 1.10) */
export interface PlaywrightProxy {
  /** 스킴 포함 프록시 서버 (예: "http://1.2.3.4:8080", "socks5://1.2.3.4:1080"). */
  server: string;
}

export interface ProxyDoc extends ProxyData {
  /** 사용 가능(검증 통과·미차단). false면 풀에서 제외. */
  available: boolean;
  /** 현재 세션에 checkout되어 사용 중인지 여부. */
  used: boolean;
  /** ip-api geo 국가코드 (KR 우선 정렬 키). Phase 1.10. */
  country?: string;
  /** verify 통과 익명 등급. Phase 1.10. */
  anonymity?: "elite";
  /** 검증 시각(ms). Phase 1.10. */
  verifiedAt?: number;
  /** 누적 실패 횟수 (품질 배제 지표). Phase 1.10. */
  failCount?: number;
}
