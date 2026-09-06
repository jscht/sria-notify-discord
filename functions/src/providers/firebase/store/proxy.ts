import "@/common/utils/systemLogger";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import type { ProxyDoc } from "@/crawlers/types";
import { FirebaseCollection } from "./../constants/collections";

export class ProxyStore {
  private readonly db = getFirestore();
  private static readonly INIT_DOC_ID = "init";

  constructor() {}

  private getProxyRef() {
    return this.db.collection(FirebaseCollection.PROXY);
  }

  private getBatch() {
    return this.db.batch();
  }

  getInitDoc() {
    return ProxyStore.INIT_DOC_ID;
  }

  async getProxyList() {
    const snapshot = await this.getProxyRef().get();

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs
      .filter(doc => doc.id != ProxyStore.INIT_DOC_ID)
      .map(doc => doc.data());
  }

  async saveProxyList(data: ProxyDoc[]) {
    const batch = this.getBatch();

    data.forEach((proxy) => {
      const docRef = this.getProxyRef().doc(proxy.ipAddress);
      batch.set(docRef, proxy);
    });

    await batch.commit();
    globalLogger.info("All proxies uploaded to Firestore successfully.");
  }

  /**
   * 사용 가능(available && !used) 프록시 목록을 반환한다. (Phase 1.10)
   *
   * country=KR 우선, 그 다음 latency 오름차순으로 정렬한다(결정 #1).
   * init 문서는 available 필드가 없어 자연히 제외된다.
   */
  async getAvailableProxies(): Promise<ProxyDoc[]> {
    const snapshot = await this.getProxyRef()
      .where("available", "==", true)
      .where("used", "==", false)
      .get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs
      .filter((doc) => doc.id !== ProxyStore.INIT_DOC_ID)
      .map((doc) => doc.data() as ProxyDoc)
      .sort((a, b) => {
        const aKr = a.country === "KR" ? 0 : 1;
        const bKr = b.country === "KR" ? 0 : 1;
        if (aKr !== bKr) return aKr - bKr;
        return a.latency - b.latency;
      });
  }

  /**
   * 프록시 1개를 원자적으로 checkout한다(트랜잭션). (Phase 1.10)
   *
   * available && !used인 경우에만 used=true로 세팅하고 갱신된 문서를 반환한다.
   * 경합(이미 used)·부재·비가용이면 null.
   */
  async checkoutProxy(ipAddress: string): Promise<ProxyDoc | null> {
    const docRef = this.getProxyRef().doc(ipAddress);
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) return null;
      const proxy = snap.data() as ProxyDoc;
      if (!proxy.available || proxy.used) return null;
      tx.update(docRef, { used: true });
      return { ...proxy, used: true };
    });
  }

  /**
   * 프록시 상태 필드를 부분 업데이트한다. (Phase 1.10)
   */
  async updateProxyState(
    ipAddress: string,
    patch: Partial<Pick<ProxyDoc, "available" | "used" | "failCount">>
  ): Promise<void> {
    await this.getProxyRef().doc(ipAddress).update(patch);
  }

  /**
   * 프록시를 실패 처리한다: available=false + failCount 원자적 증가. (Phase 1.10)
   */
  async markProxyFailed(ipAddress: string): Promise<void> {
    await this.getProxyRef()
      .doc(ipAddress)
      .update({ available: false, failCount: FieldValue.increment(1) });
  }
}