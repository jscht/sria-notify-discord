import { ServiceName } from "../../../types/redisKeyManager";

export abstract class KeyNamePrefix {
  private readonly prefix: string;

  constructor(service: ServiceName) {
    this.prefix = service;
  }

  protected getServiceName() {
    return this.prefix;
  }

  protected generateKey(parts: string[]) {
    return `${this.prefix}:${parts.join(":")}`;
  }

  abstract getKeys(): Record<string, string | ((...args: any[]) => string)>;
}
