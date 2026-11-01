# Phase 1.15: 멀티 source 구독

**상태**: 🔄 진행 중
**우선순위**: ⭐⭐ (P1)
**의존성**: 1.5 알림 설정 UI, 1.7 자동 알림, 1.10 mock 공고 생성기 (모두 완료)

---

## 개요

### 배경
공고 출처(`RecruitSource`: `"sria"` | `"temp"`, 이번에 `"elias"`로 이름 변경)는 수집·스케줄·변경 감지까지만 소스별로 나뉘어 있다.
구독·알림·표시는 sria 하나만 있다고 가정하고 만들어져 있다.

- 구독 정보(`AlarmSubscription`)에 소스 항목이 없어서, 구독자가 받을 소스를 고를 수 없다.
- 알림 발송(`notificationService`)은 지역 조건만 보고 모든 소스의 공고를 보낸다.
- embed가 sria 형태로 고정되어 있다. temp를 켜면 temp 공고도 sria 모양으로 표시되고, temp 고유 값(`badge` 등)은 보이지 않는다.
- 사이트 갱신이 끝나면 바로 DM이 나간다. 사이트마다 갱신 주기가 달라서(sria 4시간, temp 30분), 여러 사이트를 구독하면 알림이 사이트별로 따로, 자주 온다.

### 목표
1. 소스를 지역과 같은 독립된 구독 조건으로 만든다.
2. 여러 소스의 공고를 한 embed에 섞어 보낼 수 있도록 공통 표시 형식(`RecruitDisplay`)을 만든다.
3. temp(→elias) 공고 타입에서 sria를 흉내 내던 필드를 정리하고, 생성 규칙을 다시 정한다.
4. 사이트 갱신 주기와 상관없이, 모든 사이트의 새 공고를 매일 06~20시 짝수 정시에 DM 한 통으로 보낸다.

### 범위

| 포함 | 제외 |
|------|------|
| 구독 타입 재구성(지역·소스 필터) + 옛 구독 문서 호환 | `features/recruitRequest/**` 미완성 코드 완성 (별도 phase) |
| 소스 필터 + 지역 필터를 함께 적용하는 발송 | `eliasFields.ts`에 실제 동적 필드 정의 추가 (선택) |
| `RecruitDisplay` + 소스별 `toDisplay()` + embed 교체 | 테스트 프레임워크 도입 (Phase 3.1) |
| elias 타입·생성 규칙 정리 (temp에서 이름 변경) | 실배포 환경 검증 |
| `SOURCE_CONFIGS`에 표시 정보(`displayName`·`url`·`userFacing`) 추가 | |
| 구독 UI에 소스 선택 메뉴 추가 | 공고 목록 Redis 키 6시간 만료 변경 (기존 동작 유지) |
| 여러 소스를 함께 다루는 테스트 | |
| 알림 전용 스케줄러(매일 06~20시 짝수 정시), 사이트 갱신은 저장만 | 멈춘 사이트를 알아채는 기능 (별도 모니터링 작업, `todo.md` `[모니터링]`) |
| 게시자(`postedBy`) 속성, 기간 형식 통일, 최신순 정렬 | |
| 사이트 공고가 0건일 때 Redis에서도 지우기 | |
| 공고 조회의 저장 경로를 사이트 갱신 함수(`syncRecruits`)로 통일, Firestore 목록은 읽기만 (2026-10-29 추가) | |

---

## 요구사항

### 기능 요구사항
1. **구독 필터 타입** — `AlarmFilter<T>`를 추가한다. `{ mode: "ALL" }`(전체) 또는 `{ mode: "SELECTED"; values: T[] }`(선택)이다. 소스는 최소 1개이고, 지역은 지금처럼 0개도 허용한다.
   `AlarmSubscription`은 `regions: AlarmFilter<CityEn>`, `sources: AlarmFilter<RecruitSource>`를 갖는다.
2. **옛 구독 문서 호환** — `toAlarmSubscription`이 문서를 읽을 때 변환한다. 데이터 이전 작업은 하지 않는다.
   - 옛 `{ alertMode, regions[] }`는 새 `regions` 필터로 바꾼다.
   - `sources`가 없으면 `{ mode: "ALL" }`로 본다. 기존 구독자는 지금처럼 모든 소스를 받는다.
