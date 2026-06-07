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
  return message.components.map((row) => rebuildRow(row, loadingCustomId));
}

function rebuildRow(
  row: ActionRow<MessageActionRowComponent>,
  loadingCustomId?: string,
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  const builder = new ActionRowBuilder<MessageActionRowComponentBuilder>();

  for (const component of row.components) {
    if (component.type === ComponentType.Button) {
      const next = ButtonBuilder.from(component).setDisabled(true);
      if (loadingCustomId && component.customId === loadingCustomId) {
        next.setLabel(LOADING_LABEL);
      }
      builder.addComponents(next);
    } else if (component.type === ComponentType.StringSelect) {
      builder.addComponents(StringSelectMenuBuilder.from(component).setDisabled(true));
    }
  }

  return builder;
}
