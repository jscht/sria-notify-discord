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
      list: (city?: CityEn) => this.generateKey(["jobs", city ? city : "all"]),
      list_hash: (city?: CityEn) => this.generateKey(["jobs", city ? city : "all", "hash"])
    };
  }
}