3. **소스 필터** — `recruitFilter.ts`에 지역 필터와 같은 모양의 소스 필터를 추가한다. 두 필터는 서로를 모르고, 발송 시 둘 다 통과한 공고만 보낸다(AND).
   소스 판정은 `job.value.source`로 한다(`common/types/job.d.ts:7`).
4. **노출 여부(`userFacing`)** — `SOURCE_CONFIGS`의 각 소스에 `displayName`·`url`·`userFacing`을 추가한다.
   - 구독 메뉴에는 `userFacing === true`인 소스만 나온다.
   - 소스 필터가 `ALL`이면 "`userFacing` 소스 전부"를 뜻한다. 숨긴 소스의 공고는 ALL 구독자에게도 가지 않는다.
5. **공통 표시 형식** — `RecruitDisplay { source, sourceLabel, title, postedBy, url?, period?, status?, extraFields? }`를 추가하고, 각 소스가 `toDisplay()`를 제공한다.
   embed는 `RecruitDisplay`만 그린다. "전체 공고" 링크는 `ENV.SRIA_URL` 대신 `SourceConfig.url`을 쓴다.
6. **elias 타입·규칙 정리** (2026-10-14 갱신) — 소스 이름을 temp에서 elias로 바꾸고, `EliasRecruit`를 `{ period, status, fields? }`로 줄인다. `dDay`·`recruitmentStatus`·`url`·`badge`는 제거한다.
   - `period`는 생성 시점으로 정하는 실제 날짜이고 바뀌지 않는다. `status`는 "접수중"에서 "종료"로 한 번만 바뀔 수 있다.
   - 생성 규칙: 30분마다 실행, 모집 기간 12시간, 생성 0개 40%·1개 45%·2개 12%·3개 3%, 종료 전환 10%, 제거 5%. 종료와 제거는 따로 계산한다.
   - 지역은 `요정 왕국`·`세계수 교단`이고 권역 "엘리아스"로 고른다. 공고는 지역마다 1줄만 넣고, 게시자는 지금은 지역과 같게 적는다(2026-10-31 추가). 줄 수만큼만 한 회차에 공고가 만들어진다.
7. **구독 UI** — 소스 선택 메뉴를 추가한다(복수 선택, 최소 1개). 0개는 저장하지 않는다.
8. **알림 전용 스케줄러** (2026-10-14 추가) — 매일 06~20시 짝수 정시(한국 시간)에 돌아 사용자별 DM 한 통을 보낸다. 22시부터 04시까지는 보내지 않는다(2026-10-31 변경).
   - 구독 조건에 맞는 공고 중 새로 생겼거나 바뀐 공고(마감으로 바뀐 공고 포함)가 있으면, 바뀌지 않은 공고까지 포함한 목록 전체를 보낸다(2026-10-27 변경).
   - 구독자 한 명에게 보내지 못해도 따로 저장해 다시 보내지 않는다. 남아 있는 공고는 다음 DM에 함께 들어간다.
   - 발송 뒤 Firestore 공고 목록도 저장한다(2026-10-27 추가). Phase 1.10에서 미룬 "Firestore 목록 시간 기준 저장"을 이 단계로 처리한다.
   - 예약 실행할 작업(사이트 갱신, 알림)은 목록 한 곳(`SCHEDULED_JOBS`)에 적고, 운영 함수·로컬 한 번 실행·계속 실행이 모두 이 목록을 읽는다(2026-10-27 추가).
   - 사이트 갱신은 저장과 변경 감지까지만 하고 DM을 보내지 않는다. 갱신 주기: sria 2시간(지금 4시간), elias 30분.
   - 알림 시작 시 각 사이트를 동시에 먼저 갱신한다. 최근 5분 안에 갱신했으면 건너뛰고, 다른 갱신이 진행 중이면 끝날 때까지 기다린다.
   - "지난 알림 때 목록"과 비교해 보낼 공고를 고른다. 이 목록이 없으면 저장만 하고 보내지 않는다. 이 목록에는 만료 시간을 두지 않는다(2026-10-31 추가).
   - 갱신에 실패한 사이트가 있고 최신 공고 목록이 비어 있으면 아무것도 저장하지 않는다. 모든 사이트가 정상으로 0건을 돌려주면 지난 알림 때 목록과 Firestore 공고 목록을 비운다(2026-10-31 추가).
   - 알림이 두 번 실행되어도 DM은 한 번만 간다(Redis 락).
   - 다른 갱신을 60초 넘게 기다리면 그 사이트 갱신은 실패로 처리한다(2026-11-01 추가).
