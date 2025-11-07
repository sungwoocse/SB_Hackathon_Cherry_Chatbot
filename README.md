# Cherry Deploy Project ()

SoftBank Hackathon 2025 (Team Cherry) - DevOps Deployment Dashboard with AI Chatbot

---

## 📋 프로젝트 개요

Cherry Chatbot Dashboard는 DevOps 배포 프로세스를 시각화하고, AI 챗봇을 통해 배포 상태를 실시간으로 모니터링할 수 있는 대시보드입니다. Green/Blue Deployment 전략을 지원하며, 배포의 각 단계를 직관적으로 확인할 수 있습니다.

## 🍒 Team
* Cherry

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 16.0.1 (App Router)
- **Language:** TypeScript 5
- **UI/Styling:** 
  - Tailwind CSS 4.1.16
  - Framer Motion 12.23.24 (애니메이션)
- **Data Fetching:** Axios 1.13.2
- **Animation:** Lottie React 2.4.0
- **React:** 19.2.0

### Backend Integration
- **API:** FastAPI (Python)
- **Database:** MongoDB
- **Cloud:** AWS EC2

---

## 🎯 주요 기능

### 1. 📊 배포 대시보드 (Main Dashboard)
- **실시간 배포 상태 모니터링**
  - Pending, Clone, Build, Cutover, Observability 등 각 배포 단계별 진행 상황 표시
  - 진행률 바를 통한 시각적 피드백
  - 상태별 색상 코드 (성공: 초록색, 실패: 빨간색, 진행중: 파란색)

- **Blue/Green Deployment 정보**
  - 현재 활성 환경 (Blue/Green) 표시
  - 각 환경별 컨테이너 상태 및 헬스 체크
  - 트래픽 가중치 정보

- **배포 미리보기 (Preflight)**
  - 배포 전 변경사항 확인
  - Git 커밋 정보 및 작성자
  - AI 생성 배포 요약
  - 예상 배포 타임라인
  - 경고 메시지

- **배포 히스토리**
  - 최근 배포 작업 목록
  - 각 배포의 상태, 시작/종료 시간
  - 실패한 배포에 대한 상세 정보

### 2. 💬 AI 챗봇 (ChatWidget)
- **인터랙티브 UI**
  - 캐릭터 애니메이션 (idle, talking, success, failed 상태)
  - 타이핑 효과로 자연스러운 응답
  - 실시간 메시지 스트리밍

- **기능**
  - 배포 관련 질문 응답
  - 시스템 상태 조회
  - 자연어 기반 대화형 인터페이스

- **Components**
  - `ChatWidget.tsx`: 메인 채팅 인터페이스
  - `Character.tsx`: 캐릭터 애니메이션
  - `ChatBubble.tsx`: 메시지 말풍선
  - `ChatApp.tsx`: 채팅 앱 통합

### 3. 🎨 배포 시각화 페이지 (`/deploy`)
- **Lottie 애니메이션**
  - Idle: 대기 상태
  - Deploying: 배포 진행 중
  - Success: 배포 성공
  - Failed: 배포 실패

- **상세 배포 정보**
  - 배포 ID 및 상태
  - 각 단계별 진행률
  - 실시간 상태 업데이트 (폴링)

### 4. 📈 메트릭 카드 (MetricCard)
- 배포 상태별 주요 지표 표시
- 애니메이션 효과로 데이터 변화 강조
- 반응형 레이아웃

---

## 🏗️ 프로젝트 구조

```
frontend/my-dashboard/
├── src/
│   ├── app/
│   │   ├── components/           # 공통 컴포넌트
│   │   │   ├── Character.tsx     # AI 캐릭터 애니메이션
│   │   │   ├── ChatWidget.tsx    # 챗봇 위젯
│   │   │   ├── ChatBubble.tsx    # 메시지 말풍선
│   │   │   ├── ChatApp.tsx       # 채팅 앱
│   │   │   ├── Header.tsx        # 헤더
│   │   │   ├── MetricCard.tsx    # 메트릭 카드
│   │   │   └── ChatStyles.css    # 채팅 스타일
│   │   ├── deploy/
│   │   │   └── page.tsx          # 배포 시각화 페이지
│   │   ├── page.tsx              # 메인 대시보드
│   │   ├── layout.tsx            # 루트 레이아웃
│   │   └── globals.css           # 전역 스타일
│   ├── lib/
│   │   └── api.ts                # API 설정 및 유틸리티
│   └── types/
│       └── deploy.ts             # TypeScript 타입 정의
├── public/
│   └── lottie/                   # Lottie 애니메이션 파일
│       ├── idle.json
│       ├── deploying.json
│       ├── success.json
│       └── failed.json
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── next.config.ts
```

