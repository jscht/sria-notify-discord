import { SERVICE_NAME } from "../constants/serviceName";

export abstract class BaseKeyManager {
  private readonly prefix: SERVICE_NAME;

  constructor(service: SERVICE_NAME) {
    this.prefix = service;
  }

  protected generateKey(parts: string[]) {
    return `${this.prefix}:${parts.join(":")}`;
  }

  abstract getKeys(): Record<string, string | ((...args: any[]) => string)>;
};