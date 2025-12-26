/**
 * Common Types
 * 앱 전체에서 사용되는 타입 정의
 */

// City Types
export type { CityEn, CityKo } from "./city.d";

// Crawler Types
export type { Crawler, Scheduler } from "./crawler.d";

// Proxy Types
export type { ProxyData, ProxyDoc } from "./proxyData.d";

// Recruit Data Types
export type { ResponseRecruitData } from "./responseRecruitData.d";

// Recruit Cache Types
export type { Job, HashedString, JobHashes, JobDiffResult } from "./recruitCache.d";

// Response Types
export type { ResponseHandler } from "./responseHandler.d";

// Firebase Admin Types (augmentation)
import "./firebase-admin.d";

// Global Types
import "./global.d";
