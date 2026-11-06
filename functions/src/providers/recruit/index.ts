import type { CityGroupKey } from "@/common/constants/city";
import type { Recruit, RecruitDisplay, RecruitSource } from "@/common/types";
import { ENV, SystemError } from "@/common/utils";
import type { RecruitProvider } from "./RecruitProvider";
import { SriaMockProvider } from "./sria/SriaMockProvider";
import { EliasMockProvider } from "./elias/EliasMockProvider";
import { sriaConfig } from "./sria/sriaMockConfig";
import { eliasConfig } from "./elias/eliasMockConfig";
import { sriaToDisplay } from "./sria/sriaDisplay";
import { eliasToDisplay } from "./elias/eliasDisplay";

export type { RecruitProvider } from "./RecruitProvider";
export { SriaMockProvider } from "./sria/SriaMockProvider";
export { EliasMockProvider } from "./elias/EliasMockProvider";
export { sriaConfig } from "./sria/sriaMockConfig";
export { eliasConfig } from "./elias/eliasMockConfig";

/** 소스별 스케줄·표시 정보. */
export interface SourceConfig {
  /** 스케줄 주기(분). */
  intervalMinutes: number;
  /** 사용자에게 보이는 사이트 이름. 구독 메뉴 라벨, `RecruitDisplay.sourceLabel`에 쓴다. */
  displayName: string;
  /** "전체 공고" 링크. 없으면 링크 없이 텍스트만 표시한다. */
  url?: string;
  /** 구독 메뉴 노출과 발송 대상 여부. 값은 코드에 고정한다. */
  userFacing: boolean;
  /**
   * 이 사이트만 쓰는 권역. 없으면 한국 지역을 쓰는 사이트로 보고 "일반 공고"로 묶는다.
   * 있으면 사이트 설정에 켜기/끄기 버튼이 따로 생기고, 켜진 동안에만 지역 메뉴에 권역이 보인다.
   */
  ownRegionGroup?: CityGroupKey;
}

/** 스케줄 주기의 단일 출처 — 소스별 config에서 분(minute) 단위로 노출. */
const SOURCE_CONFIGS: Record<RecruitSource, SourceConfig> = {
  sria: {
    intervalMinutes: sriaConfig.intervalMinutes,
    displayName: "sria",
    url: ENV.SRIA_URL,
    userFacing: true,
  },
  elias: {
    intervalMinutes: eliasConfig.intervalMinutes,
    displayName: "elias",
    url: undefined,
    userFacing: true,
    ownRegionGroup: "eliasRegions",
  },
};

/** 소스별 config 조회 (스케줄러 팩토리/엔트리용). `getProvider(source)` 관례. */
export function getSourceConfig(source: RecruitSource): SourceConfig {
  return SOURCE_CONFIGS[source];
}

/**
 * 사용자에게 보이는 소스 목록을 돌려준다.
 *
 * @returns `userFacing`이 true인 소스 (구독 메뉴 노출 + 발송 대상)
 */
export function getUserFacingSources(): RecruitSource[] {
  const sources = Object.keys(SOURCE_CONFIGS) as RecruitSource[];
  return sources.filter((source) => SOURCE_CONFIGS[source].userFacing);
}

/**
 * 공고를 소스에 맞는 변환 함수로 공통 표시 형식으로 바꾼다.
 *
 * 소스를 추가하면 default 분기에서 컴파일 오류가 나서 누락을 막는다.
 *
 * @param recruit 공고
 * @returns 사이트와 상관없는 표시 형식
 */
export function toDisplay(recruit: Recruit): RecruitDisplay {
  const { displayName } = SOURCE_CONFIGS[recruit.source];
  switch (recruit.source) {
  case "sria": return sriaToDisplay(recruit, displayName);
  case "elias": return eliasToDisplay(recruit, displayName);
  default: {
    const unknownSource: never = recruit;
    throw SystemError.validationError("알 수 없는 공고 소스", { recruit: unknownSource });
  }
  }
}

/**
 * 프로바이더 레지스트리. (Phase 1.10)
 * 사이트 2곳(sria/elias). 소스별 스케줄러가 `getProvider(source)`로 하나만 선택 가능.
 */
let registry: RecruitProvider[] | null = null;
function getRegistry(): RecruitProvider[] {
  if (!registry) {
    registry = [new SriaMockProvider(), new EliasMockProvider()];
  }
  return registry;
}

export function getAllProviders(): RecruitProvider[] {
  return getRegistry();
}

export function getProvider(source: RecruitSource): RecruitProvider | undefined {
  return getRegistry().find((p) => p.source === source);
}

/** 하위호환 별칭 — 전체 프로바이더 목록. */
export function createDefaultRecruitProviders(): RecruitProvider[] {
  return getAllProviders();
}
