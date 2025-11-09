# Cherry Chatbot Deployment Dashboard

SoftBank Hackathon 2025 ― Team Cherry의 DevOps 배포 상황판과 AI 챗봇.  
Next.js 16 + React 19 기반의 단일 프론트엔드이며, FastAPI 백엔드(`SB_Hackathon_Cherry_Deploy`)와 쿠키 세션으로 통신합니다.

---

## 목차
1. [빠른 시작](#빠른-시작)
2. [환경 변수](#환경-변수)
3. [리포지토리 구조](#리포지토리-구조)
4. [주요 소스 모듈](#주요-소스-모듈)
5. [UI 살펴보기](#ui-살펴보기)
6. [데이터 · API 흐름](#데이터--api-흐름)
7. [상태 관리와 UX 디테일](#상태-관리와-ux-디테일)
8. [정적 자산과 산출물](#정적-자산과-산출물)
9. [확장 가이드](#확장-가이드)
10. [배포](#배포)
11. [문제 해결](#문제-해결)

---

## 빠른 시작

### 요구 사항
- **Node.js ≥ 20.x** (Next.js 16 & React 19 호환 버전 권장)
- npm 10.x 이상
- FastAPI 백엔드가 `NEXT_PUBLIC_API_BASE_URL`에서 접근 가능해야 하며, 쿠키 기반 인증을 허용하도록 CORS/HTTPS가 설정되어야 합니다.

### 설치 및 개발 서버

```bash
cd frontend/my-dashboard
npm install
echo "NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:9001" > .env.local  # 필요 시 수정
npm run dev
# http://localhost:3000 접속
```

### 스크립트 요약

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | Next.js 개발 서버 (hot reload) |
| `npm run build` | 정적 export를 포함한 프로덕션 빌드 (`out/` 생성) |
| `npm run start` | 빌드 산출물 프리뷰 (정적 export 이후에는 필요 없음) |
| `npm run export` | `next build`와 동일하게 `out/` 생성 (`next.config.ts`에서 `output: "export"`) |
| `npm run lint` | `eslint-config-next` 기반 Lint |

---

## 환경 변수

| 변수 | 용도 | 기본값 (코드 내) |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | FastAPI 서버 루트. 모든 브라우저 fetch/axios 요청이 이 값을 기준으로 동작하며, 쿠키 인증을 위해 프로토콜 일치가 필요합니다. | 개발: `http://127.0.0.1:9001`, 프로덕션: `https://delight.13-125-116-92.nip.io` (`src/lib/api.ts`) |

> `.env.local`을 `frontend/my-dashboard/`에 두면 Next.js가 자동으로 로드합니다. 값 끝에 `/`가 들어가도 `lib/api.ts`에서 제거됩니다.

---

## 리포지토리 구조

```
SB_Hackathon_Cherry_Chatbot
├── README.md                  # 지금 읽고 있는 파일
└── frontend/
    └── my-dashboard/
        ├── src/
        │   ├── app/
        │   │   ├── components/   # ChatWidget, FloatingCharacter 등 공용 컴포넌트
        │   │   ├── deploy/       # /deploy 페이지
        │   │   ├── globals.css   # Tailwind v4 엔트리 + 글로벌 스타일
        │   │   ├── layout.tsx    # App Router 루트 레이아웃
        │   │   └── page.tsx      # 메인 대시보드 (client component)
        │   ├── lib/              # API 헬퍼
        │   └── types/            # 백엔드와 공유하는 TypeScript 타입
        ├── public/               # 정적 자산 (이미지, 오디오, mock 데이터)
        ├── legacy/               # 사용하지 않는 실험 UI 보관용 (빌드 제외)
        ├── out/                  # `npm run build` 결과 (정적 호스팅 용)
        ├── package.json
        ├── package-lock.json
        ├── tailwind.config.js
        ├── tsconfig.json
        └── eslint.config.mjs
```

### 참고
- `node_modules/`는 루트에 존재하며 Git에서 제외됩니다.
- `legacy/`는 `tsconfig.json`과 ESLint ignore에 포함되어 있어 컴파일되지 않습니다.
- `out/`는 배포 산출물이므로 수정하지 말고 필요 시 다시 빌드하세요.

---

## 주요 소스 모듈

| 경로 | 설명 |
| --- | --- |
| `src/app/page.tsx` | 메인 대시보드 전체 로직. 로그인/세션 관리, 배포 시작·롤백, 프리뷰/헬스/히스토리 폴링, ChatWidget 트리거, 모달 UI까지 포함된 client component. |
| `src/app/deploy/page.tsx` | `/deploy` Lottie 기반 배포 시각화 페이지. `/api/v1/deploy`로 작업을 만들고 `/api/v1/status/{task_id}`를 3초마다 폴링합니다. |
| `src/app/components/ChatWidget.tsx` | 하단 플로팅 챗봇. Stage 타임라인, 60초 게이지, LLM 응답 스트리밍(타이핑 효과), 성공/실패 오디오 피드백을 담당합니다. |
| `src/app/components/FloatingCharacter.tsx` | `framer-motion`으로 화면 전체를 부드럽게 떠다니는 어시스턴트 캐릭터. 배포 진행률에 따라 애니메이션이 유지됩니다. |
| `src/app/components/ChatApp.tsx` | Legacy 챗 UI. 현재 화면에 직접 쓰이지 않지만, `legacy/ChatPopup.tsx`에서 참조할 수 있는 로컬 저장소 기반 챗봇입니다. |
| `src/app/components/MetricCard.tsx`, `Header.tsx`, `ChatBubble.tsx` | 카드/헤더/배포 버블 등 필요 시 재사용할 수 있는 경량 컴포넌트 모음. |
| `src/lib/api.ts` | `NEXT_PUBLIC_API_BASE_URL` 정규화, 기본 JSON 헤더, 상대 경로 -> 절대경로 헬퍼. Axios 인스턴스가 여기 값을 사용합니다. |
| `src/types/deploy.ts` | FastAPI 응답 스키마 (`DeployPreviewResponse`, `DeployStatusResponse`, `BlueGreenPlan` 등) 정의. 프론트-백 간 계약을 한눈에 확인할 수 있습니다. |

---

## UI 살펴보기

### 1) 메인 대시보드 (`/`)

- **Hero 카드 (`renderHero`)**  
  - 로그인 전: ID/PW 입력 + `Prepare Deploy`, `Rollback` 버튼. LLM 요약 안내 문구.  
  - 로그인 후: 사용자명, 로그아웃 버튼, Blue/Green 슬롯 정보.  
  - 배포 진행 중: Task ID, Timezone 뱃지, 상태 게이지(사전 정의된 단계를 0~100%로 매핑).
- **Preview Timeline & Live Stage 패널**  
  - `/api/v1/preview`의 `timeline_preview`를 순서대로 보여주고, stage 메타데이터/타임스탬프와 함께 실시간 진행률을 제공합니다.  
  - `currentStages`는 `/api/v1/status/{task_id}` 폴링 값이며, 실패 컨텍스트 JSON도 그대로 노출됩니다.
- **Blue/Green 패널**  
  - 프리뷰 응답 → `blue_green_plan` → `/healthz` 순으로 fallback.  
  - Active/Standby/Last Cutover/Next Target을 요약합니다.
- **Warnings & Risk Assessment**  
  - 단순 `warnings` 외에도 diff 통계와 LLM risk notes를 합칩니다(`mergedPreflightWarnings`).  
  - `risk_assessment`의 모든 키를 그대로 노출하여 투명성을 유지합니다.
- **Recent Tasks**  
  - `/api/v1/tasks/recent?limit=5` 응답. KST/기타 타임존 뱃지, actor, action/branch, 시작/완료 시간을 보여줍니다.
- **프리뷰 모달 (Prepare Deploy)**  
  - LLM 요약, highlights/risks, GitHub compare 메타데이터, 파일 변경 통계, ETA, Downtime/롤백 메모, 실행 명령, Stage 타임라인, Blue/Green 계획을 한 화면에 제공합니다.  
  - “실제 배포“ 버튼으로 `/api/v1/deploy` 호출 → 세션 스토리지(`cherry.currentTaskId`)에 task 저장 → 메인 화면 폴링 시작.
- **Rollback 모달**  
  - `/api/v1/rollback` POST 호출 전 사용자 확인을 다시 한 번 요청합니다.
- **ChatWidget 토글**  
  - 우측 하단 버튼으로 챗봇을 열고 닫습니다. 열리면 FloatingCharacter의 투명도를 낮춰 시야를 확보합니다.

### 2) 배포 비주얼라이저 (`/deploy`)

- `Lottie` 애니메이션 (`idle`, `deploying`, `success`, `failed`)을 상태에 맞게 로드합니다.  
- `STATUS_PROGRESS` 매핑으로 단일 진행 바를 제공합니다.  
- `/api/v1/deploy` 응답의 `task_id`를 보여주고, 동일한 status 엔드포인트를 폴링합니다.  
- Stage 메타데이터, 시작/완료 시간, 에러 메시지를 별도 카드로 노출합니다.

### 3) 챗봇 위젯 (`ChatWidget.tsx`)

- 실시간 메시지 목록, 입력창, 전송 버튼을 포함한 창 2개(챗, Stage IDEATION 패널)로 구성됩니다.  
- Stage 윈도우는 2개씩 슬라이드되며, 완료 여부/타임스탬프/메모를 요약합니다.  
- 60초 게이지는 마지막 Stage 업데이트를 기준으로 자동으로 감소합니다.  
- `/api/v1/chat` 호출 → 응답 텍스트를 글자 단위로 출력해 스트리밍처럼 보이도록 합니다.  
- 성공(`happy.mp3`) 및 실패(`sad.mp3`) 오디오가 한 번만 재생되도록 ref로 제어합니다.

---

## 데이터 · API 흐름

### 인증
1. 페이지 로드 시 `/api/v1/auth/me`로 세션 확인. 실패 시 로그인 폼을 노출합니다.
2. 로그인 폼은 `/api/v1/auth/login`에 ID/PW를 전송 (`withCredentials: true`).  
3. 로그아웃 시 `/api/v1/auth/logout` 호출 후 모든 세션 상태를 초기화합니다.

### 배포 & 폴링
1. **프리뷰**: `/api/v1/preview` (필요 시 `task_id` 또는 `mode=preflight`).  
2. **배포 시작**: `/api/v1/deploy` POST (`branch: "deploy"`).  
3. **상태 폴링**: `/api/v1/status/{task_id}`를 3초 주기로 호출. 완료/실패 시 세션 스토리지 키 제거.  
4. **히스토리/헬스**: `/api/v1/tasks/recent` (45초), `/healthz` (20초), `/api/v1/preview`(30초) 자동 갱신.  
5. **롤백**: `/api/v1/rollback` POST.

### 챗봇
- `/api/v1/chat`에 JSON `{ message }`를 전송하고, 응답 `reply`를 한 글자씩 그립니다.

### 엔드포인트 요약

| HTTP | 경로 | 사용 위치 |
| --- | --- | --- |
| `GET` | `/api/v1/auth/me` | 첫 렌더 시 세션 확인 |
| `POST` | `/api/v1/auth/login` | Hero 카드 로그인 폼 |
| `POST` | `/api/v1/auth/logout` | Hero 카드 로그아웃 버튼 |
| `GET` | `/api/v1/preview` | Hero 요약, Preview Timeline, 프리뷰 모달 |
| `POST` | `/api/v1/preview?mode=preflight` | 프리뷰 모달 전용 데이터 |
| `POST` | `/api/v1/deploy` | Hero, `/deploy` 페이지에서 배포 시작 |
| `POST` | `/api/v1/rollback` | Rollback 모달 |
| `GET` | `/api/v1/status/{task_id}` | Hero 진행도, Live Stage, `/deploy` 페이지 |
| `GET` | `/api/v1/tasks/recent` | Recent Tasks 카드 |
| `GET` | `/healthz` | Blue/Green 상태 백업 정보 |
| `POST` | `/api/v1/chat` | ChatWidget |

> 모든 요청은 `JSON_HEADERS = { "Content-Type": "application/json" }`를 사용하며, Axios 인스턴스는 `withCredentials: true`로 구성되어 쿠키 세션을 유지합니다.

---

## 상태 관리와 UX 디테일

- **세션 지속**: 현재 진행 중인 배포의 `task_id`는 `sessionStorage("cherry.currentTaskId")`에 보관되어 새로고침 후에도 폴링을 이어갑니다.
- **오류 처리**: 401 응답은 자동으로 로그인 상태를 초기화하고, 사용자에게 "세션이 만료되었습니다" 메시지를 표시합니다.
- **자동 업데이트**: Preview(30초), Health(20초), Recent Tasks(45초) 등이 각각 interval로 업데이트됩니다. Clean-up을 통해 컴포넌트 언마운트 시 타이머가 초기화됩니다.
- **Hero Override**: 배포 시작 직후 `heroOverrideStatus`를 잠시 유지해 진행률 애니메이션 지연을 줄입니다.
- **LLM Summary**: `/api/v1/preview`의 `llm_preview.summary`를 Hero 카드 하단에 노출하여 가장 중요한 정보를 맨 위에서 확인할 수 있습니다.
- **Audio/Visual Feedback**: FloatingCharacter가 항상 화면 중앙을 부드럽게 이동하며, ChatWidget에서 성공/실패 시 다른 음원이 재생됩니다.

---

## 정적 자산과 산출물

- `public/images/*.png` : 캐릭터 및 아이콘 (`FloatingCharacter`, 프리뷰 모달 일러스트).  
- `public/audios/happy.mp3`, `public/audios/sad.mp3` : 배포 성공/실패 알림.  
- `public/mock/*.json` : 로컬 실험을 위한 더미 응답 (현재 코드에서는 직접 사용하지 않지만 필요 시 fetch 목적으로 활용 가능).  
- `public/lottie/*.json` : `/deploy` 페이지에서 사용하는 애니메이션. 저장소에는 포함돼 있지 않으므로 운영 환경에 `idle.json`, `deploying.json`, `success.json`, `failed.json`을 추가해야 합니다.  
- `out/` : `npm run build` 후 생성되는 정적 사이트. CDN/S3 등에 그대로 업로드하면 됩니다.

---

## 확장 가이드

1. **타입 먼저 정의**  
   - FastAPI 응답이 변경되면 `src/types/deploy.ts`에 필드를 추가/수정하세요.  
   - 프론트 단 로직은 해당 타입을 import해서 사용하므로 컴파일 단계에서 누락을 확인할 수 있습니다.
2. **API 유틸 재사용**  
   - 새로운 fetch/Axios 요청은 `API_BASE_URL`과 `JSON_HEADERS`를 사용하세요 (`src/lib/api.ts`).  
   - 인증이 필요한 호출이라면 반드시 Axios 인스턴스를 재사용해 쿠키를 유지합니다.
3. **컴포넌트 배치**  
   - 공용 UI는 `src/app/components/`에 두고, 페이지 전용 컴포넌트는 각 라우트 디렉터리에 위치시키는 것이 현재 구조와 일관됩니다.  
   - 다크 테마 톤을 맞추기 위해 `globals.css`의 색상 팔레트를 참고하거나 Tailwind 유틸 클래스를 이용하세요.
4. **스타일**  
   - Tailwind v4를 사용하므로 `@import "tailwindcss";` 이후 layer를 추가하거나 CSS 변수를 정의할 수 있습니다.  
   - 커스텀 애니메이션은 `style jsx` 또는 전용 CSS 파일(`ChatStyles.css`)처럼 필요한 위치에서만 선언합니다.
5. **Legacy 참고**  
   - `legacy/` 폴더에는 초기 버전 UI가 있습니다. 필요 시 내용을 `src/`로 옮긴 뒤 타입/빌드 설정을 업데이트하세요.

---

## 배포

1. **정적 빌드**
   ```bash
   cd frontend/my-dashboard
   npm run build
   ```
   - `out/` 폴더가 생성되며, Next.js `output: "export"` 설정 덕분에 모든 페이지가 정적 파일로 변환됩니다.
2. **호스팅**
   - `out/` 전체를 S3, CloudFront, Vercel Static, Nginx 등 아무 정적 호스팅에 올리면 됩니다.
   - 프론트는 런타임에 FastAPI로 직접 fetch하므로, **CORS/HTTPS** 설정과 `NEXT_PUBLIC_API_BASE_URL` 값만 정확하면 됩니다.
3. **사전 점검**
   - `npm run lint`로 기본 규칙을 통과했는지 확인합니다.
   - 배포 전 반드시 FastAPI 백엔드가 `/api/v1/preview`, `/api/v1/status`, `/healthz`를 정상적으로 응답하는지 검증하세요.

---

## 문제 해결

| 증상 | 점검 방법 |
| --- | --- |
| 로그인 불가 / 401 반복 | 백엔드 CORS에서 `credentials` 허용 여부, HTTPS 동일 출처 여부, 쿠키 도메인을 확인하세요. `.env.local`의 API URL도 다시 확인합니다. |
| `/deploy` 애니메이션이 로딩에서 멈춤 | `public/lottie/*.json` 파일이 누락되었을 가능성이 큽니다. 운영 자산 경로에 4개의 JSON을 추가하세요. |
| 배포 진행률이 0%로 유지 | `sessionStorage`에 저장된 `task_id`가 만료됐을 수 있습니다. 브라우저 세션 스토리지를 비우거나 새 배포를 시작하세요. |
| 프리뷰 모달에서 경고/리스크가 비어있음 | FastAPI가 `diff_stats`, `risk_assessment`, `llm_preview`를 반환하는지 확인하세요. 응답이 없다면 UI는 자동으로 “데이터 없음” 메시지를 표기합니다. |
| ChatWidget 응답이 멈춤 | `/api/v1/chat` 응답이 지연 중일 수 있습니다. 브라우저 콘솔에서 네트워크 요청을 살펴보고, 서버 타임아웃을 조정하세요. |

필요한 정보가 더 있다면 `frontend/my-dashboard/src/app/page.tsx`에서 해당 섹션을 찾아 콘솔 로그(남아있는 `console.warn`)를 활용하면 됩니다.  
이 README만으로도 새로 클론한 사람이 전체 구조와 동작 원리를 95% 이상 이해할 수 있도록 모든 구성 요소를 서술했습니다.
