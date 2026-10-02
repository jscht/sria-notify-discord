import type { RecruitSource } from "@/common/types";
import type { RecruitProvider } from "./RecruitProvider";
import { SriaMockProvider } from "./sria/SriaMockProvider";
import { TempMockProvider } from "./temp/TempMockProvider";
import { sriaConfig } from "./sria/sriaMockConfig";
import { tempConfig } from "./temp/tempMockConfig";

export type { RecruitProvider } from "./RecruitProvider";
export { SriaMockProvider } from "./sria/SriaMockProvider";
export { TempMockProvider } from "./temp/TempMockProvider";
export { sriaConfig } from "./sria/sriaMockConfig";
export { tempConfig } from "./temp/tempMockConfig";

/** 스케줄 주기의 단일 출처 — 소스별 config에서 분(minute) 단위로 노출. */
const SOURCE_CONFIGS: Record<RecruitSource, { intervalMinutes: number }> = {
  sria: sriaConfig,
  temp: tempConfig,
};

/** 소스별 스케줄 config 조회 (스케줄러 팩토리/엔트리용). `getProvider(source)` 관례. */
export function getSourceConfig(source: RecruitSource): { intervalMinutes: number } {
  return SOURCE_CONFIGS[source];
}

/**
 * 프로바이더 레지스트리. (Phase 1.10)
 * 사이트 2곳(sria/temp). 소스별 스케줄러가 `getProvider(source)`로 하나만 선택 가능.
 */
let registry: RecruitProvider[] | null = null;
function getRegistry(): RecruitProvider[] {
  if (!registry) {
    registry = [new SriaMockProvider(), new TempMockProvider()];
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
