import { SERVICE_NAME } from "../constants/serviceName";
import { BaseKeyManager } from "./baseKeyManager";

/**
 * 공고 캐시 키. 전체 공고를 단일 키(`city:all`)에 저장하고 도시 필터링은 앱에서 수행한다.
 * (도시별 키는 쓰기 2배·정합성 부담 대비 현 규모에서 조회 이득이 작아 미사용)
 */
export class RecruitKeyManager extends BaseKeyManager {
  constructor() {
    super(SERVICE_NAME.RECRUIT);
  }

  getKeys() {
    return {
      list: this.generateKey(["city:all"]),
      list_hash: this.generateKey(["hash", "city:all"]),
    };
  }
};