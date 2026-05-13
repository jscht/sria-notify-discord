/**
 * Common Types
 * 앱 전체에서 사용되는 타입 정의
 */

// City Types
export type { CityEn, CityKo } from "./city.d";

// Crawler Types
export type { Crawler, Scheduler } from "./crawler.d";

// Job Types
export type { Job, HashedString, JobHashes, JobDiffResult } from "./job.d";

// Response Types
export type { ResponseHandler } from "./responseHandler.d";

// Alarm Subscription Types
export { AlertMode } from "./alarmSubscription";
export type { AlarmSubscription, AlarmSubscriptionInput } from "./alarmSubscription";

// Note: firebase-admin.d.ts / global.d.ts 는 tsconfig.include 로 자동 픽업.
// 런타임 require 로 변환되지 않도록 side-effect import 를 두지 않음.
