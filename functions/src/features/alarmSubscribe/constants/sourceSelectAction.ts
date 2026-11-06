export const SOURCE_SELECT_PREFIX = "SOURCE_SELECT" as const;

export enum SourceSelectAction {
  OPEN = "OPEN", // 설정 관리 화면에서 사이트 설정 화면 열기
  TOGGLE_KOREA = "TOGGLE_KOREA", // 일반 공고 켜기/끄기
  TOGGLE_ELIAS = "TOGGLE_ELIAS" // elias 공고 켜기/끄기
}

export const sourceSelectActionId = {
  OPEN: `${SOURCE_SELECT_PREFIX}:${SourceSelectAction.OPEN}`,
  TOGGLE_KOREA: `${SOURCE_SELECT_PREFIX}:${SourceSelectAction.TOGGLE_KOREA}`,
  TOGGLE_ELIAS: `${SOURCE_SELECT_PREFIX}:${SourceSelectAction.TOGGLE_ELIAS}`,
} as const;
