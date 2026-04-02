# 코딩 컨벤션 (Coding Conventions)

## 네이밍 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| Classes | PascalCase | `EventBus`, `RecruitService` |
| Functions | camelCase | `getRecruitList`, `handleSubmit` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `CRAWL_MODE` |
| Types/Interfaces | PascalCase | `RecruitData`, `CityKo` |
| File (class) | PascalCase.ts | `EventBus.ts`, `RecruitStore.ts` |
| File (util) | camelCase.ts | `formatDate.ts`, `systemLogger.ts` |
| Folders | kebab-case | `user-profile/`, `recruit-cache/` |

## 임포트 순서 (Import Order)

```typescript
// 1. External libraries (discord.js, firebase, third-party)
import { Client, GatewayIntentBits } from 'discord.js'
import { initializeApp, getApps } from 'firebase-admin/app'

// 2. Internal absolute imports (@/...)
import { EventBus } from '@/events/bus'
import { RecruitService } from '@/services/recruitService'

// 3. Relative imports (./...)
import { RecruitStore } from '../providers/firebase/store'
import { formatDate } from './utils'

// 4. Type imports
import type { RecruitData } from '@/crawlers/types'
import type { CityKo, CityEn } from '@/common/types'
```

> No barrel imports:
> ❌ `import * as admin from 'firebase-admin'`
> ✅ `import { initializeApp } from 'firebase-admin/app'`

## 아키텍처 레이어 (Architecture Layers)

| 레이어 | 위치 | 책임 | 의존 가능 |
|--------|------|------|----------|
| **Presentation** | `features/*/commands/`, `features/*/interactions/`, `events/` | Discord 명령 응답, 이벤트 핸들링 | Application, Domain |
| **Application** | `features/*/services/`, `features/*/handlers/`, `services/` | 비즈니스 로직, 이벤트 오케스트레이션 | Domain, Infrastructure |
| **Domain** | `common/types/`, `common/constants/` | 엔티티, 핵심 규칙 정의 | 없음 (독립적) |
| **Infrastructure** | `providers/`, `crawlers/`, `common/middlewares/` | 외부 서비스 연동, 크롤링 | Domain만 |
