# Phase 1.15 갭 분석: 멀티 사이트 구독

**상태**: 🔍 검토 중
**분석일**: 2026-11-03
**설계서**: `docs/phase-1-15/02-design.md`
**분석 대상**: 커밋 `0e3f2d9`, `10cd01e`, `4c6ee2e`와 그 뒤 미커밋 작업 트리

이전 매치율 99.35%(2026-11-02)는 커밋 기준이었습니다. 이번에는 런타임 검증 중 바꾼 화면·저장 방식까지 넣고, 설계서 안에서 옛 문구와 새 문구가 어긋나는 곳도 감점했습니다. 점수가 내려간 이유는 이 기준 때문이며, 코드가 설계를 어긴 곳은 찾지 못했습니다.

표의 경로는 별도 표시가 없으면 `functions/src/` 기준입니다. "(교체)"는 현재 설계에 맞춰 바꾼 행, "(신규)"는 이번에 추가한 행입니다.

부분일치(P)는 코드는 최신 결정대로인데, 같은 항목을 다룬 설계서의 다른 문구가 옛 동작이나 옛 시그니처를 적고 있는 경우입니다. 같은 옛 문구는 한 번만 감점했습니다.

---

## 1. 갭 분석 (Gap Detector)

### 1.1 Structural (가중치 0.2)

| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| 1 | §2.1 구독 타입, index export | ✅ | Y | `common/types/alarmSubscription.ts`, `common/types/index.ts` |
| 2 | §2.1 `alarmFilter.ts` | ✅ | Y | `common/utils/alarmFilter.ts` |
| 3 | §2.5 `RecruitDisplay`·`DisplayField`·`EliasRecruit` | ✅ | Y | `common/types/recruit.d.ts` |
| 4 | §2.5 소스별 변환 파일 2개 | ✅ | Y | `providers/recruit/sria/sriaDisplay.ts`, `elias/eliasDisplay.ts` |
| 5 | §2.4 `SourceConfig`, `getUserFacingSources`, `toDisplay` export | ✅ | Y | `providers/recruit/index.ts:19,62,75` |
| 6 | §2.6 `EliasRegions`, 권역 `eliasRegions` | ✅ | Y | `common/constants/city.ts:117,134,149` |
| 7 | §2.6 주석 77개·권역 11 | ✅ | Y | `selectMenus/regionSelectMenus.ts:44-45` |
| 8 | §2.7 필터·정렬 함수, `filterByMode` 삭제 | ✅ | Y | `common/utils/recruitFilter.ts` |
| 9 | §2.8.2 `recruitHash.ts` | ✅ | Y | `common/utils/recruitHash.ts` |
| 10 | §2.8.2 `notifiedHashStore.ts`, store 등록 | ✅ | Y | `providers/redis/store/notifiedHashStore.ts`, `redisManager.ts:4,16,24` |
| 11 | §2.8.2 `jobs.ts`, 스케줄러 export | ✅ | Y | `schedulers/jobs.ts`, `schedulers/index.ts:7,14` |
| 12 | §2.8.2 `NotificationEventHandler` 삭제 | ✅ 검색 0건 | Y | `events/bus/` |
| 13 | §2.8.4 `RequestLimit*` 삭제 | ✅ 검색 0건 | Y | `providers/redis/` |
| 14 | §2.8.4 `collectAndSaveRecruits`·`fetchAll`·`isRequestAllowed` 삭제 | ✅ 검색 0건 | Y | `services/` |
| 15 | §2.9.1 `subscriptionSummary.ts` | ✅ | Y | `providers/discord/builder/subscriptionSummary.ts` |
| 16 | §2.9.2 `recruitList.ts`, `recruitField` 삭제 | ✅ | Y | `builder/embeds/recruitList.ts`, `jobLink.ts` |
| 17 | (교체) §2.9.5 신규 파일 4개 | ✅ | Y | `providers/recruit/sourceToggle.ts`, `buttons/sourceToggleButtons.ts`, `listeners/buttons/renderSourceSettings.ts`, `onSourceToggle.ts` |
| 18 | (교체) §2.9.6 옛 파일 6개 삭제, 메뉴 등록 해제 | ✅ | Y | `events/handlers/selectMenus/index.ts:17-21` |
| 19 | §2.9.7 ID 상수와 등록 | ✅ | Y | `constants/sourceSelectAction.ts`, `subscribeOptionAction.ts:6`, `fullActionId.ts:30,39-41,72`, `constants/index.ts:28-29` |
| 20 | (교체) §2.9.7 버튼 빌더 2개 | ✅ | Y | `buttons/subscribeSettingsHubButtons.ts`, `buttons/sourceToggleButtons.ts` |
| 21 | (교체) §2.9.7 핸들러 3개, 그리기 함수 2개 | ✅ | Y | `onShowRegionSettings.ts`, `onSourceSelectOpen.ts`, `onSourceToggle.ts`, `renderSubscribeSettingsHub.ts`, `renderSourceSettings.ts` |
| 22 | §2.9.7 핸들러 맵 합치기 | ✅ | Y | `handlers/buttons/sourceSelectHandlers.ts`, `index.ts:6,15`, `showSubscribeOptionHandler.ts:11` |
| 23 | §2.11 A 폴더·파일 6개 이름 변경 | ✅ | Y | `providers/recruit/elias/` |
| 24 | §2.11 B, §5 소스 이름 `temp` 없음 | ✅ 검색 0건 | Y | `functions/src` |
| 25 | §6.1 테스트 목록 | ⚠️ 설계 11종은 있음. 추가 3종이 설계서에 없음 (D10) | P | `sourceToggle.test.ts`, `onRegionGroupSelect.test.ts`, `disableMessageComponents.test.ts` |
| 26 | §2.10 C 문서 5곳 | ✅ | Y | `providers/`, `services/`, `features/`, `events/bus/`의 문서, `.claude/docs/ARCHITECTURE.md:180-191` |
| 27 | §2.11 `functions/src` 밖 문서 4개 | ✅ 옛 이름 검색 0건 | Y | `README.md` 외 3개 |
| 28 | (신규) §1.1·§2.10 파일 표 | ⚠️ 옛 내용과 빠진 파일이 있음 (D3, D4) | P | 설계서 31, 1398, 1423, 1425, 1478행 |
| 29 | (신규) §6.2 표 | ⚠️ 옛 표현 2곳과 빠진 검증 행이 있음 (D9) | P | 설계서 1686, 1693행 |

