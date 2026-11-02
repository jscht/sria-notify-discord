export const SOURCE_SELECT_PREFIX = "SOURCE_SELECT" as const;

export enum SourceSelectAction {
  OPEN = "OPEN", // 설정 관리 화면에서 사이트 메뉴 열기
  PICK = "PICK", // 첫 구독 질문에서 사이트 메뉴 열기
  KEEP_ALL = "KEEP_ALL" // 첫 구독에서 모든 사이트를 그대로 받기
}

export const sourceSelectActionId = {
  OPEN: `${SOURCE_SELECT_PREFIX}:${SourceSelectAction.OPEN}`,
  PICK: `${SOURCE_SELECT_PREFIX}:${SourceSelectAction.PICK}`,
  KEEP_ALL: `${SOURCE_SELECT_PREFIX}:${SourceSelectAction.KEEP_ALL}`,
} as const;
