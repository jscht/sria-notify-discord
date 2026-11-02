/**
 * elias 추가 속성 규칙(사용자 편집 — 초기 비어있음). (Phase 1.10)
 *
 * 각 속성마다 ①포함 규칙(무조건/확률) + ②값 규칙(고정/풀 랜덤)을 선언하면
 * 생성기가 공고를 만들 때 그대로 적용한다.
 *
 * 예)
 *   { key: "급여", required: true, value: { kind: "fixed", value: "시급 협의" } }
 *   { key: "근무 시간", required: false, chance: 0.3, value: { kind: "pick", pool: ["오전", "오후"] } }
 */
export type EliasValue =
  | { kind: "fixed"; value: unknown } // 항상 이 값
  | { kind: "pick"; pool: unknown[] }; // 풀에서 랜덤(시드)

export interface EliasField {
  /** 화면에 보일 이름. 공고의 `fields`에 `{ name: key, value }`로 들어간다. */
  key: string;
  /** true=무조건 포함 / false(기본)=확률 포함. */
  required?: boolean;
  /** required=false일 때 포함 확률(0~1). */
  chance?: number;
  /** 값 규칙. */
  value: EliasValue;
}

export const eliasFields: EliasField[] = [
  // 여기에 속성 규칙을 추가하세요 (위 예시 참고).
];
