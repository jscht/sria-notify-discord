# Phase 4: AI 자연어 처리 구현

> Hugging Face 기반 자연어 의도 분석

**현재 진행률**: 0% (0/6 완료)

---

## 📊 Sub-Phase 진행 상황

| Sub-Phase | 작업명 | 완료 | 진행 중 | 대기 중 |
|-----------|--------|------|---------|---------|
| Phase 4.1 | AI Provider 설정 | 0 | 0 | 3 |
| Phase 4.2 | AI NLP 캐시 | 0 | 0 | 2 |
| Phase 4.3 | AI NLP 서비스 | 0 | 0 | 4 |
| Phase 4.4 | Discord 자연어 처리 | 0 | 0 | 3 |
| Phase 4.5 | Rate Limit 관리 | 0 | 0 | 2 |
| Phase 4.6 | AI 테스트 최적화 | 0 | 0 | 3 |

---

## Phase 4.1: AI Provider 설정 (1-2시간)
**우선순위**: ⭐⭐
**의존성**: 없음

- [ ] Hugging Face 라이브러리 설치
  ```bash
  npm install @huggingface/inference
  ```

- [ ] `providers/ai/huggingface/client.ts` 작성
  - [ ] HfInference 클라이언트 초기화
  - [ ] API 토큰 환경 변수 설정 (HUGGINGFACE_API_KEY)
  - [ ] Rate Limit 처리

- [ ] `providers/ai/huggingface/models.ts` 모델 설정
  - [ ] 무료 모델 선택: `facebook/bart-large-mnli` (Zero-shot classification)
  - [ ] Fallback 모델: `google/flan-t5-base`

**완료 기준**:
- [ ] Hugging Face API 클라이언트 정상 초기화
- [ ] 무료 모델 호출 성공

---

## Phase 4.2: AI NLP 캐시 구현 (1-2시간)
**우선순위**: ⭐⭐
**의존성**: Firebase Admin SDK 설정 완료

- [ ] Firestore 스키마 설계
  - [ ] `ai_nlp_cache/{cacheId}` 구조 정의
  - [ ] 만료 시간 설정 (7일 TTL)

- [ ] `providers/firebase/store/aiCache.ts` 작성
  - [ ] `getIntentCache(message)` 캐시 조회
  - [ ] `saveIntentCache(message, intent)` 캐시 저장

**완료 기준**:
- [ ] Firestore에 NLP 의도 분석 결과 캐시 저장 가능
- [ ] 캐시 조회 성공

---

## Phase 4.3: AI NLP 서비스 구현 (2-3시간)
**우선순위**: ⭐⭐
**의존성**: Phase 4.1, 4.2 완료

- [ ] `services/aiService.ts` 생성
  - [ ] `parseUserIntent(message)` 메서드 - 자연어 의도 분석
  - [ ] 캐시 우선 조회 로직
  - [ ] Hugging Face Zero-shot Classification 호출
  - [ ] 지역 추출 로직 (extractRegion, extractRegions)

- [ ] 에러 처리
  - [ ] API 한도 초과 처리
  - [ ] Fallback 응답 처리

**완료 기준**:
- [ ] "서울에서 단기 알바 구해줘" → { action: 'recruit', region: '서울' }
- [ ] "경기도 공고만 받을래" → { action: 'subscribe', regions: ['경기'] }
- [ ] 캐시 활용 확인

---

## Phase 4.4: 기존 Features에 자연어 처리 통합 (2시간)
**우선순위**: ⭐⭐
**의존성**: Phase 4.3 완료

- [ ] `features/recruitRequest/handlers/messageHandler.ts` 작성
  - [ ] Discord 메시지 이벤트 리스너 등록
  - [ ] aiService.parseUserIntent() 호출
  - [ ] intent.action === 'recruit'일 때 공고 조회 실행
  - [ ] 지역 필터링 적용 (intent.region)

- [ ] `features/alarmSubscribe/handlers/messageHandler.ts` 작성
  - [ ] Discord 메시지 이벤트 리스너 등록
  - [ ] aiService.parseUserIntent() 호출
  - [ ] intent.action === 'subscribe'일 때 알림 설정 변경
  - [ ] intent.action === 'unsubscribe'일 때 알림 비활성화

**완료 기준**:
- [ ] "서울에서 단기 알바 구해줘" 입력 시 공고 조회 실행
- [ ] "경기도 공고만 받을래" 입력 시 알림 설정 변경
- [ ] Discord 메시지로 자연어 명령 처리

---

## Phase 4.5: Rate Limit 관리 (1-2시간)
**우선순위**: ⭐
**의존성**: Phase 4.1 완료

- [ ] `providers/ai/huggingface/rateLimiter.ts` 작성
  - [ ] Redis 기반 Rate Limit 추적
  - [ ] 분당 100회 제한 구현

**완료 기준**:
- [ ] Rate Limit 초과 시 대기
- [ ] 429 에러 재시도 동작

---

## Phase 4.6: AI 테스트 및 최적화 (1-2시간)
**우선순위**: ⭐
**의존성**: Phase 4.4 완료

- [ ] 의도 분석 품질 테스트
  - [ ] 다양한 자연어 패턴 테스트
  - [ ] 공고 조회, 알림 설정 명령 정확도 확인

- [ ] 캐시 효율성 측정
  - [ ] 캐시 히트율 70% 이상

- [ ] Rate Limit 테스트
  - [ ] 연속 요청 대기 동작 확인

**완료 기준**:
- [ ] 의도 분석 정확도 80% 이상
- [ ] 캐시 히트율 70% 이상
- [ ] Rate Limit 정상 동작

---

*최종 수정: 2026-01-07*
*상위 문서: [TODO.md](./TODO.md)*