9. **게시자** (2026-10-14 추가) — 모든 공고에 `postedBy`(업체 이름이나 사람 이름)를 둔다. 제목이 같아도 게시자가 다르면 다른 공고다. 제목으로 중복을 거르지 않는다.
   - 게시자는 공고 조회 둘째 줄에만 보이고 DM에는 보이지 않는다(2026-10-31 변경).
   - 작성 시각 `postedAt`은 선택 값으로 공통 타입에 둔다(2026-10-27 추가). 지금은 sria만 아는 공고에 적고, 공고 조회 화면에 "작성" 칸으로 보인다.
10. **기간 형식·정렬** (2026-10-14 추가) — 모든 사이트의 기간 값은 `YYYY.MM.DD`로 시작한다. 정렬은 시작 날짜 기준 최신순이다.
    - DM (2026-10-27 변경): 접수중 → 발표중 → 종료 순서, 같은 상태 안에서는 최신순. "종료" 공고도 빼지 않고 뒤에 둔다. 사이트마다 상위 3건.
    - 공고 조회: 상태와 상관없이 최신순.
11. **빈 목록 처리** (2026-10-14 추가) — 사이트 공고가 0건이면 Redis에서도 그 사이트 공고를 지운다. 가져오기 실패와 사이트 설정 누락은 오류로 처리해 공고를 지우지 않는다.

### 비기능 요구사항
- **호환성**: 기존 구독자는 아무 설정을 바꾸지 않아도 지금과 같은 알림을 받는다.
- **배포 안전성**: 스케줄러(Functions)와 게이트웨이(Oracle VM)가 같은 구독 문서를 읽는다. 옛 코드는 새 형식을 읽지 못하므로 둘을 같은 커밋으로 함께 배포한다(리스크 1, design §2.2).
- **에러 처리**: SystemError 패턴을 따른다.

---

## 기술 스택 (프로젝트 고정)

| 항목 | 기술 |
|------|------|
| Runtime | Firebase Functions (Node.js) |
| Language | TypeScript (strict mode) |
| Database | Firestore |
| Messaging | discord.js |
| Event System | EventBus (Singleton) |
| Error Handling | SystemError + errorHandler |
| Logging | SystemLogger |

---

## 구현 전략

### 접근 방식
- 지역과 소스는 서로 영향을 주지 않는 조건이다. 같은 모양의 필터(`AlarmFilter<T>`) 두 개로 표현하고, 발송할 때 둘 다 통과한 공고만 보낸다.
- embed는 소스별 공고 타입을 직접 읽지 않고 `RecruitDisplay`만 읽는다. 소스를 추가해도 embed 코드는 바뀌지 않는다.
- 소스 표시 정보는 `SOURCE_CONFIGS` 한 곳에만 둔다. 소스를 추가할 때는 이 목록에 한 줄을 더한다.
- 구현 순서: 타입·저장 형식 → 필터·발송 → UI·embed. 타입이 먼저 바뀌어야 나머지 코드가 컴파일된다.

