import { getFirestore } from "firebase-admin/firestore";
import { ProxyDoc } from "../../../types/proxyData";

export class ProxyStore {
  private readonly db = getFirestore();

  constructor() {}

  #getProxyRef() {
    return this.db.collection("proxy");
  }

  #getBatch() {
    return this.db.batch();
  }

  async getProxyList() {
    try {
      const snapshot = await this.#getProxyRef().get();

      if (snapshot.empty) {
        return null;
      }

      return snapshot.docs
        .filter(doc => doc.id != "init")
        .map(doc => doc.data());
    } catch (error) {
      throw error;
    }
  }

  async saveProxyList(data: ProxyDoc[]) {
    try {
      const batch = this.#getBatch();

      data.forEach((proxy) => {
        const docRef = this.#getProxyRef().doc(proxy.ipAddress);
        batch.set(docRef, proxy);
      });

      await batch.commit();
      DebugLogger.server("All proxies uploaded to Firestore successfully.");
    } catch (error) {
      throw error;
    }
  }
}