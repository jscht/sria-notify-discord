# Phase 1.15 구현 이어가기

> **이 문서는**: 구현(do) 단계 진입 직전 상태와 CTO 위임안을 적은 인수인계 문서입니다. 다음 세션은 이 문서를 먼저 읽습니다.
> **기준 시점**: 2026-11-01

## 1. 지금 위치

```
✅ plan → ✅ design(검증 2회) → ⏳ do 승인 대기 → ⬜ analyze
```

- 브랜치: `feature/phase-1.15-source-subscription`
- `pdca-memory.json`의 `phase`는 아직 `design`입니다. 구현을 끝낸 뒤 `do`로 바꿉니다.
- 코드는 아직 고치지 않았습니다.
- 커밋하지 않은 파일: `docs/phase-1-15/`(미추적), `.claude/docs/pdca-status.json`, `.claude/docs/pdca-memory.json`, `.claude/docs/todo.md`, `.claude/phases/phase-source-subscription.md`
- `docs/user-memo.md`는 사용자의 메모 파일입니다. 지시가 없으면 건드리지 않습니다.

설계는 사용자가 구현 진행을 승인했습니다("확인필요 1 ok, 구현 진행"). 설계 결정을 다시 논의하지 않습니다.

## 2. 다음 세션에서 할 일

1. 사용자에게 아래 **승인 요청 3개**를 받습니다. 이 위임안은 아직 승인되지 않았습니다.
2. 승인되면 3절 순서대로 도메인 에이전트를 호출합니다. 위임안 승인이 호출 승인을 겸하며, 다시 CTO Lead를 부를 필요는 없습니다.
3. 구현이 끝나면 `pdca-memory.json`의 `phase`를 `do`로 바꾸고 `/pdca analyze 1.15`를 안내합니다.

### 승인 요청

| # | 내용 | 추천 |
|---|------|------|
| 1 | 위임안대로 진행할지 (y / 수정 / 거부) | 진행 |
| 2 | 1단계 뒤 이름 변경만 중간 커밋할지 | 커밋합니다. 이름 변경과 기능 변경이 나뉘어 검토가 쉽고 되돌릴 지점이 생깁니다. `docs/phase-1-15/`와 PDCA 상태 파일도 별도 커밋합니다. 지금은 미추적이라 사라지면 복구할 수 없습니다 |
| 3 | `functions/scripts/verify-phase-1-4.ts` 처리 | 이번에는 고치지 않고 `todo.md`에 기록합니다. 3단계 뒤 동작하지 않지만 빌드 대상이 아니고, 고쳐도 런타임 검증 없이는 확인할 수 없습니다. `:111`이 삭제될 `store.updateAlertMode`를 씁니다 |

커밋 규칙: `.claude/rules/git-workflow.md`를 따릅니다. `Co-Authored-By`, "Generated with Claude Code", Claude 세션 링크를 넣지 않습니다.

## 3. CTO 위임안

경로는 별도 표시가 없으면 `functions/src/` 기준입니다. 단계 번호는 `02-design.md` §4입니다.

### 위임 계획

| 영역 | 위임 대상 | §4 단계 | 설계 근거 | 예상 산출물 |
|------|----------|---------|------|-------------|
| 소스 이름 변경 | Integration Lead | 1 | §2.11 | temp → elias, 빌드 통과 |
| 구독·공고 타입 | Integration Lead | 2 | §2.1, §2.5, §2.6 | `AlarmFilter`, `RecruitDisplay`, `EliasRecruit`, `selectedValues` |
| 구독 저장 형식 | Backend Expert | 3 | §2.2, §2.10 A-4 | 옛 문서 읽기 변환, 필터 단위 쓰기 메서드 |
| 구독 서비스 | Integration Lead | 4 | §2.3, §2.10 A-5 | `updateSources`, 기존 메서드 전환 |
| 공고 생성·표시 정보 | Integration Lead | 5, 6 | §2.4~§2.6 | elias 규칙, `postedBy`, `SOURCE_CONFIGS`, `toDisplay()` |
| 필터·정렬·비교값 | Integration Lead | 7 | §2.7, §2.8.2 | 소스 필터, 정렬 함수, `recruitHash.ts` |
| 사이트 갱신·공고 조회 경로 | Integration Lead | 8 | §2.8.0, §2.8.2, §2.8.4, §2.12 | `syncRecruits` 옵션, 0건 처리, 10분 제한 제거 |
| 알림 스케줄러·발송 | Integration Lead | 9 | §2.8 | `runNotification`, `notifiedHashStore`, `SCHEDULED_JOBS` |
| Discord UI | Discord Agent | 10, 11, 12 | §2.9, §2.10 A-9~17·D | 요약 문구, 공고 목록·embed, 사이트 메뉴, 설정 관리 화면, 첫 구독 흐름 |
| 테스트 | Integration Lead / Discord Agent | 13 | §6.1 | Integration Lead 10종(5번 제외), Discord Agent 1종(5번) |
| 빌드·lint 확인 | 메인 세션 | 14 중 일부 | | `npm run build`, `npm run lint` 결과 |
| 문서 갱신 | Integration Lead | 15 | §2.10 C, §2.11 | 계층별 `claude.md`, `ARCHITECTURE.md`, `build-deploy.md`, `README.md`, phase 문서 |