### 영향 받는 파일
| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `common/types/alarmSubscription.ts` | 수정 | `AlarmFilter<T>` 추가, `AlarmSubscription`·`AlarmSubscriptionInput` 재구성 |
| `common/types/recruit.d.ts` | 수정 | `RecruitDisplay` 추가, 공통 `postedBy` 추가, `TempRecruit` → `EliasRecruit` 정리 |
| `providers/recruit/index.ts` | 수정 | `SOURCE_CONFIGS`에 `displayName`·`url`·`userFacing` |
| `providers/recruit/{sria,elias}/**` | 수정 | temp → elias 이름 변경, `toDisplay()` 구현, elias 생성 규칙 정리, 게시자는 공고 목록 `eliasTitles.ts`의 한 줄에 적음 |
| `common/utils/recruitFilter.ts` | 수정 | 소스 필터 추가, 지역 필터와 함께 적용 |
| `services/notificationService.ts` | 수정 | 발송 시 소스 필터 적용, ALL = `userFacing` 소스 전부 |
| `providers/firebase/store/subscription.ts` | 수정 | 새 저장 형식 + 옛 문서 읽기 변환, 쓰기 메서드를 필터 단위로 |
| `features/alarmSubscribe/**` | 수정 | 소스 선택 메뉴, `ai/interpreter.ts` 컴파일 대응 |
| `providers/discord/builder/embeds/**` | 수정 | `RecruitDisplay` 기반 렌더, "전체 공고" 링크 = `SourceConfig.url` |
| `app/scheduler.ts`, `schedulers/**`, `schedulers/jobs.ts`(신규) | 수정 | 작업 목록 `SCHEDULED_JOBS`로 알림 함수 등록, 범용 스케줄러, elias 함수 이름 |
| `common/constants/city.ts`, `common/utils/cityName.ts` | 수정 | elias 지역 권역 추가, 지역 이름에 공백 허용 |
| `services/notificationService.ts` (알림 스케줄러 본체) | 수정 | 강제 갱신 → 비교 → 발송, 락, 지난 알림 때 목록 |
| `events/bus/handlers/NotificationEventHandler.ts`, `events/bus/utils/registerEventHandlers.ts` | 삭제·수정 | `RECRUIT_CHANGED` → 즉시 발송 연결 해제 |
| `services/recruitService.ts`, `services/recruitSourceService.ts` | 수정 | 마지막 갱신 시각 저장, 0건 처리, 설정 누락 오류, 공고 조회가 Redis가 비면 `syncRecruits`를 부르게 변경·직접 가져와 저장하던 경로 삭제 |
| `providers/redis/**` | 수정 | 지난 알림 때 목록·마지막 갱신 시각 키 |
| `providers/recruit/sria/sriaPostings.ts`, `sriaMockConfig.ts` | 수정 | `postedBy` 값, 갱신 주기 120분 |
| `NOTIFICATION_SEND` 이벤트 데이터 | 수정 | 구독 객체 형식 변경에 따라 함께 바뀜 (`notificationMessageEmbed.ts`가 `alertMode`를 읽음) |
| `src/**/__test__/`, `test/mocks/**` | 신규 | elias 테스트 데이터 + 여러 소스 테스트 |

`alertMode`·`regions`를 참조하는 파일은 32개다. 전부 컴파일 오류 없이 고치는 것이 첫 번째 확인 기준이다.

### 위임 계획 (CTO Lead, 2026-10-10 승인)

| 영역 | 위임 대상 | 근거 | 예상 산출물 |
|------|----------|------|-------------|
| 데이터 스키마 (구독 문서 호환) | Integration Lead → Backend Expert | 요구사항 1, 2 | `AlarmFilter<T>`, `AlarmSubscription` 재구성, 옛 문서 읽기 변환, 필터 단위 쓰기 메서드 |
| 필터·발송 | Integration Lead | 요구사항 3, 4, 5(`toDisplay`), 6 | 소스 필터, ALL 해석, `SOURCE_CONFIGS` 표시 정보, 소스별 `toDisplay()`, elias 정리 |
| Discord UI | Discord Agent | 요구사항 5(embed), 7 | 소스 선택 메뉴, `RecruitDisplay` 기반 embed, "전체 공고" 링크 교체 |

- 소스 구분 방식(소스별로 묶기 / 항목마다 배지 달기)은 design 단계에서 Frontend Architect와 정한다.
- `ai/interpreter.ts`는 컴파일 오류만 고치므로 AI Agent에 맡기지 않는다.

