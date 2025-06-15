import { CityEn } from "../../../types/city";
import { SERVICE_NAME } from "../constants/serviceName";
import { BaseKeyManager } from "./baseKeyManager";

export class RecruitKeyManager extends BaseKeyManager {
  constructor() {
    super(SERVICE_NAME.RECRUIT);
  }

  getKeys() {
    return {
      list: (city?: CityEn) => this.generateKey([`city:${city || "all"}`]),
      list_hash: (city?: CityEn) => this.generateKey(["hash", `city:${city || "all"}`]),
    };
  }
};