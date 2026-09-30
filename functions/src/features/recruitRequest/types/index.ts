/**
 * Recruit Request Feature Types
 */

export interface Recruit {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  postedAt: Date;
}

export interface RecruitRequest {
  userId: string;
  city?: string;
  requestedAt: Date;
}