- Frontend Architect는 호출하지 않습니다. 화면 구조와 문구가 §2.9에 정해져 있습니다.
- AI Agent는 호출하지 않습니다. `ai/interpreter.ts`는 컴파일 확인만 합니다(§2.10 A-18).
- Backend Expert는 병렬 순서를 관리하기 위해 메인 세션이 직접 호출합니다.

### 실행 순서

```
구간 A (차례)  실행1 Integration Lead: 1
               → 확인 1: npm run build 통과
               → 실행2 Integration Lead: 2
구간 B (병렬)  실행3 Backend Expert: 3   ‖  실행4 Integration Lead: 5 → 6 → 7
구간 C (병렬)  실행5 Integration Lead: 4 → 8 → 9   ‖  실행6 Discord Agent: 10 → 11 → 12
               → 확인 2: functions/lib 삭제 후 npm run build 전체 통과
구간 D (병렬)  실행7 Integration Lead: 테스트 10종  ‖  실행8 Discord Agent: 테스트 5번
구간 E (차례)  메인 세션: 14 (build·lint)
               → 실행9 Integration Lead: 15
```

- 구간 A는 차례로 합니다. 1단계는 여러 영역의 파일을 고치고, 2단계 타입은 이후 모든 단계의 입력입니다.
- 구간 B와 C의 두 실행은 같은 파일을 고치지 않습니다.
- 5~7단계는 에이전트 호출 비용을 줄이려고 한 번에 묶습니다.

### 같은 파일을 고치는 지점

| 파일 | 고치는 단계 | 순서를 지키는 방법 |
|------|-----------|-------------------|
| `common/types/recruit.d.ts`, `common/types/index.ts` | 1 → 2 | 구간 A 안에서 차례 |
| `providers/recruit/index.ts`, `providers/recruit/sria/sriaPostings.ts` | 1 → 6 | 구간이 다름 |
| `providers/recruit/elias/*` | 1 → 5 | 구간이 다름 |
| `app/scheduler.ts`, `schedulers/utils/initializeSchedulers.ts` | 1 → 9 | 구간이 다름 |
| `providers/discord/builder/embeds/jobLink.ts` | 1 → 11 | 구간이 다름 |
| `providers/discord/builder/selectMenus/regionSelectMenus.ts` | 5 | 주석만 고침. Discord Agent는 이 파일을 고치지 않음 |
| `providers/redis/manager/redisManager.ts`, `providers/redis/key/recruitKeyManager.ts` | 8 → 9 | 같은 실행 안에서 차례 |
| `events/bus/handlers/NotificationSendHandler.ts` | 9 | Integration Lead만 고침. §2.9.3에도 적혀 있지만 Discord Agent는 고치지 않음 |

### 병렬 구간 운영 규칙

