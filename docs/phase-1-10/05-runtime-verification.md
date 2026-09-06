# Phase 1.10 — 런타임 검증 목록 (0단계)

> 근거: 구현 코드(SoT) 기준 크롤 도식 노드에서 도출.
> 분류 — **(C)** Claude 실행·판정 가능(외부 부작용 없음) / **(U)** 사용자만 가능(봇 상시 기동·실 전송·과금 수반).
> 절차: 진입 시 `git add -A` 기준선 → (C)는 Claude 실행 후 통과 처리 전 사용자 확인 / (U)는 사용자 실행·결과 보고. 실패 항목은 `03-analysis.md` 갭 등재 → iterate.

## 전제조건 (충족됨 — 검증 아님)

- **P0** 빌드·타입 정합 `tsc --noEmit` / `npm run build` → ✅ exit 0 (`--single-process` 제거 반영 상태)

---

## 그룹 1 — 크롤 흐름 (도식 노드 매핑)

### (C) Claude 실행·판정 가능

| # | 노드 | 검증 내용 | 방법 |
|---|------|-----------|------|
| CF-C1 | `hasAvailableProxy` 게이트 | 풀 비면 크롤 중단 + `ProxyExhaustedError("no_available_proxy")` | 빈 풀로 호출 → throw 확인 |
| CF-C2 | `getAvailableProxy` checkout | 원자 checkout(used=true)·KR 우선·latency 최소, 경합 시 다음 후보 | Firestore 로컬/에뮬 경합 확인 |
| CF-C3 | 로테이션 실패교체 | `markProxyAsFailed`(available=false, failCount++) + 지수 백오프 후 다음 attempt(≤3) | dead 프록시 주입 → 교체·백오프 로그 |
| CF-C4 | 능동요청 503 격리 | 소진 시 요청자에게만 `ServiceUnavailable(503)` (전체 브로드캐스트 없음) | `getRecruitList` Step4 응답 확인 |
| CF-C5 | `SriaCrawler.crawl(proxy)` IP | 프록시 경유 IP ≠ 실 IP + geo(country) | `verifyProxy` 하니스 (실 프록시 1개 필요) |
| CF-C6 | WebRTC 차단 args | `disable_non_proxied_udp` + `WebRtcHideLocalIpsWithMdns` 반영, STUN 실 IP 미노출 | launch args 로그 + STUN 확인 |

### (U) 사용자만 가능

| # | 노드 | 검증 내용 | 이유 |
|---|------|-----------|------|
| CF-U1 | `getCookie` (프록시 context) | 쿠키 취득 단계에서 실 IP 미노출 (XSRF-TOKEN, dyms_career_session) | 실 saramin 접속 |
| CF-U2 | `isBlocked` / **gap1** | 200+빈목록 soft-block 실제 형태 관찰 → 교차 프록시/DOM 구분 규칙 확정 | 실 크롤 관찰 |
| CF-U3 | `--single-process` 제거 / **gap2** | 프록시 크롤 크래시 없이 완료 + 배포 메모리 한도 내 | 실 크롤·실 배포 |
| CF-U4 | `ProxyErrorHandler` 알림 | 구독자 전체 staleness DM(매 틱 지속) + 개발자 incident DM(SET NX 1회) 구분 | 봇 상시 기동·실 DM |
| CF-U5 | 성공 후처리 | `setLastRefreshedAt` as-of 갱신 + incident RESOLVED 로그(복구 DM 없음) | 실 파이프라인 |
| CF-U6 | RECRUIT_CHANGED → DM (**R4**) | DUMMY/실 신규 공고 → 구독자 실 DM 발송 | 봇 기동·실 전송 |

---

## 그룹 2 — 운영/배포 (크롤 노드 외)

| # | 항목 | 검증 내용 | 분류 |
|---|------|-----------|------|
| OP-U1 | R5 배포 트리거 | `onSchedule("every 4h")` 실배포 환경 실제 발화 + graceful shutdown | (U) |
| OP-U2 | DM 에러분기 | 50007 graceful skip / 429 대기·재시도 | (U) |
| OP-U3 | 부하 | 구독자 증가 시 처리량·타임아웃·429 지점, 순차 발송 블로킹 영향 | (U) |
| OP-U4 | 로그 | Cloud Logging 전 레벨 적재·심각도 매핑·핵심 이벤트 추적 | (U) |

---

## 별도 게이트 (실 CRAWL 활성화 전)

| # | 항목 | 검증 내용 | 분류 |
|---|------|-----------|------|
| G-U1 | B9 License/Compliance | 사람인 ToS/robots/개인정보 재확인 | (U) |
| G-U2 | 프록시 소스 실측 | 무료 풀 가용성, 부족 시 유료 게이트웨이 승급 판단 | (U) |

---

## 집계

- 전제조건: 1 (충족)
- (C) Claude 실행: 6 (CF-C1~C6)
- (U) 사용자 실행: 12 (CF-U1~U6, OP-U1~U4, G-U1~U2)

## 통과/실패 처리

- **전체 통과** → `/pdca report 1.10` (report "기능 테스트"를 실결과로 채움)
- **실패 발생** → 해당 항목 `03-analysis.md` 갭 등재 → `/pdca iterate 1.10` (정적 매치율과 무관하게 런타임 실패는 갭)
