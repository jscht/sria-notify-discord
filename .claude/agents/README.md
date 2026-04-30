# Agent System

## 계층 구조

```
CTO Lead (opus)
├── Discord Agent (opus) ←→ Frontend Architect (sonnet) — UI 협업
│                        ←→ Integration Lead (opus) — 기능 협업
├── Integration Lead (opus)
│   └── Backend Expert (sonnet)
├── AI Agent (opus)
├── Security Architect (opus)
├── Design Validator (opus)
├── Gap Detector (opus) ← pdca analyze
├── Code Analyzer (opus) ← pdca analyze
├── Report Generator (haiku) ← pdca report
└── License/Compliance (sonnet)
```

## 에이전트 목록

### 커스텀 에이전트 (4개)

| 에이전트 | 파일 | 모델 | 역할 |
|----------|------|------|------|
| Integration Lead | `integration-lead.md` | opus | 외부 서비스 오케스트레이션, 3-tier 캐시 흐름 |
| Discord Agent | `discord-agent.md` | opus | discord.js 14.17 도메인, 핵심 인터페이스 |
| AI Agent | `ai-agent.md` | opus | HuggingFace NLP, Phase 4 전담 |
| License/Compliance | `license-compliance.md` | sonnet | 크롤링 합법성, 라이선스 감사 |

### bkit 경량 적응 에이전트 (8개)

| 에이전트 | 파일 | 모델 | 역할 |
|----------|------|------|------|
| CTO Lead | `cto-lead.md` | opus | PDCA 오케스트레이션, 에이전트 조율 |
| Frontend Architect | `frontend-architect.md` | sonnet | Discord UI/UX 설계 |
| Backend Expert | `backend-expert.md` | sonnet | Firebase/Redis 데이터 모델링 |
| Security Architect | `security-architect.md` | opus | 보안 점검 (C 포맷 출력) |
| Code Analyzer | `code-analyzer.md` | opus | 코드 품질/DRY 분석 (B 포맷 출력) |
| Gap Detector | `gap-detector.md` | opus | 설계↔구현 갭 분석 (B 포맷 출력) |
| Report Generator | `report-generator.md` | haiku | PDCA 보고서 생성 |
| Design Validator | `design-validator.md` | opus | 설계 문서 검증 (C 포맷 출력) |

## 협업 패턴

### UI 작업: Frontend Architect + Discord Agent
- Frontend Architect: 정보 구조, 레이아웃, 색상 설계
- Discord Agent: discord.js EmbedBuilder/ButtonBuilder 구현

### Feature 작업: Discord Agent + Integration Lead
- Discord Agent: 커맨드 핸들러, interaction.reply
- Integration Lead: 서비스 호출 로직, 캐시 흐름

### 데이터 작업: Integration Lead → Backend Expert
- Integration Lead: 캐시 흐름, TTL 정책 결정
- Backend Expert: Firestore/Redis 스키마 설계

### PDCA 분석: pdca skill → Gap Detector + Code Analyzer
- Gap Detector: Structural/Functional/Contract 3차원 갭 → analysis.md §1~§3
- Code Analyzer: 이슈 목록 + 컨벤션 → analysis.md §4~§5

### PDCA 보고: pdca skill → Report Generator
- Report Generator: 보고서 초안 → report.template.md 포맷

## MCP 연결

| MCP | 주 사용 에이전트 | 용도 |
|-----|-----------------|------|
| Redis MCP (`redis/mcp-redis`) | Integration Lead | 캐시 상태, TTL, 키 패턴 |
| Firebase MCP (Google) | Integration Lead | Firestore 문서 조회, 스키마 검증 |
| Playwright MCP (`microsoft/playwright-mcp`) | Integration Lead | 크롤링 셀렉터 테스트 |
| Discord MCP (`SaseQ/discord-mcp`) | Discord Agent | 선택적, 봇 상태 확인 |

## 출력 포맷 체계

| 유형 | 용도 | 생산 에이전트 |
|------|------|--------------|
| **A: 대시보드** | 프로젝트 현황 상시 확인 | pdca status |
| **B: PDCA 사이클** | analysis.md 통합 | Gap Detector, Code Analyzer |
| **C: 품질 게이트** | 의사결정용 판정 문서 | Design Validator, Security Architect, License/Compliance |
| **D: 이슈 알림** | 블로커/경고 단일 템플릿 | pdca status/iterate |

## Tier 2/3 (미래 추가 예정)

- QA Strategist (Phase 3 시작 시)
- QA Monitor (Phase 2 시작 시)
- Infra Architect (배포 최적화 시)
- PDCA Eval 5개 (품질 정량화 필요 시)