- 모두 같은 작업 폴더에서 합니다. `isolation: worktree`는 쓸 수 없습니다. 앞 단계 결과는 커밋 전이고 `docs/phase-1-15/`는 미추적이라, 새 작업 폴더에는 앞 단계 결과와 설계서가 없습니다.
- 구간 안에서는 `npm run build`를 쓰지 않습니다. `cd functions && npx tsc -p tsconfig.build.json --noEmit`의 결과를 자기 파일로 걸러 봅니다.
- 구간 C에서 남아도 되는 컴파일 오류는 아래 두 가지뿐입니다. 나머지는 해당 담당이 해결합니다.
  - `NotificationSendHandler.ts`가 embed를 부르는 인자 (11단계에서 해소, 계약 §2.9.3)
  - Discord 쪽의 `updateSources` 호출 (4단계에서 해소, 계약 §2.3)
- 확인 2의 오류는 파일 담당에게 돌려보냅니다. 함수 모양은 설계서 기준이며 임의로 바꾸지 않습니다.

## 4. 구현 가이드

### 사전 준비

```bash
cd functions
npm install
```

- 작업 위치는 `functions/`, 설계서는 `docs/phase-1-15/02-design.md`입니다.
- 명령은 Git Bash에서 실행합니다.
- 줄바꿈은 신경 쓰지 않아도 됩니다. `linebreak-style`이 꺼져 있고 `core.autocrlf=true`입니다.

### 모든 에이전트에 전달할 규칙

- 커밋하지 않습니다. 1단계 파일 이름 변경의 `git mv`만 허용합니다.
- 설계서, `pdca-status.json`, `pdca-memory.json`을 고치지 않습니다.
- 맡은 파일만 고칩니다. 다른 담당 파일의 문제는 보고만 합니다.
- 설계서와 코드가 맞지 않으면 추측하지 말고 멈춰서 보고합니다.
- 끝나면 바꾼 파일, 끝낸 단계, 남은 컴파일 오류, 설계와 다른 점을 보고합니다.
- 실행이 중간에 끊기면 작업 트리 상태를 기준으로 끝나지 않은 단계부터 새로 호출합니다.

### 단계별 확인

"빠지기 쉬운 것"은 §4 표의 파일 목록에 더해 챙길 항목입니다.

| 단계 | 담당 | 읽을 절 | 빠지기 쉬운 것 | 끝났을 때 확인 |
|------|------|--------|---------------------|---------------|
| 1 | Integration Lead | §2.11 | 동작은 바꾸지 않습니다. `sriaPostings.ts:7`의 `temp와`는 `\btemp\b` 검색에 걸리지 않습니다 | `npm run build` 통과, `functions/src`에 소스 이름 temp 없음 |
| 2 | Integration Lead | §2.1, §2.5, §2.6 | `RecruitBase`에 `postedAt?`도 넣고, `EventBus.test.ts:44-52`에 `postedBy`를 넣습니다 | 타입 파일 자체에 오류 없음 |
| 3 | Backend Expert | §2.2 | `updateRegionMode`의 옛·새 형식 분기, `toStoredFilter`, 쓰기 로그 항목 교체 | 메서드 표와 일치, 이 파일 오류 0 |
| 4 | Integration Lead | §2.3 | `updateSources`는 0개 검증 뒤 `ensureExists`를 거칩니다 | 이 파일 오류 0 |
| 5 | Integration Lead | §2.6 | 줄 선택을 제거·만료 판정보다 먼저 합니다. `firstHitTick`, `formatKst`, `cityName.ts:62` 정규식, `regionSelectMenus.ts:9-10` 주석 | elias 파일 오류 0 |
| 6 | Integration Lead | §2.4, §2.5 | `postedAt?`를 `SriaSeed`에 추가합니다. `trimDate`의 embed 쪽 삭제는 11단계입니다 | `toDisplay`, `getUserFacingSources` 사용 가능 |
| 7 | Integration Lead | §2.7, §2.8.2 | `filterVisibleSources`·`filterBySource` 추가, `filterByRegion` 입력 변경, `filterByMode` 삭제 | `common/utils` 오류 0 |
| 8 | Integration Lead | §2.8.0, §2.8.2, §2.8.4, §2.12 | `RecruitService` 생성자 객체 주입, 마지막 갱신 시각은 락을 풀기 전에 저장, `store/index.ts`·`key/index.ts`·`constants/serviceName.ts` 등록 해제 | 삭제 대상 참조 없음 |
| 9 | Integration Lead | §2.8 | `getNotificationService()`, `redisManager.ts`에 `notifiedStore` 등록, `ready` 지연 시작, `EventBus.ts:105`·`NotificationSendHandler.ts:15` 주석 | 허용 오류 외 0 |
| 10 | Discord Agent | §2.9.1, §2.10 | A-9, A-12~15. `subscriptionSummary.ts`를 먼저 만듭니다 | 이 묶음 오류 0 |
| 11 | Discord Agent | §2.9.2~§2.9.4 | `recruitField` 삭제, `trimDate` 삭제, `ENV.SRIA_URL` 삭제, 0건 문구의 `region ?? "전체"` | `recruitList.ts` 외 embed에서 공고 타입을 읽지 않음 |
| 12 | Discord Agent | §2.9.5~§2.9.8, §2.10 D | `fullActionId.ts` 등록 필수. 명시 export 목록인 `features/alarmSubscribe/index.ts`는 §2.10 D에 없으니 그 경로로 가져오면 함께 추가합니다 | 허용 오류 외 0, 확인 2 통과 |
| 13 | Integration Lead, Discord Agent | §6.1 | `test/mocks/multiSource.ts`를 먼저 만듭니다. `providers/recruit`를 불러오는 테스트는 첫 줄에 `import "dotenv/config"`를 둡니다 | 11종 모두 종료 코드 0 |
| 14 | 메인 세션 | §6.2 | build·lint만 합니다 | 둘 다 오류 0 |
| 15 | Integration Lead | §2.10 C, §2.11 | 실제 파일 이름은 소문자 `claude.md`입니다. `writing-style.md`를 따릅니다 | 옛 이름 `recruitSchedule_temp`·`TempRecruit` 없음 |

