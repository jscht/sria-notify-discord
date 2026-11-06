# 지역 추가 로딩 멈춤 분석

> **이 문서는**: Phase 1.15 런타임 검증에서 나온 지역 추가 멈춤의 원인 분석과 수정을 기록합니다.
> **결론**: 서버 코드는 실패하지 않았습니다. 권역 메뉴를 고른 응답 하나로 시 메뉴까지 바꾸던 처리를 "메뉴 잠금 → 시 메뉴로 교체" 두 단계로 나눴고, 그 뒤 멈춤이 재현되지 않았습니다. Discord 앱 내부의 정확한 원인은 확인하지 못했습니다.

## 1. 증상

지역 추가는 권역 메뉴에서 권역을 고른 뒤 시 메뉴에서 지역을 고르는 2단계입니다. 권역을 고르면 시 메뉴로 바뀌는데, 가끔 다음 증상이 나왔습니다.

- 시 메뉴에 로딩 표시가 남아 사라지지 않음
- 메뉴는 열리지만 지역을 골라도 등록되지 않음
- 메뉴가 보이자마자 누르면 고른 권역이 표시된 메뉴가 펼쳐지고, 시 메뉴로 바뀐 뒤 멈춤

특정 사이트 문제처럼 보였지만 사이트 설정과 권역에 상관없이 나타났습니다.

## 2. 실행 기록에서 확인한 사실

봇의 모든 요청과 응답을 기록해 수정 전후를 비교했습니다.

| | 권역 선택 | 서버 응답 | 다음 요청 도착 |
|---|---|---|---|
| 수정 전 | 15회 | 15회 모두 성공 | 9회 |
| 수정 후 | 18회 | 18회 모두 성공 | 18회 (시 선택 15, 뒤로 3) |

수정 전 전체 기록은 요청 106건, 응답 187건, 실패 0건입니다. 수정 전 끊긴 6회 중 마지막 1회는 테스트가 거기서 끝난 경우일 수 있습니다.

- 끊긴 경우 시 선택 요청이 봇에 도착하지 않았습니다. 서버에는 처리할 요청이 없었습니다.
- 직전 응답은 0.3~0.6초 안에 끝났습니다. 서버에 밀린 요청은 없었습니다.
- 두 공고를 모두 켠 같은 설정에서 `elias 지역`이 멈춘 적도 통과한 적도 있었습니다.
- 같은 메시지에서 5번 통과한 뒤 멈춘 경우가 있어 메시지 상태도 원인이 아닙니다.
- 응답이 490ms 이상이면 5회 중 4회, 그보다 빠르면 10회 중 2회 끊겼습니다. 표본이 적어 참고만 합니다.

## 3. 코드 분석

### 수정 전

`functions/src/events/listeners/selectMenus/onRegionGroupSelect.ts`는 응답 하나로 메뉴를 바꿨습니다.

```ts
await interaction.update({
  content: regionCityMenuContent(groupKey),
  components: [regionCitySelectMenu(groupKey)],
});
```

실제 discord.js 코드를 실행해 Discord로 보내는 내용을 뽑으면 요청은 하나입니다.

```text
POST /interactions/{id}/{token}/callback
{ type: 7, content: "2/2단계 — 시를 선택하세요",
  components: [ region-city-select ] }
```

사용자가 고른 메뉴는 `region-group-select`입니다. 클릭 응답 안에서 다른 메뉴로 바뀝니다. `update()`는 HTTP 요청이 끝나면 `replied = true`로 표시하고 끝납니다. 예외가 나는 경로는 HTTP 실패와 중복 응답뿐이고, 기록에는 성공만 있습니다. 따라서 Promise가 끝나지 않았거나 코드가 멈춘 것은 아닙니다.

프로젝트에서 응답 하나로 메뉴가 다른 메뉴로 바뀌는 곳은 여기뿐이었습니다.

