# 🧟 Ante Apocalypse (Shooting Range Prototype)

> **"우리는 실패했다. 하지만 끝까지 싸울 것이다."**
> 
> 서바이벌 호러 FPS 프로토타입 - 생화학 연구소의 악몽에서 살아남으세요.

[![GitHub Pages](https://newchobo.github.io/ante_apocalypse/)](https://newchobo.github.io/ante_apocalypse/)

![Game Screenshot](https://raw.githubusercontent.com/newchobo/ante_apocalypse/main/public/screenshot.png)
*(스크린샷 이미지는 나중에 추가될 예정입니다)*

## 🎮 게임 소개
**Ante Apocalypse**는 Three.js와 WebGL 기술을 활용하여 웹 브라우저에서 바로 즐길 수 있는 FPS 게임입니다. 현재 버전은 **사격장(Shooting Range) 프로토타입**으로, 기본적인 이동과 사격 메커니즘을 체험할 수 있습니다.

### 🕹️ 조작 방법
| 동작 | 키 |
|------|----|
| **이동** | `W`, `A`, `S`, `D` |
| **시점 전환** | 마우스 이동 |
| **점프** | `Space` |
| **사격** | 마우스 왼쪽 버튼 (구현 중) |
| **게임 시작** | `시작하기` 버튼 클릭 |

## 🛠️ 기술 스택
- **Engine**: Three.js
- **Language**: TypeScript
- **Bundler**: Vite
- **Physics**: (예정) Cannon.js
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

## 🗺️ 로드맵
- [x] 기본 3D 환경 구축
- [x] 1인칭 조작 (이동, 점프, 시점)
- [x] 타겟 배치 및 점수 시스템
- [ ] 사격 및 탄약 시스템
- [ ] 재장전 애니메이션
- [ ] 적 AI (좀비/변이체) 추가
- [ ] 맵 확장 (연구소 내부)

---
© 2026 Ante Apocalypse Project. All rights reserved.
