import {
  ActionRowBuilder,
  ButtonBuilder,
  ComponentType,
  StringSelectMenuBuilder,
  type ActionRow,
  type Message,
  type MessageActionRowComponent,
  type MessageActionRowComponentBuilder,
} from "discord.js";

const LOADING_LABEL = "⏳ 적용 중…";

/**
 * 메시지의 모든 인터랙티브 컴포넌트를 disabled=true로 재구성한다.
 *
 * Discord 클라이언트는 disabled 컴포넌트의 클릭을 발사하지 않으므로,
 * `interaction.update()`에 결과를 넘기면 같은 메시지에 동시 in-flight 인터랙션이
 * 쌓이는 것을 물리적으로 차단한다(토글 안정화 U1).
 *
 * `loadingCustomId`가 주어지면 해당 customId의 버튼 라벨을 LOADING_LABEL로
 * 일시 변경해 클릭 피드백을 제공한다(U3). SelectMenu는 라벨 변경 대상이 아니다.
 *
 * 현 UI 컴포넌트(Button, StringSelectMenu)만 처리한다. Link 버튼이나 다른
 * SelectMenu(User/Channel/Role/Mentionable) 종류는 등장 시 별도 분기 추가.
 */
export function disableMessageComponents(
  message: Message,
  loadingCustomId?: string,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  return message.components.map((row) => rebuildRow(row, { disabled: true, loadingCustomId }));
}

/**
 * 핸들러 진입 시점에 캡처한 원본 `ActionRow[]`를 enabled + 원본 라벨로 재빌드한다.
 *
 * 백엔드 쓰기 실패 시 catch 분기에서 `interaction.editReply({ components })`로
 * 넘겨 "⏳ 적용 중…" + disabled 상태에 갇힌 UI를 클릭 가능한 원상태로 되돌리는 용도다.
 * 캡처는 반드시 `interaction.update(disableMessageComponents(...))` 호출 **전에**
 * 해야 한다 — update 후 `interaction.message`는 disabled+적용중 상태로 갱신된다.
 */
export function restoreMessageComponents(
  rows: ActionRow<MessageActionRowComponent>[],
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  return rows.map((row) => rebuildRow(row, { disabled: false }));
}

function rebuildRow(
  row: ActionRow<MessageActionRowComponent>,
  options: { disabled: boolean; loadingCustomId?: string },
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  const builder = new ActionRowBuilder<MessageActionRowComponentBuilder>();

  for (const component of row.components) {
    if (component.type === ComponentType.Button) {
      const next = ButtonBuilder.from(component).setDisabled(options.disabled);
      if (options.loadingCustomId && component.customId === options.loadingCustomId) {
        next.setLabel(LOADING_LABEL);
      }
      builder.addComponents(next);
    } else if (component.type === ComponentType.StringSelect) {
      builder.addComponents(StringSelectMenuBuilder.from(component).setDisabled(options.disabled));
    }
  }

  return builder;
}