### 1.2 Functional (가중치 0.4)

| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| 1 | §2.2 읽기 변환표 7경우 | ✅ | Y | `providers/firebase/store/subscription.ts:25-72` |
| 2 | §2.2 모드만 변경, 전체 교체, `alertMode` 삭제 | ✅ | Y | `subscription.ts:121-201` |
| 3 | §2.3 `updateSources` 0개 거부, `ensureExists` | ✅ | Y | `subscriptionService.ts:138-159,235-239` |
| 4 | §2.4 두 소스 노출, sria 120분 | ✅ | Y | `recruit/index.ts:36-50`, `sriaMockConfig.ts:16` |
| 5 | §2.5 변환 규칙 | ✅ | Y | `sriaDisplay.ts:13-42`, `eliasDisplay.ts:12-22` |
| 6 | §2.6 생성 규칙 | ✅ | Y | `eliasRule.ts:110-156`, `eliasMockConfig.ts:14-23` |
| 7 | §2.6 값 고정, 한국 시간 기간, 종료 전환 | ✅ | Y | `eliasRule.ts:69-93,131-132,151` |
| 8 | §2.6 지역 공백 허용 | ✅ | Y | `common/utils/cityName.ts:63` |
| 9 | §2.7 소스·지역 필터, 숨긴 소스 제외 | ✅ | Y | `recruitFilter.ts:29-81` |
| 10 | §2.7 최신순, 상태순 + 최신순 | ⚠️ 시각까지 비교함. 설계서 667행에 "정렬 기준이 날짜뿐"이 남음 (D1) | P | `recruitFilter.ts:92-120,154-158` |
| 11 | §2.8.0 처음 쓸 때 생성, 객체 주입 | ✅ | Y | `notificationService.ts:176-200`, `recruitService.ts:84-90` |
| 12 | §2.8.1 판정 ①~⑤ | ⚠️ 코드는 §2.9.5대로 `expandSourceFilter`를 씀. §2.8.1·§1.2는 옛 호출임 (D2) | P | `notificationService.ts:75` |
| 13 | §2.8.1 구독자별 try/catch, 실패해도 목록 저장 | ✅ | Y | `notificationService.ts:73-96,155` |
| 14 | §2.8.2 락 → 갱신 → 비교 → 발송 → 저장 | ✅ | Y | `notificationService.ts:113-163` |
| 15 | §2.8.2 빈 목록 3경우, `__empty__` | ✅ | Y | `notificationService.ts:128-132`, `notifiedHashStore.ts:33-53` |
| 16 | §2.8.2 첫 실행은 저장만 | ✅ | Y | `notificationService.ts:136-142` |
| 17 | §2.8.2 건너뛰기, 1초 재시도, 대기 초과 예외 | ✅ | Y | `recruitService.ts:173-184,239-255` |
| 18 | §2.8.2 마지막 갱신 시각 저장 시점 | ✅ | Y | `recruitService.ts:196,203` |
| 19 | §2.8.2 작업 목록 한 곳, 세 실행 방식, `ready` 지연 시작 | ✅ | Y | `app/scheduler.ts:24-62`, `factory.ts:14-15`, `initializeSchedulers.ts:11-15` |
| 20 | §2.8.2 사이트 갱신은 DM 없음 | ✅ | Y | `recruitService.ts:198-200` |
| 21 | §2.8.4 공고 조회 4단계, Firestore 읽기만 | ✅ | Y | `recruitService.ts:101-125` |
| 22 | §2.12 0건 삭제, 경고 로그, 설정 누락 오류 | ✅ | Y | `recruitService.ts:190-192`, `recruitSourceService.ts:22-24` |
| 23 | §2.9.1 요약 문구, 아이콘 | ✅ | Y | `subscribeEntryView.ts:21`, `subscriptionSummary.ts:18-43` |
| 24 | §2.9.2 두 모드, 사이트 묶음, 꼬리줄 | ⚠️ 간단히 모드는 제목 다음 줄에 기간을 그림. 1132·1138행 예시는 옛 한 줄 모양임 (D8) | P | `recruitList.ts:69-71,131-154` |
| 25 | §2.9.3 DM embed, 안내 문구 순서 | ✅ | Y | `notificationMessageEmbed.ts:11,27-70` |
| 26 | §2.9.4 공고 조회 거르기·정렬·문구 | ✅ | Y | `onRecruitRequest.ts:58-70`, `recruitMessageEmbed.ts:17-33` |
| 27 | (교체) §2.9.5 공고 켜기/끄기 화면과 저장 절차 | ✅ | Y | `onSourceToggle.ts:23-33`, `sourceToggle.ts:111-122`, `sourceToggleButtons.ts:24-40`, `renderSourceSettings.ts:7-29` |
| 28 | (교체) §2.9.6 첫 구독에 사이트 질문 없음, 일반 공고만 켬 (2026-11-05) | ✅ | Y | `onEnableAllRegionAlert.ts`, `onEnableSelectedRegionAlert.ts`의 `initialSourceFilter()`, `sourceToggle.ts`, `sourceToggle.test.ts` "첫 구독" |
| 29 | §2.9.7 설정 관리 화면, 뒤로 경로, 관리 embed | ✅ | Y | `subscribeSettingsHubButtons.ts:13-28`, `subscribeManageButtons.ts:25`, `subscribeManageEmbed.ts:14-28`, `onShowSubscribeManage.ts:21` |
| 30 | §2.9.8 문서 없음 문구, 저장 실패 복구 | ✅ | Y | `renderSubscribeSettingsHub.ts:36-51`, `disableMessageComponents.ts:59-80` |
| 31 | §6.1 테스트 검증 항목 | ⚠️ 이전 갭 G1은 해소됨. 5번의 "간단히: 한 줄"이 현재 테스트와 다름 (D8) | P | `embeds/__test__/recruitList.test.ts:176-183` |
| 32 | (신규) §2.9.5 저장값 표, 알림 판정 | ✅ | Y | `sourceToggle.ts:81-102`, `sourceToggle.test.ts:102-109,136-151` |
| 33 | (신규) §2.9.5 꺼진 공고의 지역은 화면에서만 뺌, 표시 순서 | ✅ | Y | `sourceToggle.ts:165-186`, `subscriptionSummary.ts:18-27`, `notificationMessageEmbed.ts:32`, `subscribeRemove.ts:37` |
| 34 | (신규) §2.9.5 공고별 인용 블록, 인라인 코드, 0개 경고·잠금 | ✅ | Y | `formatRegionList.ts:23-42`, `subscribeManageButtons.ts:30-36` |
| 35 | (신규) §2.9.5 초기화는 보이는 지역만 지움 | ✅ | Y | `subscribeClear.ts:34-38` |
| 36 | (신규) §2.9.5 공고별 지역 개수 제한 | ✅ | Y | `sourceToggle.ts:206-208`, `subscribeManageButtons.ts:33-34`, `onRegionCitySelect.ts:40-47` |
| 37 | (신규) §2.9.5 지역 추가 메뉴 | ✅ | Y | `regionSelectMenus.ts:15-66`, `subscribeAdd.ts:28-39` |
| 38 | (신규) §2.9.5 잠금 뒤 교체, 뒤로 버튼 3곳 | ✅ | Y | `onRegionGroupSelect.ts:21-26`, `subscribeSettingsHubButtons.ts:44-55`, `subscribeRemove.ts:49` |
| 39 | (2026-11-05 추가) §2.9.5 지역 모드가 ALL일 때 지역 편집 | ✅ 재분석 때 [➖ 제거] 버튼 경로가 달라 P였고, 같은 날 수정 | Y | `renderSubscribeManage.ts`의 `rerenderIfAllRegions`, `subscribeAdd.ts`, `subscribeRemove.ts`, `onRegionCitySelect.ts`, `onRegionRemoveSelect.ts`, `subscribeClear.ts` |

