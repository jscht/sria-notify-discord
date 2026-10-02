import { SERVICE_NAME } from "../constants/serviceName";
import { BaseKeyManager } from "./baseKeyManager";

export class RequestLimitKeyManager extends BaseKeyManager {
  constructor() {
    super(SERVICE_NAME.REQUEST_LIMIT);
  }

  getKeys() {
    return {
      request_allowed: this.generateKey(["request_allowed"]),
    };
  }
}
