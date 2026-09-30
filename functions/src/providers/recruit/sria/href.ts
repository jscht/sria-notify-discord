/** sria 상세 경로 포맷(sria 전용). url 생성용. */
export type Href = `/jobs/${number}`;

export const toHref = (localId: number): Href => `/jobs/${localId}`;