### 1.3 Contract (가중치 0.4)

| # | 설계 항목 (§참조) | 구현 상태 | 일치 | 파일 경로 |
|---|-----------------|----------|------|----------|
| 1 | §2.1 구독 타입 모양 | ✅ | Y | `common/types/alarmSubscription.ts:25-49` |
| 2 | §2.2 Store 메서드 표 | ✅ | Y | `subscription.ts:108-237` |
| 3 | §2.2·§3.1 저장 형식 | ✅ | Y | `subscription.ts:78-82` |
| 4 | §2.3 서비스 시그니처 | ✅ | Y | `subscriptionService.ts:34,88,110,138` |
| 5 | §2.4 `SourceConfig` 타입과 값 | ✅ | Y | `recruit/index.ts:19-50` |
| 6 | §2.5·§2.6 공고·표시 타입 | ✅ | Y | `recruit.d.ts:21-79` |
| 7 | §2.5 변환 함수, `never` 분기 | ✅ | Y | `recruit/index.ts:75-85` |
| 8 | §2.6 `EliasTitle`, `EliasRuleConfig` | ✅ | Y | `eliasTitles.ts:9-16`, `eliasRule.ts:13-28` |
| 9 | §2.7 필터·정렬 시그니처 | ✅ | Y | `recruitFilter.ts:29,40,78,92,116,130,154` |
| 10 | §2.8.0 Deps 타입, `getNotificationService` | ✅ | Y | `notificationService.ts:31-38,198`, `recruitService.ts:24-31` |
| 11 | §2.8.1·§2.8.2 `notifyRecruits`, `runNotification` | ✅ | Y | `notificationService.ts:60,113` |
| 12 | §2.8.2 `ScheduledJob`, 작업 3개 값 | ✅ | Y | `schedulers/jobs.ts:11-54` |
| 13 | §2.8.2 Redis 메서드 | ✅ | Y | `notifiedHashStore.ts:33,48`, `redisManager.ts:110` |
| 14 | §2.8.2 `syncRecruits(source, options?)` | ✅ | Y | `recruitService.ts:34-39,166-169` |
| 15 | §2.8.3·§3.2 `NOTIFICATION_SEND`, `jobCount` | ✅ | Y | `events/bus/types.ts:116-117`, `NotificationSendHandler.ts:23-40` |
| 16 | §2.8.4 `getRecruitList` 반환형 | ✅ | Y | `recruitService.ts:101-103` |
| 17 | §2.9 입력 계약 | ⚠️ embed는 `RecruitDisplay`만 읽음. 지역 라벨과 구독 메뉴 설명이 옛 내용임 (D7) | P | `recruitList.ts:147`, `notificationMessageEmbed.ts:32` |
| 18 | §2.9.1 `regionSummary`, `sourceSummary` | ⚠️ `regionSummary`는 켜진 공고를 알아야 해서 `Pick<AlarmSubscription, "regions" \| "sources">`를 받음. 설계서는 `AlarmFilter<CityEn>`임 (D6) | P | `subscriptionSummary.ts:18-21,35` |
| 19 | §2.9.2 `DisplayDetail`, `formatRecruitLine`, `formatRecruitGroups` | ✅ | Y | `recruitList.ts:14,62,131` |
| 20 | §2.9.3·§2.9.4 embed 시그니처 | ✅ | Y | `notificationMessageEmbed.ts:27,49`, `recruitMessageEmbed.ts:17` |
| 21 | (교체) §2.9.5 `sourceToggle.ts` 함수 6개 | ✅ | Y | `sourceToggle.ts:39,81,92,111,142,153` |
| 22 | (교체) §2.9.5 `ownRegionGroup?: CityGroupKey`, `sources` 저장 형식 유지 | ✅ | Y | `recruit/index.ts:32,48`, `subscription.ts:196-201` |
| 23 | §2.9.7 버튼 ID 4개, `notice?`, 액션 ID 통과 | ✅ | Y | `fullActionId.ts:30,39-41`, `renderSubscribeManage.ts:19`, `renderSubscribeSettingsHub.ts:20` |
| 24 | §3.3 Redis 키 6개와 만료 시간 | ✅ | Y | `recruitKeyManager.ts:19,21`, `recruitService.ts:15,21,175`, `notificationService.ts:26-28` |
| 25 | §2.2·§2.9.8 오류 처리 패턴 | ✅ | Y | `subscriptionService.ts:142-144`, `recruitService.ts:251` |
| 26 | §5 `common` 의존 방향, `undefined` 없음, JSDoc | ✅ | Y | `recruitFilter.ts`, `alarmFilter.ts`, `recruitHash.ts`, `subscription.ts:78-82` |
| 27 | (신규) §2.9.7 관리 embed의 `selectedRegionContent` 입력 | ⚠️ 설계 1341행은 `selectedValues(sub.regions)`, 코드는 공고별 표시를 위해 `activeRegionsByToggle(sub)`를 넘김 (D5) | P | `subscribeManageEmbed.ts:16-18`, `formatRegionList.ts:23` |

