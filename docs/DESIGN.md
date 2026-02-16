# ClawSouls CLI 설계 문서

## 개요

Soul 패키지를 설치, 관리, 배포하는 CLI 도구.

```bash
npm install -g clawsouls
# 또는
npx clawsouls <command>
```

## 기술 스택

- **Runtime**: Node.js 22+
- **Language**: TypeScript
- **CLI Framework**: Commander.js
- **HTTP**: undici (Node.js 내장)
- **Validation**: Zod (clawsoul.json 스키마)
- **Archive**: tar (패키지 압축/해제)
- **Output**: chalk + ora (컬러 + 스피너)

## 명령어

### `clawsouls install <name>[@version]`
```
1. Registry API에서 메타데이터 조회
2. CDN에서 archive.tar.gz 다운로드
3. checksum 검증 (SHA256)
4. ~/.openclaw/souls/<name>/ 에 해제
5. 완료 메시지 출력
```

### `clawsouls use <name>`
```
1. ~/.openclaw/souls/<name>/ 존재 확인
2. 현재 workspace 파일 백업 → ~/.openclaw/souls/_backup/<timestamp>/
3. Soul 파일을 workspace에 복사:
   - SOUL.md → workspace/SOUL.md
   - IDENTITY.md → workspace/IDENTITY.md
   - AGENTS.md → workspace/AGENTS.md (병합 옵션)
   - HEARTBEAT.md → workspace/HEARTBEAT.md
4. USER.md는 건드리지 않음 (개인 데이터)
5. MEMORY.md는 건드리지 않음 (개인 데이터)
6. "새 세션 시작 권장" 안내 표시
```

### `clawsouls restore`
```
1. 최신 백업 확인 (~/.openclaw/souls/_backup/)
2. 백업 파일을 workspace에 복사
3. 완료 메시지
```

### `clawsouls list`
```
1. ~/.openclaw/souls/ 스캔
2. 각 Soul의 clawsoul.json 읽기
3. 테이블 출력 (name, version, description)
```

### `clawsouls search <query>`
```
1. Registry API: GET /api/v1/search?q=<query>
2. 결과 테이블 출력 (name, description, downloads, rating)
```

### `clawsouls init`
```
1. 대화형 프롬프트 (name, description, category, tags)
2. 디렉토리 스캐폴딩:
   - clawsoul.json (메타데이터)
   - SOUL.md (템플릿)
   - IDENTITY.md (템플릿)
   - AGENTS.md (템플릿)
   - HEARTBEAT.md (빈 파일)
   - README.md (템플릿)
```

### `clawsouls publish`
```
1. clawsoul.json 검증 (Zod)
2. 필수 파일 존재 확인
3. 파일 크기 검증 (<1MB)
4. 보안 스캔 (프롬프트 인젝션 패턴)
5. tar.gz 아카이브 생성
6. Registry API: PUT /api/v1/souls/:name
7. 완료 메시지 + URL
```

### `clawsouls login`
```
1. 브라우저 열기 → clawsouls.ai/auth/cli?session=<uuid>
2. GitHub OAuth 완료 대기 (polling)
3. 토큰 저장 → ~/.clawsouls/config.json
```

## 디렉토리 구조

```
~/.openclaw/
├── souls/                     # 설치된 Soul
│   ├── brad/
│   │   ├── clawsoul.json
│   │   ├── SOUL.md
│   │   ├── IDENTITY.md
│   │   ├── AGENTS.md
│   │   └── HEARTBEAT.md
│   ├── minimalist/
│   └── _backup/               # use 전 백업
│       └── 2026-02-12T235900/
├── workspace/                 # 현재 활성 Soul
│   ├── SOUL.md
│   ├── IDENTITY.md
│   └── ...

~/.clawsouls/
└── config.json                # CLI 설정 (auth token, registry URL)
```

## Config

```json
{
  "registry": "https://api.clawsouls.ai",
  "cdn": "https://cdn.clawsouls.ai",
  "auth": {
    "token": "cs_xxxxxxxxxxxx"
  },
  "workspace": "~/.openclaw/workspace"
}
```

## 에러 처리

| 에러 | 메시지 | 대응 |
|------|--------|------|
| Soul 없음 | `Soul "xyz" not found in registry` | 검색 제안 |
| 네트워크 | `Failed to connect to registry` | 오프라인 캐시 제안 |
| 권한 | `Authentication required. Run: clawsouls login` | 로그인 안내 |
| 검증 실패 | `Invalid clawsoul.json: missing field "name"` | 구체적 필드 안내 |
| 충돌 | `Soul "brad" already installed. Use --force to overwrite` | force 옵션 |

## MVP 범위 (Phase 2)

**포함:**
- [x] install, use, restore, list
- [x] 로컬 파일 관리
- [x] clawsoul.json 검증

**제외 (Phase 4 이후):**
- [ ] search, publish, login (API 필요)
- [ ] 보안 스캔
- [ ] 오프라인 캐시

**MVP에서는 GitHub raw URL을 임시 레지스트리로 사용:**
```
https://raw.githubusercontent.com/clawsouls/souls/main/<name>/archive.tar.gz
```
