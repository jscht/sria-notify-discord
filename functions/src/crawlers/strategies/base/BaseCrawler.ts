/**
 * 모든 크롤러의 추상 클래스
 */
export abstract class BaseCrawler {
  /**
   * 크롤러 실행 (구현체가 정의)
   *
   * 구현체마다 인자가 다르다: ProxyCrawler는 무인자,
   * SriaCrawler는 주입 프록시를 받는다(Phase 1.10) — 가변 인자로 허용.
   */
  abstract crawl(...args: any[]): Promise<any>;
}
