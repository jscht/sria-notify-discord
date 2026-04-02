# 빌드, 배포, 실행 (Build / Deploy / Run)

## 사전 요구사항
- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)
- Redis Server
- Discord Bot Token

## 작업 디렉토리
모든 명령은 `functions/` 디렉토리에서 실행.
```bash
cd functions
```

## 설치
```bash
npm install
cp .env.example .env  # 환경 변수 설정
```

## 로컬 실행
```bash
npm run dev      # 개발 서버 (hot reload)
npm run serve    # 빌드 후 에뮬레이터 실행
```

## 빌드
```bash
npm run build    # 프로덕션 빌드
```

## 배포
```bash
npm run deploy   # Firebase Functions 배포
```

## Discord 명령어 등록
```bash
npm run register:commands
```

## 환경 변수
`.env` 파일 필수 항목:
- `FIREBASE_PROJECT_ID`
- `DISCORD_BOT_TOKEN` / `DISCORD_CLIENT_ID` / `ADMIN_USER_ID`
- `REDIS_URL` / `REDIS_PASSWORD`
- `HUGGINGFACE_API_KEY`
