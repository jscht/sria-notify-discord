# elias 공고 작성 가이드

이 폴더(`elias/`)는 데모용 **가짜 공고**를 만드는 곳입니다.
당신이 할 일은 **공고 목록을 정해두는 것**뿐입니다. 나머지는 생성기가 알아서 만듭니다.

## 1. 공고 추가하기

`eliasTitles.ts`를 열고 배열에 **공고 한 줄**을 추가하세요:

```ts
export const eliasTitles: EliasTitle[] = [
  { region: "fairyKingdom", title: "어제 팔리지 않은 빵 판매", postedBy: "요정 왕국" },
  { region: "worldTreeOrder", title: "교단 가입시키기", postedBy: "세계수 교단" },   // ← 이렇게 추가
];
```

| 속성 | 넣는 값 |
|------|--------|
| `region` | 지역 값 (fairyKingdom, worldTreeOrder 등. `common/constants/city.ts`의 영문 지역 키) |
| `title` | 지역을 뺀 공고 제목 |
| `postedBy` | 게시자 이름 |

생성기가 `[요정 왕국] 어제 팔리지 않은 빵 판매` 형식으로 공고 제목을 만듭니다.

## 2. 어떻게 공고가 되나?

생성기가 정해진 주기마다 돌면서 이 **공고 목록에서 골라** 공고를 만듭니다.

- ✅ **당신이 정하는 것** : 공고 목록(`eliasTitles`)
- 🤖 **자동으로 채워짐** : 어떤 줄을 쓸지 선택 · 공고번호(id) · 모집 기간 · 상태(접수중, 조기 마감되면 종료)

한 번 생성할 때 같은 줄은 한 번만 씁니다. 줄을 다 쓰면 그 회차의 나머지 공고는 만들지 않습니다.

규칙 엔진이 시간에 맞춰 생성·수정하고, 모집 기간이 끝나면 공고가 스스로 사라집니다.

## 3. 추가한 다음엔?

저장 → 배포(`firebase deploy`) → 공고 동기화 스케줄러가 돌며 공고를 생성·수정·삭제합니다.
구독자 DM은 알림 스케줄러가 매일 06~20시 짝수 정시에 보냅니다.
(첫 알림은 기준만 저장하고, 두 번째 알림부터 DM이 나갑니다.)

## 4. 공고 빼기 / 주기·확률 바꾸기

- **공고 빼기**: `eliasTitles.ts`에서 그 줄을 지우면 됩니다.
- **주기·확률**(`eliasMockConfig.ts`):
  | 항목 | 뜻 |
  |------|-----|
  | `intervalMinutes` | 공고를 갱신하는 주기(분). 예: `30` |
  | `spawnProbs` | 한 번에 몇 개 생길지 확률 (1개 45% · 2개 12% · 3개 3% · 나머지 40%는 0개) |
  | `closeProb` | 접수중이 종료로 바뀌는 확률 (0.10 = 10%). 종료된 공고는 모집 기간이 끝날 때까지 목록에 남습니다 |
  | `deleteProb` | 공고가 목록에서 빠지는 확률 (0.05 = 5%) |
  | `lifespanTicks` | 모집 기간. 실제 시간 = `unitMs` × `lifespanTicks` (지금 12시간) |

`closeProb`와 `deleteProb`는 따로 계산됩니다.

## 5. (고급) 속성 추가하기

제목 외 다른 속성(예: 급여 표시)을 넣고 싶으면 `eliasFields.ts`에 규칙을 추가합니다.
각 속성은 **포함 규칙**(무조건/확률)과 **값 규칙**(고정/풀에서 랜덤)을 가집니다:

```ts
export const eliasFields: EliasField[] = [
  { key: "급여", required: true, value: { kind: "fixed", value: "시급 협의" } },
  { key: "근무 시간", required: false, chance: 0.3, value: { kind: "pick", pool: ["오전", "오후"] } },
];
```

| 속성 | 넣는 값 |
|------|--------|
| `key` | 화면에 보일 이름 (예: 급여) |
| `value` | 그 값 (예: 시급 협의) |
