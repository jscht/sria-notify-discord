/**
 * Recruit(공고) 도메인 타입. (Phase 1.10 2차 재정의)
 *
 * - `RecruitBase` = 최소 공용 식별(모든 소스 공통). 다운스트림이 보장받는 유일한 계약.
 *   `id`는 diff 식별자이자 소스 파티션 키(`"{source}:{localId}"`).
 * - `SriaRecruit`/`EliasRecruit` = 사이트별 타입(RecruitBase 확장).
 *   elias의 사용자 정의 속성은 `fields`에 담는다 (생성기 spec `eliasFields`로 부여).
 * - `Recruit` = 알려진 소스 합집합 = 파이프라인 작업 타입.
 * - `RecruitDisplay` = 사이트와 상관없는 화면 표시 형식. embed는 이 타입만 읽는다.
 *
 * ⚠️ sria URL 포맷(`/jobs/${number}`)은 sria 전용이라 `providers/recruit/sria/href.ts`로 이동.
 */

export type Dday = `D-${number}` | "오늘마감" | "";
export type RecruitmentStatus = "접수중" | "발표중" | "종료";

/** 소스 식별자. 사이트 추가 시 여기 + `Recruit` union만 수정. */
export type RecruitSource = "sria" | "elias";

/** 모든 사이트 공고가 가진 공통 값. */
export interface RecruitBase {
  /** 공고 번호. `"{source}:{사이트 안 번호}"` */
  id: string;
  title: string;
  source: RecruitSource;
  /** 게시자. 업체 이름이나 사람 이름. 생성 때 정해지고 바뀌지 않는다. */
  postedBy: string;
  /** 작성 시각 `"MM.DD HH:mm"`. 사이트가 주는 경우만 채운다. */
  postedAt?: string;
}

/** sria 사이트 스키마(스냅샷 반영). */
export interface SriaRecruit extends RecruitBase {
  source: "sria";
  url: string;
  /** 모집 기간. `"YYYY.MM.DD ~ YYYY.MM.DD"` */
  dayTxt: string;
  dDay: Dday;
  recruitmentStatus: RecruitmentStatus;
}

/** 화면에 "이름 값"으로 그리는 칸 하나. */
export interface DisplayField {
  name: string;
  value: string;
}

/** elias 사이트 스키마. */
export interface EliasRecruit extends RecruitBase {
  source: "elias";
  /** 모집 기간. 실제 날짜·시각(한국 시간)으로 고정. 예: `"2026.10.11 14:00 ~ 2026.10.12 02:00"` */
  period: string;
  /** `"접수중"` → 조기 마감되면 `"종료"`. */
  status: RecruitmentStatus;
  /** `eliasFields` 규칙으로 생성 때 한 번 정해진다. */
  fields?: DisplayField[];
}

/** 알려진 소스 합집합 = 파이프라인 작업 타입. */
export type Recruit = SriaRecruit | EliasRecruit;

/** 사이트와 상관없는 공고 표시 형식. */
export interface RecruitDisplay {
  /** 소스별로 묶거나 "전체 공고" 링크(`SourceConfig.url`)를 찾을 때 쓴다. */
  source: RecruitSource;
  /** `SourceConfig.displayName` */
  sourceLabel: string;
  title: string;
  /** 게시자. */
  postedBy: string;
  /** 없으면 제목을 링크 없이 표시한다. */
  url?: string;
  /** 모집 기간. 정렬이 앞 날짜를 읽으므로 `"YYYY.MM.DD"`로 시작한다. */
  period?: string;
  /** 모집 상태 (예: "접수중", "종료"). 간단히·자세히 모드 모두 제목의 지역 뒤에 `[상태]`로 그린다. */
  status?: string;
  /** 소스 고유 값. */
  extraFields?: DisplayField[];
}