---

## 🚀 시작하기

### Prerequisites
- Node.js 20 이상
- npm, yarn, pnpm 또는 bun

### Installation

```bash
cd frontend/my-dashboard
npm install
```

### Development

```bash
# 기본 개발 서버 실행 (http://localhost:3000)
npm run dev

# API 베이스 URL 지정
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:9001 npm run dev
```

### Production Build

```bash
npm run build
npm run start
```

### Environment Variables

- `NEXT_PUBLIC_API_BASE_URL`: FastAPI 백엔드 URL
  - 개발 환경 기본값: `http://127.0.0.1:9001`
  - 프로덕션 기본값: `https://delight.13-125-116-92.nip.io`

---

## 📡 API 통합

### Endpoints
- `POST /api/v1/deploy`: 배포 시작
- `POST /api/v1/rollback`: 롤백 실행
- `GET /api/v1/status/{task_id}`: 배포 상태 조회
- `POST /api/v1/preview`: 배포 미리보기
- `GET /api/v1/health`: 시스템 헬스 체크
- `POST /api/v1/chat`: 챗봇 메시지 전송
- `GET /api/v1/tasks/recent`: 최근 배포 작업 목록

### API 설정
- Base URL: `lib/api.ts`에서 중앙 관리
- Headers: JSON Content-Type 자동 설정
- 환경별 URL 자동 전환

---

## 🎨 UI/UX 특징

### 애니메이션
- **Framer Motion**: 카드 등장 애니메이션, 상태 전환 효과
- **Lottie**: 배포 프로세스 시각화, 캐릭터 애니메이션
- **CSS Transitions**: 부드러운 색상 및 레이아웃 변화

### 반응형 디자인
- Tailwind CSS를 활용한 모바일/태블릿/데스크톱 최적화
- 동적 그리드 레이아웃
- 유연한 컴포넌트 크기 조정

### 다크 모드
- 기본 다크 테마 적용
- 눈의 피로를 줄이는 색상 팔레트
- 고대비 UI 요소

---

## 🔄 실시간 업데이트

- **폴링 메커니즘**: 배포 상태 자동 갱신 (3초 간격)
- **로컬 스토리지**: 현재 작업 ID 저장 및 복원
- **WebSocket 대응**: 향후 실시간 통신 확장 가능

---

## 📝 개발 가이드

### 컴포넌트 추가
1. `src/app/components/` 디렉토리에 새 파일 생성
2. TypeScript + React 함수형 컴포넌트 작성
3. 필요한 타입은 `src/types/deploy.ts`에 정의

### API 호출
```typescript
import { API_BASE_URL, JSON_HEADERS } from "@/lib/api";

const response = await fetch(`${API_BASE_URL}/api/v1/endpoint`, {
  method: "POST",
  headers: JSON_HEADERS,
  body: JSON.stringify(data),
});
```

### 스타일링
- Tailwind CSS 유틸리티 클래스 사용
- 커스텀 스타일은 `globals.css` 또는 모듈 CSS 파일 사용

---

## 🐛 Troubleshooting

### API 연결 실패
- `NEXT_PUBLIC_API_BASE_URL` 환경 변수 확인
- 백엔드 서버가 실행 중인지 확인
- CORS 설정 확인

### 빌드 에러
```bash
# 캐시 및 node_modules 정리
rm -rf .next node_modules
npm install
npm run build
```

---

## 📄 License

SoftBank Hackathon 2025 - Team Cherry

---

## 👥 Contributors

Team Cherry Members

---

## 🔗 Related Projects

- **Backend API**: `SB_Hackathon_Cherry_Deploy` 프로젝트
- **MongoDB**: 배포 작업 및 상태 데이터 저장

---

**Note:** "이번 deploy 브랜치는 chatbot 서비스만 배포 대상입니다."
