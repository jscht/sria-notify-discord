import { SERVICE_NAME } from "../constants/serviceName";
import { BaseKeyManager } from "./baseKeyManager";

export class CrawlKeyManager extends BaseKeyManager {
  constructor() {
    super(SERVICE_NAME.CRAWL);
  }

  getKeys() {
    return {
      request_allowed: this.generateKey(["request_allowed"])
    }
  }
};