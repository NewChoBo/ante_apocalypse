# Ante Apocalypse

브라우저 기반 FPS/서바이벌 프로토타입 모노레포입니다.

## Tech Stack
- Engine: Babylon.js
- Language: TypeScript
- Build: Vite + pnpm workspace
- Network: Photon Realtime + Local Host Adapter
- Test: Vitest

## Workspace 구조
```text
apps/
  client/   # Babylon.js 클라이언트
  server/   # Node 기반 헤드리스 서버 런타임
packages/
  common/   # 네트워크 프로토콜/공용 타입/유틸
  game-core/# 공용 게임 로직(시뮬레이션/룰/서버 코어)
  assets/   # 모델/텍스처/사운드/레벨 정적 에셋
```

## 로컬 실행
```bash
pnpm install
pnpm dev:client
pnpm dev:server
```

## 품질 체크
```bash
pnpm -r check
pnpm test
pnpm -r build
```

## 환경 변수
루트 `.env`에 Photon 설정을 둡니다.

```env
VITE_PHOTON_APP_ID=...
VITE_PHOTON_APP_VERSION=...
```

## 조작
- 이동: `W A S D`
- 시점: 마우스
- 점프: `Space`
- 사격: 마우스 좌클릭
- 재장전: `R`
- 메뉴/일시정지: `Esc`
