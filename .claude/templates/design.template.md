# Phase {{X.Y}} 설계서: {{feature-name}}

**상태**: 🔄 진행 중
**기반 문서**: `docs/01-plan/phases/phase-{{X}}-{{Y}}.plan.md`

---

## 1. 아키텍처 설계

### 1.1 레이어 매핑

| 프로젝트 레이어 | 변경 내용 |
|----------------|----------|
| Routes (`functions/src/routes/`) | |
| Services (`functions/src/services/`) | |
| EventBus (`functions/src/eventBus/`) | |
| Common Utils (`functions/src/common/`) | |
| Types (`functions/src/types/`) | |

### 1.2 컴포넌트 다이어그램
<!-- 텍스트 기반 구조도 -->
```
[Component A] → [Component B] → [Component C]
                      ↓
                [EventBus]
```

---

## 2. 상세 설계

### 2.1 {{Section Name}}

**파일**: `functions/src/...`

**인터페이스/타입 정의**:
```typescript
// 타입 정의
```

**핵심 로직**:
```typescript
// 구현 스케치 (pseudo-code)
```

**에러 처리**:
- SystemError 팩토리 메서드 사용
- EventBus를 통한 에러 이벤트 발행

### 2.2 {{Section Name}}
<!-- 필요한 만큼 섹션 추가 -->

---

## 3. 데이터 설계

### 3.1 Firestore 컬렉션/문서 구조
<!-- 해당하는 경우 -->

| 컬렉션 | 문서 구조 | 용도 |
|--------|----------|------|
| | | |

### 3.2 이벤트 페이로드
<!-- EventBus 이벤트 사용 시 -->

| 이벤트 타입 | 페이로드 | 발행 시점 |
|------------|---------|----------|
| | | |

---

## 4. 구현 순서

| 순서 | 작업 | 파일 | 설계 섹션 참조 |
|------|------|------|--------------|
| 1 | | | §2.1 |
| 2 | | | §2.2 |
| 3 | | | |

---

## 5. 코딩 컨벤션 체크리스트

- [ ] camelCase 변수/함수, PascalCase 클래스/인터페이스/타입
- [ ] SystemLogger 사용 (console.log 금지)
- [ ] SystemError 패턴 준수
- [ ] EventBus 타입 안전 이벤트 (제네릭)
- [ ] JSDoc 주석 (public API)
- [ ] 한국어 주석 (필요 시)

---

## 6. 테스트 계획
<!-- Phase 3 테스트 프레임워크 도입 전: 수동 검증 항목 -->

| 검증 항목 | 방법 | 기대 결과 |
|----------|------|----------|
| | TypeScript 컴파일 | 에러 없음 |
| | 수동 실행 | 정상 동작 |

---

*작성일: {{date}}*
*참고: phase-{{X}}-{{Y}}.plan.md*
