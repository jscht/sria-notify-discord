import "@/common/utils/systemLogger";
import { ProxyStore } from "@/providers/firebase/store";
import type { ProxyDoc } from "@/crawlers/types";

/**
 * 프록시 풀 오케스트레이션 서비스. (Phase 1.10)
 *
 * 소스 무관 인터페이스 — 현재는 무료 ProxyCrawler 수집분(Firestore)을 쓰지만,
 * 부족 시 유료 게이트웨이로 교체해도 상위(crawlService) 계약은 불변.
 * 상태 저장은 ProxyStore(provider)에 위임한다(services→providers 정방향).
 */
export class ProxyService {
  private readonly store = new ProxyStore();

  /**
   * 사용 가능 프록시 1개를 원자적으로 checkout한다(used=true).
   *
   * country=KR 우선·latency 최소 순으로 후보를 훑으며, 경합(이미 used)이면
   * 다음 후보로 넘어간다. 가용 프록시가 없으면 null.
   */
  async getAvailableProxy(): Promise<ProxyDoc | null> {
    try {
      const candidates = await this.store.getAvailableProxies();
      for (const proxy of candidates) {
        const checked = await this.store.checkoutProxy(proxy.ipAddress);
        if (checked) return checked; // 경합 시 다음 후보로
      }
      return null;
    } catch (error) {
      globalLogger.error("getAvailableProxy 실패", error as Error);
      return null;
    }
  }

  /**
   * 프록시를 사용중으로 표시한다.
   * (getAvailableProxy가 트랜잭션으로 이미 checkout하므로 명시 호출·재확인용.)
   */
  async markProxyAsUsed(ipAddress: string): Promise<void> {
    try {
      await this.store.updateProxyState(ipAddress, { used: true });
    } catch (error) {
      globalLogger.warn("markProxyAsUsed 실패", { ipAddress });
    }
  }

  /**
   * 차단·연결 실패한 프록시를 풀에서 제외한다(available=false, failCount++).
   */
  async markProxyAsFailed(ipAddress: string): Promise<void> {
    try {
      await this.store.markProxyFailed(ipAddress);
    } catch (error) {
      globalLogger.warn("markProxyAsFailed 실패", { ipAddress });
    }
  }

  /**
   * 세션 종료 시 프록시를 풀로 반환한다(used=false, available 유지).
   */
  async releaseProxy(ipAddress: string): Promise<void> {
    try {
      await this.store.updateProxyState(ipAddress, { used: false });
    } catch (error) {
      globalLogger.warn("releaseProxy 실패", { ipAddress });
    }
  }

  /**
   * 가용 프록시 존재 여부 (크롤 게이트용).
   * 조회 실패 시 안전하게 false를 반환해 크롤을 중단시킨다(IP 보호 우선).
   */
  async hasAvailableProxy(): Promise<boolean> {
    try {
      const candidates = await this.store.getAvailableProxies();
      return candidates.length > 0;
    } catch (error) {
      globalLogger.warn("hasAvailableProxy 조회 실패 — 안전하게 false 반환");
      return false;
    }
  }
}
