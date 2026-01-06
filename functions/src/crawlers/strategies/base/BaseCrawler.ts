/**
 * 모든 크롤러의 추상 클래스
 */
export abstract class BaseCrawler {
  /**
   * 크롤러 실행 (구현체가 정의)
   */
  abstract crawl(): Promise<any>;
}
