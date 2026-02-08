# Functions 계층 - 개발 가이드

> Firebase Functions 프로젝트 루트 계층 작업 가이드
> 기술 스택: [README.md](../README.md#기술-스택)

---

## 📋 이 계층에서 작업할 내용

### 프로젝트 설정
- package.json 의존성 관리
- tsconfig.json TypeScript 설정
- Firebase Functions 배포 설정
- 환경 변수 관리 (.env)

### 주요 파일

#### package.json
```json
{
  "scripts": {
    "dev": "concurrently \"npm run build:watch\" \"nodemon --watch lib --ext js --exec \\\"npm run emulator\\\"\"",
    "build": "tsc -p tsconfig.build.json",
    "deploy": "firebase deploy --only functions",
    "register:commands": "tsx src/providers/discord/register-commands.ts"
  }
}
```

#### tsconfig.json
- 경로 매핑: `@/common`, `@/services`, `@/providers`, `@/events`, `@/events/eventBus` 등
- 타겟: ES2020
- 모듈: CommonJS (Firebase Functions 요구사항)
- 선언 파일 생성: declaration, declarationMap 활성화

**Phase 1.12 업데이트 (2026-01-16)**:
```json
"@/events/*": ["src/events/*"],
"@/events/eventBus": ["src/events/eventBus"],
"@/events/eventBus/*": ["src/events/eventBus/*"]
```

### 환경 변수

`.env` 파일:
```bash
# Firebase
FIREBASE_PROJECT_ID=your-project-id

# Discord
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-client-id
ADMIN_USER_ID=your-discord-user-id

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password

# Hugging Face (Phase 4)
HUGGINGFACE_API_KEY=your-api-key
```

### 하위 계층 구조

```
functions/
├── src/               → 애플리케이션 코드 (claude.md 참고)
├── package.json       → 의존성 관리
├── tsconfig.json      → TypeScript 설정
├── .env               → 환경 변수
└── firebase.json      → Firebase 설정
```

---

## 작업 시 참고사항

1. **새 의존성 추가 시**:
   ```bash
   cd functions
   npm install <package-name>
   ```

2. **환경 변수 추가 시**:
   - `.env` 파일에 추가
   - Firebase Functions에도 설정:
     ```bash
     firebase functions:config:set key.name="value"
     ```

3. **빌드 및 배포**:
   ```bash
   npm run build    # TypeScript 컴파일
   npm run deploy   # Firebase 배포
   ```

---

## 관련 문서

### 개발 가이드
- [src/claude.md](./src/claude.md) - 애플리케이션 코드 작업 가이드
- [src/events/eventBus/claude.md](./src/events/eventBus/claude.md) - EventBus 시스템 (Phase 1.1, 1.12 완료)

### 작업 관리
- [../.claude/todos/TODO.md](../.claude/todos/TODO.md) - Phase별 작업 목록
- [../.claude/todos/PROGRESS.md](../.claude/todos/PROGRESS.md) - 진행 현황

---

**최종 수정**: 2026-01-16
**현재 Phase**: 1.3 - RecruitCacheService 이벤트 통합 (🔍 검토 중)