### 의존성 분석
- **이 phase가 쓰는 기존 모듈**: 알림 설정 저장소(1.4), 알림 설정 UI(1.5), 자동 알림 발송(1.7), sria·temp mock 공고 생성기(1.10)
- **이 phase에 의존하는 후속 작업**: elias를 실제 사용자에게 공개하는 일, `recruitRequest` 완성(`RecruitDisplay`·`SourceConfig` 재사용)

---

## 성공 기준

- [ ] `cd functions && npm run build` 오류 0
- [ ] `npm run lint` 오류 0 (2026-10-10 기준 0건)
- [ ] 여러 소스 테스트 4종 통과 (기존 `__test__` 방식: 파일을 직접 실행)
  1. 소스별 변경 감지 분리 — elias 변경이 sria 쪽 비교 결과에 영향을 주지 않음
  2. `toDisplay` 변환 — 특히 elias `fields` → `extraFields`
  3. 구독 조건 일치 — "sria만 / elias만 / 둘 다 / ALL"
  4. 노출 여부 — `userFacing = false`인 소스가 ALL 구독자에게 가지 않음
- [ ] 로컬 2회 실행 검증: `RUN_SCHEDULER_ONCE=true node lib/app/scheduler.js`
  - 1회차에 기준 데이터를 저장하고, `recruit:notified:all`에서 공고 1건을 지운 뒤 2회차를 실행한다.
  - 소스·지역 조건이 맞는 구독자에게만 발송되는지 로그로 확인한다.
- [ ] elias 생성 규칙 테스트 통과 — 값 고정, 종료 한 번, 기간 형식, 같은 회차 제목+게시자 중복 없음
- [ ] 알림 스케줄러 로컬 확인 — 처음 실행은 저장만, 두 번 실행해도 DM 1회, 갱신 진행 중이면 기다린 뒤 읽음
- [ ] 소스 항목이 없는 기존 구독 문서가 `sources: { mode: "ALL" }`로 읽혀 모든 소스를 계속 받음
- [ ] 기존 기능 정상 동작 확인

---

## 리스크 및 고려사항

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| 1. `regions` 필드 이름은 그대로인데 값 모양이 배열 → 객체로 바뀐다. 스케줄러와 게이트웨이 중 하나만 배포되거나 되돌려지면, 옛 코드가 새 문서를 읽다가 `filterByRegion`에서 오류로 멈춘다 | 🔴 높음 | design 단계에서 두 방식을 비교한다: ① 같은 필드 이름으로 덮어쓰고 두 프로세스를 함께 배포 ② 새 필드 이름(`regionFilter`·`sourceFilter`)으로 저장하고 옛 필드는 읽기용으로 남김 |
| 2. 32개 파일이 `alertMode`·`regions`를 참조하고, `NOTIFICATION_SEND` 이벤트 데이터 형식도 바뀐다 | 🟡 중간 | 타입부터 바꿔 컴파일 오류로 참조 지점을 전부 찾는다 |
| 3. 시드 문서는 소스 판정을 `job.source`로 적었으나 실제 타입은 `job.value.source`다 | 🟢 낮음 | 이 계획서 기준(`job.value.source`)으로 구현한다 |
| 4. 테스트 실행 스크립트가 없다 | 🟢 낮음 | 기존 `__test__` 방식(파일을 직접 실행)으로 작성한다 |
| 5. 알림 스케줄러로 발송 경로가 바뀐다. 지난 알림 때 목록이 사라지거나, 알림이 두 번 실행되거나, 발송 중 멈추면 중복·누락이 생길 수 있다 | 🟡 중간 | 목록이 없으면 저장만, Redis 락으로 한 번만 실행, 목록은 발송 뒤 저장(누락보다 중복을 택함). design §2.8 |
| 6. 사이트 공고가 0건일 때 지우면, 사이트 코드 버그로 0건이 나온 경우도 지워진다 | 🟢 낮음 | 진짜 0건과 구분할 수 없으므로 지우되, 공고가 있다가 0건이 되면 경고 로그를 남긴다 |

---

*작성일: 2026-10-10 · 갱신: 2026-11-01*
*시드: .claude/phases/phase-source-subscription.md*
