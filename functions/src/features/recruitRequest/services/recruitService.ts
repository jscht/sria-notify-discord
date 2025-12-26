import { CRAWL_MODE } from "@/common/constants";
import type { RecruitData } from "../types";

/**
 * Recruit Request Service
 * 채용공고 조회 및 캐싱을 담당하는 비즈니스 로직
 */
export class RecruitRequestService {
  /**
   * 특정 지역의 공고 목록 조회
   * - Redis 캐시 확인
   * - Firestore 확인
   * - 크롤링 (필요시)
   */
  async getRecruitList(city?: string): Promise<RecruitData[] | null> {
    // TODO: 다음 순서로 조회
    // 1. Redis 캐시에서 조회
    // 2. Firestore에서 조회
    // 3. 크롤링 (10분 제한)
    // 4. 캐시 및 Firestore에 저장
    
    return null;
  }

  /**
   * 전체 공고 목록 조회
   */
  async getAllRecruits(): Promise<RecruitData[] | null> {
    // TODO: 모든 지역의 공고 조회
    return null;
  }

  /**
   * 공고 데이터 크롤링
   */
  async crawlRecruits(city?: string): Promise<RecruitData[] | null> {
    // TODO: CrawlService 또는 기존 RecruitService 사용
    return null;
  }

  /**
   * 공고 캐시 업데이트
   */
  async updateCache(recruits: RecruitData[]): Promise<void> {
    // TODO: Redis와 Firestore에 데이터 저장
  }
}

export const recruitRequestService = new RecruitRequestService();
