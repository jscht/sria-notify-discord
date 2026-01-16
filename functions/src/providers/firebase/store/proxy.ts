import "@/common/utils/logger";
import { getFirestore } from "firebase-admin/firestore";
import { ProxyDoc } from "../../../types/proxyData";
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
}