/**
 * Recruit(공고) 도메인 타입. (Phase 1.10 2차 재정의)
 *
 * - `RecruitBase` = 최소 공용 식별(모든 소스 공통). 다운스트림이 보장받는 유일한 계약.
 *   `id`는 diff 식별자이자 소스 파티션 키(`"{source}:{localId}"`).
 * - `SriaRecruit`/`TempRecruit` = 사이트별 타입(RecruitBase 확장).
 *   temp는 **동적**(속성은 생성기 spec `tempFields`로 부여) → 인덱스 시그니처.
 * - `Recruit` = 알려진 소스 합집합 = 파이프라인 작업 타입.
 *
 * ⚠️ sria URL 포맷(`/jobs/${number}`)은 sria 전용이라 `providers/recruit/sria/href.ts`로 이동.
 */

export type Dday = `D-${number}` | "오늘마감" | "";
export type RecruitmentStatus = "접수중" | "발표중" | "종료";

/** 소스 식별자. 사이트 추가 시 여기 + `Recruit` union만 수정. */
export type RecruitSource = "sria" | "temp";

/** 최상위 = 최소 공용 식별. */
export interface RecruitBase {
  id: string;
  title: string;
  source: RecruitSource;
}

/** sria 사이트 스키마(스냅샷 반영). */
export interface SriaRecruit extends RecruitBase {
  source: "sria";
  url: string;
  dDay: Dday;
  dayTxt: string;
  recruitmentStatus: RecruitmentStatus;
}

/** temp 사이트 스키마 — 비워둠. 속성은 생성기 spec으로 동적 부여. */
export interface TempRecruit extends RecruitBase {
  source: "temp";
  [key: string]: unknown;
}

/** 알려진 소스 합집합 = 파이프라인 작업 타입. */
export type Recruit = SriaRecruit | TempRecruit;