---

## 2. 매치율 산출

| 카테고리 | 일치/전체 | 점수 |
|----------|----------|------|
| Structural (×0.2) | 27.5/29 (Y 26, P 3) | 94.83% |
| Functional (×0.4) | 36/38 (Y 34, P 4) | 94.74% |
| Contract (×0.4) | 25.5/27 (Y 24, P 3) | 94.44% |
| **종합 매치율** | | **94.64%** |
| **재분석 (2026-11-05, D1~D10 수정 뒤)** | 28.5/29, 38.5/39, 27/27 | **99.14%** |
| **재분석 갭 처리 뒤 (2026-11-05)** | 29/29, 39/39, 27/27 | **100%** |

2026-11-03 분석의 부분일치 10개는 모두 설계서의 옛 문구(§3.2 D1~D10) 때문이었습니다. 설계서를 고친 뒤 Gap Detector로 다시 분석한 결과, 10개 중 9개가 일치가 되었고 갭 2개가 남았습니다.

- **F39 (신규 Functional 행):** 옛 화면의 [➖ 제거] 버튼은 안내 화면 대신 "제거할 지역이 없어요."를 보여 주고 옛 embed를 남겼다. `subscribeRemove`·`subscribeAdd`도 `rerenderIfAllRegions`를 부르게 고쳐 해소했다.
- **S28:**
  - §2.10 B 표의 "16개" 문구가 14행과 맞지 않았다. 문구를 고쳐 해소했다.
  - `alertRegionEditButtons.ts`가 파일 표에 없다는 지적은 갭이 아니다. 이 파일은 dev와 같고 이번 Phase에서 바뀌지 않았다.

