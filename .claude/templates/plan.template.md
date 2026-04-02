# Phase {{X.Y}}: {{feature-name}}

**상태**: 🔄 진행 중
**우선순위**: {{priority}}
**의존성**: {{dependencies}}

---

## 개요

### 배경
<!-- 이 기능이 필요한 이유, 현재 문제점 -->

### 목표
<!-- 구현 후 기대하는 결과 -->

### 범위
<!-- 이 Phase에서 다루는 것과 다루지 않는 것 -->

| 포함 | 제외 |
|------|------|
| | |

---

## 요구사항

### 기능 요구사항
<!-- phase-X-core.md의 해당 Phase 항목을 시드로 상세화 -->
1.
2.
3.

### 비기능 요구사항
- **성능**:
- **호환성**: 기존 코드와의 하위 호환성
- **에러 처리**: SystemError 패턴 준수

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
<!-- 구현할 핵심 아이디어와 패턴 -->

### 영향 받는 파일
| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| | 신규/수정 | |

### 의존성 분석
<!-- 이 Phase가 의존하는 기존 모듈과 이 Phase에 의존하는 후속 Phase -->

---

## 성공 기준

- [ ] 기준 1
- [ ] 기준 2
- [ ] TypeScript 컴파일 성공
- [ ] 기존 기능 정상 동작 확인

---

## 리스크 및 고려사항

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| | | |

---

*작성일: {{date}}*
*시드: .claude/phases/phase-{{X}}-core.md*