- 확인 2 전에 `functions/lib`를 지웁니다. `tsc`는 옛 출력을 지우지 않아 `lib/providers/recruit/temp`가 남고, 테스트는 `lib`에서 실행하기 때문입니다. `lib`는 git에서 제외된 빌드 결과입니다.
- 테스트 실행: `cd functions && npm run build && node lib/<경로>.test.js`
- 테스트가 구현 오류를 찾으면 그 파일 담당이 고칩니다.

### 컨벤션 확인

- `SystemLogger` 사용, `console.log` 없음 (기존 `__test__` 출력은 예외)
- `SystemError` 패턴 준수
- camelCase·PascalCase 이름 규칙
- public API의 JSDoc (§5 목록)
- `common`은 `providers`를 import하지 않음
- Firestore 쓰기에 `undefined` 없음

## 5. 리스크

- **되돌릴 지점**: 2~12단계는 커밋 없이 진행합니다. 구간 B·C에서 잘못되면 되돌리기 어렵습니다. 승인 요청 2번이 이 위험을 줄입니다.
- **8·9단계 작업량**: 한 실행에 몰려 있습니다. 끊기면 남은 단계부터 새로 호출합니다.
- **구현 후 미확인 항목**: 아래는 런타임 검증에서 확인합니다.
  - 로컬 2회 실행과 Discord UI 수동 확인
  - Firebase 에뮬레이터의 함수 3개 등록
  - Upstash의 `multi()` 동작 (이번이 코드베이스 첫 사용)
  - 런타임 검증 전에는 §2.11의 로컬 Redis 키 삭제가 필요합니다.

## 6. 구현 뒤 남은 작업

- `scheduling-guide.md`의 구현 전 문구를 지웁니다: 머리말 상태 문구, 용어의 temp 이름 변경 설명, "지금 코드는 4시간", "이번 작업에서 바꾸지 않습니다".
- `scheduling-guide.md`를 영구 위치로 옮기고 `.claude/docs/ARCHITECTURE.md:130-138`, 필요하면 `document-structure.md`를 고칩니다. 사용자가 핵심 구조 문서로 두기를 원합니다.
- 설계서 §2.8.2 "운영 배포 확인" 순서를 따릅니다.
- 범위 밖으로 확인한 차이: `onSchedule`에 지역 지정이 없는데 `build-deploy.md:40`은 `asia-northeast3`로 적혀 있습니다.
- 이 문서는 구현이 끝나면 지웁니다.

---

*작성: 2026-11-01*