마지막 100%는 이 두 행을 직접 다시 대조한 값입니다.

### 산출 공식
```
카테고리 점수 = (완전일치 + 부분일치 × 0.5) / 전체항목 × 100
종합 매치율 = Structural × 0.2 + Functional × 0.4 + Contract × 0.4
```

설계 항목은 묶어서 세었습니다. 묶는 방식에 따라 점수는 조금 달라질 수 있습니다.

---

## 3. 갭 목록

### 3.1 미구현 항목

없습니다.

### 3.2 설계 차이

**이전 갭**

| # | 상태 | 근거 |
|---|------|------|
| G1 테스트의 발송 시도 인원 확인 누락 | 해소 | `services/__test__/runNotification.test.ts:360`이 비동기 실패 때 2를, `:284`가 동기 예외 때 1을 확인한다 |
| G2 권역 선택 뒤 멈춤 | 해소 | `onRegionGroupSelect`를 잠금 뒤 교체로 바꿨다. 수정 전 15회 중 9회만 다음 요청이 왔고, 수정 후 18회 모두 왔다. 사용자가 화면에서 확인했다. 상세: [`loading-stall-analysis.md`](loading-stall-analysis.md) |

**설계서에 남은 옛 내용 (감점 대상)**: 코드는 고치지 않고 설계서만 고쳤습니다. 10건 모두 2026-11-05에 수정을 마쳤습니다.

| # | 카테고리 | 설계 위치 | 갭 내용 | 코드 근거 | 우선순위 |
|---|----------|----------|--------|----------|---------|
| D1 | F | §2.7 666-667행 | "정렬 기준이 날짜뿐", "시각까지는 필요 없다"가 남음. 6행의 새 결정과 반대임 | `recruitFilter.ts:86-92,109` | P1 |
| D2 | F | §2.8.1 757행, §1.2 51행 | `filterBySource(..., sources)`에 `expandSourceFilter`가 없음 | `notificationService.ts:75` | P1 |
| D3 | S | §2.10 B 1423행 | `formatRegionList.ts`가 "`CityEn[]` 인자 유지"로 남음. `regionSelectMenus.ts`의 그룹 메뉴 입력 변경도 없음 | `formatRegionList.ts:23`, `regionSelectMenus.ts:49-51` | P1 |
| D4 | S | §2.10 A-15 1398행, 1425행, D 표, E 1478행, §1.1 31행 | 아래 상세 참고 | 아래 참고 | P1 |
| D5 | C | §2.9.7 1341행 | 지역 필드가 `selectedRegionContent(selectedValues(sub.regions))`로 남음 | `subscribeManageEmbed.ts:18` | P1 |
| D6 | C | §2.9.1 1077, 1088행, §2.9.3 1174행 | `regionSummary` 입력이 `regions` 필터로 남음 | `subscriptionSummary.ts:18-21`, `notificationMessageEmbed.ts:32` | P2 |
| D7 | C | §2.9 입력 계약 1058, 1063-1064행, §2.4 269, 271, 297행 | 삭제된 구독 메뉴 기준 설명과 옛 지역 라벨 설명이 남음 | `sourceToggle.ts:39-69` | P2 |
| D8 | F | §2.9.2 1132, 1138행, §6.1 5번 1664행 | 간단히 모드가 한 줄 모양으로 남음 | `recruitList.ts:70`, `recruitList.test.ts:79-93,176-183` | P2 |
| D9 | S | §6.2 1686, 1693행, §2.6 508행 | "엘리아스 권역"은 코드에서 `elias 지역`임. "시작 날짜 최신순"은 시각 비교 결정과 다름. 공고별 개수 제한, 보이는 지역만 초기화, 뒤로 버튼 3곳의 검증 행이 없음 | `city.ts:149`, `recruitFilter.ts:92-120` | P2 |
| D10 | S | §4 1628행, §6.1 1650행 | 테스트가 11종으로 남고 추가 3종이 표에 없음 | `sourceToggle.test.ts`, `onRegionGroupSelect.test.ts`, `disableMessageComponents.test.ts` | P2 |

D4 상세:

- §2.10 A-15: `subscribeRemove`가 `selectedValues(sub.regions)`를 쓴다고 적혀 있다. 코드는 `subscribeRemove.ts:37`의 `activeRegions(sub)`다.
- 1425행: `subscribeClear`가 바뀌지 않는다고 적혀 있다. 코드는 `subscribeClear.ts:34-38`로 바뀌었다.
- E 1478행: `regionSelectMenus.ts`의 변경을 주석만으로 적었다.
- D 표에 없는 파일: `subscribeAdd.ts`, `subscribeClear.ts`, `subscribeRemove.ts`, `onRegionGroupSelect.ts`, `onRegionCitySelect.ts`, `regionSelectMenus.ts`, `formatRegionList.ts`, `disableMessageComponents.ts`, `alertRegionEditButtons.ts`. `subscriptionSummary.ts` 행에는 `sourceDescriptions`가 빠졌다.
- §1.1 31행: "사이트 선택 메뉴"가 그대로 있다.

