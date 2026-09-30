/**
 * Common Types
 * 앱 전체에서 사용되는 타입 정의
 */

// City Types
export type { CityEn, CityKo } from "./city.d";

// Recruit Domain Types (최소 공용 base + 사이트별 타입 + union)
export type {
  Recruit,
  RecruitBase,
  RecruitSource,
  SriaRecruit,
  TempRecruit,
  Dday,
  RecruitmentStatus,
} from "./recruit.d";

// Job Types
export type { Job, HashedString, JobHashes, JobDiffResult } from "./job.d";

// Response Types
export type { ResponseHandler } from "./responseHandler.d";

// Alarm Subscription Types
export { AlertMode } from "./alarmSubscription";
export type { AlarmSubscription, AlarmSubscriptionInput } from "./alarmSubscription";

// Note: firebase-admin.d.ts / global.d.ts 는 tsconfig.include 로 자동 픽업.
// 런타임 require 로 변환되지 않도록 side-effect import 를 두지 않음.
