import type { RecruitSource } from "@/common/types";
import type { RecruitProvider } from "./RecruitProvider";
import { SriaMockProvider } from "./sria/SriaMockProvider";
import { TempMockProvider } from "./temp/TempMockProvider";

export type { RecruitProvider } from "./RecruitProvider";
export { SriaMockProvider } from "./sria/SriaMockProvider";
export { TempMockProvider } from "./temp/TempMockProvider";
export { sriaConfig } from "./sria/sriaMockConfig";
export { tempConfig } from "./temp/tempMockConfig";

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
