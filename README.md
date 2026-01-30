# 🧟 Ante Apocalypse (Shooting Range Prototype)

> **"우리는 실패했다. 하지만 끝까지 싸울 것이다."**
>
> 서바이벌 호러 FPS 프로토타입 - 생화학 연구소의 악몽에서 살아남으세요.

[![GitHub Pages](https://newchobo.github.io/ante_apocalypse/)](https://newchobo.github.io/ante_apocalypse/)

![Game Screenshot](https://raw.githubusercontent.com/newchobo/ante_apocalypse/main/public/screenshot.png)
_(스크린샷 이미지는 나중에 추가될 예정입니다)_

## 🎮 게임 소개

**Ante Apocalypse**는 Three.js와 WebGL 기술을 활용하여 웹 브라우저에서 바로 즐길 수 있는 FPS 게임입니다. 현재 버전은 **사격장(Shooting Range) 프로토타입**으로, 기본적인 이동과 사격 메커니즘을 체험할 수 있습니다.

### 🕹️ 조작 방법

| 동작          | 키                   |
| ------------- | -------------------- |
| **이동**      | `W`, `A`, `S`, `D`   |
| **시점 전환** | 마우스 이동          |
| **점프**      | `Space`              |
| **사격**      | 마우스 왼쪽 버튼     |
| **재장전**    | `R`                  |
| **일시정지**  | `Esc`                |
| **게임 시작** | `시작하기` 버튼 클릭 |

## 🛠️ 기술 스택

- **Engine**: Three.js
- **Language**: TypeScript
- **Bundler**: Vite
- **Physics**: Rapier.js (예정)
- **Formatting**: ESLint + Prettier

## 🚀 실행 방법 (로컬)

```bash
# 프로젝트 클론
git clone https://github.com/newchobo/ante_apocalypse.git

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

## 🗺️ 로드맵 (Future Goals)

현재 **Ante Apocalypse**는 프로토타입 단계이며, 정식 버전을 위해 다음과 같은 기능들을 순차적으로 개발할 예정입니다.

### 1단계: 코어 시스템 및 전투 고도화

- [x] 기본적인 사격 및 탄약 시스템
- [x] 재장전 시스템 구현
- [ ] **인벤토리 및 체력 시스템**: 구급상자, 탄약 상자 등 아이템 관리
- [ ] **무기 교체 및 근접 무기**: 칼, 도끼 등 근접 전투 수단 추가
- [ ] **적 AI (좀비/변이체)**: 플레이어를 추적하고 공격하는 적군 추가
- [ ] **미니맵 시스템**: 주변 지형 및 적 위치 탐지

### 2단계: 연출 및 몰입감 강화

- [ ] **애니메이션 및 모션**: 장전, 공격, 이동 시의 자연스러운 캐릭터 동작
- [ ] **사운드 시스템**: 총성, 발소리, 적의 괴성 및 배경 음악 적용
- [ ] **컷신 및 자막**: 스토리 전달을 위한 연출 장면 및 시스템
- [ ] **그래픽 고도화**: 셰이더, 라이팅, 고품질 모델링 에셋 적용

### 3단계: 콘텐츠 확장 및 게임 플레이 완성

- [ ] **스토리 및 세계관**: 게임의 배경이 되는 내러티브 적용
- [ ] **미션 및 승리 기준**: 탈출, 특정 타겟 제거 등 게임 목표 설정
- [ ] **맵 개발 및 로딩 시스템**: 대규모 연구소 맵 및 구역 간 원활한 이동
- [ ] **저장/불러오기 기능**: 진행 상황 세이브 시스템

### 4단계: 확장 기능

- [ ] **멀티플레이(협동)**: 친구와 함께 살아남는 코옵 모드 구현

---

© 2026 Ante Apocalypse Project. All rights reserved.
