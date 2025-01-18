import { CityEn } from "../../../types/city";
import { KeyNamePrefix } from "../key/keyNamePrefix";

export class RecruitKeyManager extends KeyNamePrefix {
  constructor() {
    super("recruit");
  }

  getServiceName() {
    return super.getServiceName();
  }

  getKeys() {
    return {
      list: (city?: CityEn) => this.generateKey(["stringify", `city:${city || "all"}`]),
      list_hash: (city?: CityEn) => this.generateKey(["hash", `city:${city || "all"}`]),
    };
  }
}