| 화면 전환 | 응답 방식 | 멈춤 |
|---|---|---|
| 버튼 → 메뉴 | 잠금 `update` → `editReply` | 없음 |
| 메뉴 → 버튼 | 잠금 `update` → `editReply` | 없음 |
| 메뉴 → 메뉴 (권역 → 시) | `update` 하나로 교체 | 있음 |

### discord.js의 두 응답

| | `update()` | `editReply()` |
|---|---|---|
| HTTP | `POST /interactions/{id}/{token}/callback` | `PATCH /webhooks/{app}/{token}/messages/@original` |
| 역할 | 이 클릭에 응답 | 이미 있는 메시지를 수정 |
| 호출 | 클릭당 1회. 두 번째는 `InteractionAlreadyReplied` | 응답 뒤에만 가능. 먼저 부르면 `InteractionNotReplied` |
| 전송 | `BurstHandler`, 대기열 없음 | `SequentialHandler`, 별도 대기열 |

두 요청은 다른 처리기를 타므로 라이브러리가 순서를 잡아 주지 않습니다. 순서는 코드의 `await`가 보장합니다.

### 수정 후

`withDisabledComponents`로 응답을 나눴습니다.

```ts
await withDisabledComponents(interaction, async () => {
  await interaction.editReply({
    content: regionCityMenuContent(groupKey),
    components: [regionCitySelectMenu(groupKey), regionCityBackButtons()],
  });
}, { loading: false });
```

보내는 요청은 둘입니다.

```text
① POST /interactions/{id}/{token}/callback
{ type: 7, components: [ region-group-select, disabled: true ] }

② PATCH /webhooks/{app}/{token}/messages/@original
{ content: "2/2단계 — 시를 선택하세요",
  components: [ region-city-select, [뒤로 버튼] ] }
```

- ①의 메뉴는 `StringSelectMenuBuilder.from(component).setDisabled(true)`로 만듭니다. `custom_id`와 옵션은 그대로이고 `disabled`만 달라집니다.
- ①의 Promise가 끝나야 `work()`가 실행되므로 ②는 항상 ① 뒤에 나갑니다.
- 메뉴가 잠겨 있어 ①과 ② 사이에 다시 고를 수 없습니다. ①이 도착하기 전 약 0.4초는 막지 못합니다.
- `work()`가 실패하면 `catch`가 원래 컴포넌트로 되돌리고 예외를 다시 던집니다.

달라진 점은 시 메뉴가 나가는 시점입니다. 수정 전에는 클릭 응답 안, 수정 후에는 클릭 응답이 끝난 뒤입니다.

## 4. 판단

| 구분 | 내용 |
|---|---|
| 코드로 확인 | 수정 전후 요청 구성, 호출 제약, 처리기, `await` 순서 |
| 기록으로 확인 | 서버 실패 없음, 다음 요청 미도착, 수정 후 18회 모두 도착 |
| 추론 | 클릭 응답과 메뉴 교체가 겹칠 때 Discord 앱이 로딩 상태를 풀지 못함 |
| 모름 | 앱이 로딩 상태를 어떻게 관리하는지, 왜 항상이 아니라 가끔 멈췄는지 |

코드는 HTTP 요청을 보낸 시점에 끝나므로 앱이 왜 멈췄는지는 코드로 입증할 수 없습니다. 같은 증상을 설명한 공식 자료도 찾지 못했습니다. 이 수정이 효과를 냈다는 판단은 수정 전후 기록 비교에 근거합니다.

## 5. 재발 방지

- 메뉴를 고른 응답에서 화면을 다른 메뉴로 바꿀 때는 `withDisabledComponents`로 잠근 뒤 `editReply`로 교체합니다.
- 순서는 `functions/src/events/listeners/selectMenus/__test__/onRegionGroupSelect.test.ts`가 확인합니다.
- 다시 멈추면 시 메뉴를 새 메시지로 띄워 같은 자리 교체를 없앱니다.

---

*작성일: 2026-11-03*