**감점하지 않은 차이 (허용)**

| # | 설계 내용 | 실제 구현 | 판단 |
|---|----------|----------|------|
| 1 | §2.8.2 807-811행, §2.8.4 1011-1014행은 `Promise.allSettled`를 직접 씀 | `syncAllSources()`로 묶고 실패 사유를 로그에 남김 (`recruitService.ts:134-149`) | 허용 |
| 2 | §2.8.4 1019행 `.catch(() => null)` | 경고 로그를 남기고 null (`recruitService.ts:118-121`) | 허용 |
| 3 | §2.8.2 922행 `ready` 코드 | 실패하면 `readyPromise`를 비움 (`app/scheduler.ts:25-31`) | 허용 |
| 4 | §2.2 `getAllActiveSubscribers` "유지" | 읽지 못한 문서를 건너뜀 (`subscription.ts:222-236`) | 허용 |
| 5 | §2.9.7 1359행 잠금과 복원 순서 | `withDisabledComponents` 하나로 처리 (`disableMessageComponents.ts:59-80`) | 허용 |
| 6 | §2.9.5 함수 목록 | `activeToggles`, `activeRegionsByToggle`, `findRegionToggle`, `isToggleFull`, `regionGroupMenuContent`, `regionCityMenuContent`, `sourceDescriptions`, 뒤로 버튼 함수 2개, `renderNoSubscription` 추가 | 허용 |
| 7 | §2.9.5에 없는 예외 | 켜진 묶음이 없는 문서는 묶음 전체를 씀 (`sourceToggle.ts:130-134`) | 허용 |
| 8 | §2.9.7 1357-1358행 `notice?` 인자 | 인자는 있지만 넘기는 호출부가 없음 | 허용 |
| 9 | §2.9.5 1287행 `선택된 지역 없음` 경고 | 설정 화면은 `⚠️ 선택된 지역이 없어 알림이 발송되지 않아요.` (`formatRegionList.ts:28`) | 허용 |
| 10 | §2.9.5 1289행 제한 문구 | 끝에 마침표가 있음 (`onRegionCitySelect.ts:43`) | 허용 |
| 11 | §2.1·§2.11은 `AlarmFilter`·`EliasRecruit` export만 적음 | `RecruitDisplay`·`DisplayField`도 export | 허용 |
| 12 | §2.8.2·§2.8.4는 옵션 값을 두 곳에 직접 적음 | `FRESH_SYNC_OPTIONS` 상수 | 허용 |
| 13 | §2.8.0 `notifiedStore`를 `RedisManager.store`에 등록 | 속성 이름 `store.notified` | 허용 |
| 14 | §6.1은 `test/mocks/multiSource.ts`만 적음 | `test/harness.ts`, `test/mocks/memoryStores.ts` 추가 | 허용 |
| 15 | §2.5 "생성기는 그대로 옮긴다" | sria `postedAt`은 값이 있을 때만 넣음 | 허용 |

---

## 4. 코드 품질 분석 (Code Analyzer)

이전 분석의 W1~W7은 2026-11-02에 수정을 마쳤습니다. 이번 지적은 번호가 겹치지 않도록 W8부터 씁니다. 이전 🟢 항목 가운데 I2·I3은 대상 파일이 삭제되어 없어졌고, 남은 항목은 번호를 유지합니다.

### 4.1 이슈 목록

