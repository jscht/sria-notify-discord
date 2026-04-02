# Phase {{X.Y}} 구현 가이드: {{feature-name}}

> 이 가이드는 파일로 저장되지 않고 출력만 됩니다.

---

## 사전 준비

```bash
cd functions
npm install  # 의존성 확인
```

### 작업 디렉토리 확인
- [ ] `functions/` 디렉토리에서 작업
- [ ] 설계서 확인: `docs/02-design/phases/phase-{{X}}-{{Y}}.design.md`

---

## 구현 순서

<!-- 설계서 §4 구현 순서를 기반으로 생성 -->

### Step 1: {{작업명}} (설계서 §2.1)

**파일**: `functions/src/...`

**할 일**:
1.
2.
3.

**체크포인트**:
- [ ] TypeScript 컴파일 성공
- [ ] 기존 코드 영향 없음

### Step 2: {{작업명}} (설계서 §2.2)

**파일**: `functions/src/...`

**할 일**:
1.
2.

**체크포인트**:
- [ ] TypeScript 컴파일 성공

---

## 컨벤션 체크포인트

구현 완료 후 확인:
- [ ] SystemLogger 사용 (console.log 없음)
- [ ] SystemError 패턴 준수
- [ ] camelCase/PascalCase 네이밍
- [ ] JSDoc 주석 (public API)
- [ ] import 경로 정리

---

## 다음 단계

구현 완료 후: `/pdca analyze {{X.Y}}`