| # | 심각도 | 카테고리 | 파일:라인 | 이슈 내용 | 제안 |
|---|--------|----------|----------|----------|------|
| W8 | 🟡 | 컨벤션(동작) | `events/listeners/selectMenus/onRegionRemoveSelect.ts:29-32`, `events/listeners/buttons/subscribeClear.ts:34-38`, `events/listeners/selectMenus/onRegionCitySelect.ts:31,49`, `features/alarmSubscribe/services/subscriptionService.ts:115-118` | 지역 모드가 ALL인 사용자가 지역 모드가 SELECTED일 때 열어 둔 옛 메시지의 메뉴나 초기화 버튼을 쓰면 SELECTED로 바뀐다. `selectedValues`가 ALL에서 `[]`를 돌려주고 `updateRegions`가 항상 SELECTED로 저장하기 때문이다. 제거·초기화는 `SELECTED + []`가 되어 알림이 0건이 되고, 추가는 전체 지역이 고른 지역 1개로 줄어든다. 저장해 둔 지역도 사라진다. dev는 `regions` 칸만 바꿔 모드가 유지됐으므로 이번 Phase에서 생긴 변화다. 코드로 확인했고 실행으로 재현하지는 않았다 | 수정 완료 (2026-11-05). `rerenderIfAllRegions`(`events/listeners/buttons/renderSubscribeManage.ts`)가 저장 대신 안내 문구와 함께 지역 화면을 다시 그린다. 저장하는 핸들러 3개와 추가·제거 메뉴를 여는 `subscribeAdd`·`subscribeRemove`가 먼저 부른다. 안내 문구: `지금은 모든 지역 알림을 받고 있어요. 지역을 고르려면 **🔀 모드 변경**을 눌러 주세요.` |
| W9 | 🟡 | 컨벤션(확장성) | `providers/recruit/sourceToggle.ts:8,60`, `providers/discord/builder/buttons/sourceToggleButtons.ts:10-13,34`, `events/handlers/buttons/sourceSelectHandlers.ts:8-9` | 고유 지역이 있는 사이트를 추가해도 컴파일이 통과한다. `source as SourceToggleKey`가 타입 검사를 막아 버튼 ID가 `undefined`가 되고, `setCustomId` 예외로 사이트 설정 화면이 열리지 않는다. 지금 사이트 구성에서는 나지 않는다 | 미룸 (2026-11-05 사용자 결정). 사이트를 추가할 때 `SourceConfig`에 `toggleKey`를 두어 형 변환을 없애고 처리 함수 맵을 `Record<SourceToggleKey, …>`로 선언한다. `.claude/docs/todo.md`의 `[사이트 추가]` |
| I1 | 🟢 | 컨벤션 | `services/notificationService.ts:160-162`, `services/recruitService.ts:202-204` | `finally`의 `releaseLock` 실패가 결과를 덮는다. 락은 만료로 풀린다 | 실패를 잡아 경고 로그만 남긴다 |
| I4 | 🟢 | 컨벤션 | `onShowSubscribeEnable.ts:14`, `renderSubscribeManage.ts:9`, `renderSubscribeSettingsHub.ts:11,32`, `subscribeRemove.ts:19`, `onRegionCitySelect.ts:15`, `onRegionRemoveSelect.ts:12` | 주석은 `deferUpdate`라고 하지만 코드는 `update()`로 버튼을 잠근다 | 주석을 실제 동작으로 고친다 |
| I5 | 🟢 | DRY | `services/notificationService.ts:179,183`, `services/recruitService.ts:52-53` | `RecruitCacheService`를 만드는 코드가 두 곳에 있다 | 한 함수를 함께 쓴다 |
| I6 | 🟢 | 컨벤션 | `providers/recruit/index.ts:22,26,35,52,60` | 스케줄 전용 설명과 삭제된 "구독 메뉴" 설명이 남았다 | 주석을 고친다 |
| I7 | 🟢 | 컨벤션 | `services/recruitService.ts:2-12` 외 | import 순서가 컨벤션 표와 다르다. lint는 통과한다 | 수정하는 김에 맞춘다 |
| I8 | 🟢 | 컨벤션 | `buttons/formatRegionList.ts:6-13,44-51` | `koToCityEn`, `KO_TO_CITY_EN`을 쓰는 곳이 없다. 남은 함수는 embed만 쓰는데 파일 위치와 이름이 맞지 않는다 | 두 항목을 지우고 파일을 옮긴다 |
| I9 | 🟢 | 컨벤션 | `sourceToggle.ts:153`, `disableMessageComponents.ts:28,38-43` | 파일 안에서만 쓰는 함수가 export되어 있고, `restoreMessageComponents`의 JSDoc이 옛 사용법을 설명한다 | export를 빼고 JSDoc을 줄인다 |
| I10 | 🟢 | 성능(경쟁 조건) | `onRegionCitySelect.ts:23,49`, `onRegionRemoveSelect.ts:21,29`, `subscribeClear.ts:28,35` | 지역 저장이 읽은 뒤 전체를 덮어쓴다. 두 메시지에서 동시에 추가하면 한쪽 지역이 사라진다. 공고별 제한은 넘지 않는다 | 필요해지면 Firestore 트랜잭션으로 묶는다 |
| I11 | 🟢 | 컨벤션(UX) | `sourceToggle.ts:142-144`, `onRegionCitySelect.ts:41-47` | 한 공고만 꽉 차면 그 공고의 권역이 메뉴에 남아 2단계까지 고른 뒤 거절된다. 저장값은 안전하다 | `subscribeAdd`에서 꽉 찬 묶음의 권역을 뺀다 |
| I12 | 🟢 | DRY | `sourceToggle.ts:98-99,132`, `subscriptionSummary.ts:38-39`, `sourceToggleButtons.ts:27-28` | "켜진 묶음 구하기"가 네 곳에 있다 | `onToggles(filter)`로 모은다 |
| I13 | 🟢 | 컨벤션 | `providers/discord/builder/buttons/` 8개 파일 | `features`를 import한다. 레이어 표와 `features/claude.md`의 설명이 서로 다르다. 이번에 늘어난 것은 `sourceToggleButtons.ts` 1개다 | 두 문서를 맞추거나 상수를 `common/constants`로 옮긴다 |
| I14 | 🟢 | 컨벤션 | `slashCommand.ts:2`, `regionSelectMenus.ts:98,100`, `subscribeRemove.ts:31`, `onEnableSelectedRegionAlert.ts:35`, `onRegionCitySelect.ts:16,25`, `onRegionRemoveSelect.ts:23`, `onRegionGroupSelect.ts:14`, `disableMessageComponents.ts:20,23` | 오래된 주석과 문서를 봐야 뜻을 아는 주석이 있다 | 뜻을 풀어 쓰거나 지운다 |
| I15 | 🟢 | 컨벤션 | `onRegionCitySelect.ts:41-47`, `subscribeClear.ts:34-38` | 제한 거절 경로, 초기화의 꺼진 공고 지역 보존, W8 경로를 검증하는 핸들러 테스트가 없다 | 수정 완료 (2026-11-05). `events/listeners/selectMenus/__test__/regionSave.test.ts` 9건 |

### 4.2 컨벤션 준수

| 항목 | 상태 | 비고 |
|------|------|------|
| SystemLogger 사용 | ✅ | 대상 파일에 `console.*`가 없다 |
| SystemError 패턴 | ✅ | 핸들러는 예외를 그대로 던지고 서비스가 `SystemError`로 감싼다 |
| 네이밍 규칙 | ✅ (일부 예외) | `formatRegionList.ts`만 내용과 이름이 맞지 않는다(I8) |
| import 정리 | ❌ (일부) | I7, I13 참고. lint는 통과한다 |

추가로 확인한 항목입니다.

| 항목 | 상태 | 비고 |
|------|------|------|
| public API JSDoc | ✅ | 새 export에 모두 있다. 문구가 오래된 곳은 I9, I14 |
| 순환 참조 | ✅ | 이번 변경 경로에 순환이 없다. 전체의 순환 2개는 대상 파일과 무관하고 dev에도 있다 |
| 켜진 묶음이 없는 옛 문서 | ✅ | 편집이 막히지 않고, 알림 0건과 요약 문구 "받을 공고 없음"이 일치한다 |
| 마지막 묶음 끄기 | ✅ | 오래된 메시지에서 눌러도 저장되지 않는다 |
| 삭제 기능 잔재 | ✅ | `functions/src`에 없다 |

### 4.3 요약

- 🔴 Critical: 0건
- 🟡 Warning: 2건 (W8 수정 완료, W9 미룸)
- 🟢 Info: 13건 (I15 수정 완료, 12건 남음)

---

## 5. 다음 단계 분기

✅ **매치율 90% 이상, 🔴 Critical 0건** → `/pdca report 1.15` 진행 가능

2026-11-05 사용자 결정에 따라 report 전에 다음을 처리했습니다.

- W8 수정: 지역 모드가 ALL이면 옛 메시지에서 지역 메뉴를 열거나 저장하지 않는다. 설계서 §2.9.5에도 적었다.
- D1~D10 설계서 수정, Gap Detector 재분석에서 나온 F39·S28 처리: 매치율 100%.
- W9: 사이트 추가 때 처리하도록 todo로 넘겼다.
- 수정 뒤 build, lint, 테스트 19종(15종 + 기존 4종)이 통과했다.

남은 🟢 12건은 동작 위험이 없어 report에 남은 항목으로 적습니다.

---

## 6. 런타임 검증

### 6.1 통과 (2026-11-03 사용자 확인)

C-1~C-7은 격리 환경에서 실행한 자동 검증으로 38건 모두 통과했습니다. 외부 연결 시도는 0건입니다.

| 묶음 | 건수 | 내용 |
|------|------|------|
| C-1 | 5 | 첫 실행 저장, 변경 없을 때 DM 0건, 조건 맞는 구독자만 발송 |
| C-2 | 10 | 종료 전환, 정렬, elias 공고, 공고 추가, 한 통으로 묶기, 시간 경과만으로는 변경 없음 |
| C-3 | 6 | 동시 실행, 0건 처리, 사이트 실패, 실패 뒤 복구 |
| C-4 | 7 | 옛 형식 문서, 깨진 문서, 구독자별 오류 격리 |
| C-5 | 7 | 구독 문서 저장과 모드 전환, 지역 복원 |
| C-7 | 2 | 로컬 Redis 저장, 빈 목록 표시 |
| 격리 | 1 | 외부 연결 0건 |

- 실제 진입점 실행: 1회차 작업 3개 완료, 2회차 DM 0건, 동시 2개 실행은 락으로 건너뜀, 초기화 실패 뒤 재시도 확인. DM은 스텁으로 받아 실제 발송은 없었습니다.
- build, lint, 테스트 19종이 통과했습니다.
- 2026-11-05 변경 2건은 2026-11-06에 사용자가 Discord에서 확인했습니다. 첫 구독은 일반 공고만 켜지고 지역 메뉴에 elias 지역이 없었습니다. 옛 메시지에서 [➖ 제거]를 누르면 저장 없이 안내 문구와 함께 전체 지역 화면으로 다시 그려졌습니다. [➕ 추가]·[🧹 초기화]는 단위 테스트로 확인했습니다.
- Discord 화면과 버튼 흐름, 실제 DM 모양은 사용자가 직접 확인했습니다.

### 6.2 미확인 (점수 제외)

| 항목 | 설계 절 | 이유 |
|------|---------|------|
| 배포 뒤 Cloud Scheduler 작업 3개 | §2.8.2 | 배포 단계로 넘겼다(2026-11-03). 에뮬레이터는 3개 정의를 읽는 것까지 확인했다. 확인 방법은 `.claude/docs/todo.md`의 `[배포 후 확인]` |
| Upstash `multi()` 동작 | §2.8.2, §6.2 | 배포 단계로 넘겼다(2026-11-03). 로컬 Redis 저장은 확인했다. 확인 방법은 `.claude/docs/todo.md`의 `[배포 후 확인]` |

---

*분석일: 2026-11-03 · 수정일: 2026-11-06*
*참고: docs/phase-1-15/02-design.md*
