# 안테 아포칼립스 (Ante Apocalypse) 하이브리드 아키텍처 설계 기획서

## 1. 개요

본 문서는 Unreal Engine의 **Controller-Pawn** 구조와 Unity의 **Data-Driven (ScriptableObject)** 방식을 결합한 '하이브리드 아키텍처'를 정의합니다.

### 1.1 목표

- **논리적 분리**: 조작(판단)과 표현(물리/외형)의 완전한 분리.
- **데이터 유연성**: 밸런스 데이터를 코드와 분리하여 관리.
- **확장성**: FPS에서 TPS, 쿼터뷰로의 시점 확장 및 AI 도입 용이성 확보.
- **네트워크 안정성**: Master Client 권한 기반의 검증 로직 도입.

## 2. 하이브리드 아키텍처 핵심 (Unreal + Unity)

### 2.1 Controller-Pawn 패턴 (Unreal 방식)

- **PlayerController**: 플레이어의 입력을 받아 명령을 내리는 '두뇌'입니다.
- **Pawn (BasePawn)**: 월드 내에 존재하는 물리적 실체입니다. `Controller`에 의해 빙의(Possess)되어 동작합니다.
- **이점**: 시점이 바뀌거나 플레이 중 캐릭터가 변경되어도 `Controller` 로직을 재사용할 수 있습니다.

### 2.2 Data-Driven Design (Unity ScriptableObject 방식)

- 모든 무기 스펙, 적 데이터, 게임 설정은 외부 JSON 파일(`config/`)로 관리합니다.
- **이점**: 기획적 수치 변경 시 컴파일 없이 반영 가능하며, 동일한 로직으로 다양한 데이터 기반 개체를 생성합니다.

### 2.3 Event-Driven Interface (Custom EventBus)

- 중앙 메시지 버스를 사용하되, 이벤트 페이로드에 대한 **인터페이스 강제**를 통해 타입 안전성을 확보합니다.

## 3. 주요 시스템 설계

### 3.1 무기 시스템 (OOP + Data)

- **IWeapon / BaseWeapon**: 사격, 재장전 등의 공통 행위 정의.
- **WeaponData**: JSON에서 불러온 무기 스탯(데미지, 사거리 등)을 `BaseWeapon`에 주입.

### 3.2 영속성 및 서비스 레이어

- **AuthService**: 유저 세션 및 프로필 관리.
- **SaveSystem**: `LocalStorage`를 활용한 데이터 직렬화/역직렬화.
- **Localization**: (추후) 다국어 지원 프레임워크 기반 마련.

## 4. 네트워크 아키텍처 (Master Client Authority) [NEW]

Photon Cloud(Free Tier) 환경에서 Dedicated Server 없이 신뢰성 있는 멀티플레이를 구현하기 위해 **Master Client**를 가상의 권한 서버로 활용합니다.

### 4.1 권한(Authority) 분리 모델

- **Local Client (Input)**:
  - 유저 입력을 `NetworkManager`로 전송 (`REQ_FIRE`, `REQ_HIT`).
  - 시각/청각적 즉각 반응(Prediction)만 수행하며, 실제 게임 상태(HP, 점수 등)는 변경하지 않음.
- **Master Client (Server Logic)**:
  - 모든 클라이언트의 요청(`REQ_...`)을 수신하여 유효성 검증(탄환 수, 쿨타임, 히트 판정).
  - 검증 통과 시 확정 이벤트(`FIRE`, `CONFIRM_HIT`)를 브로드캐스트.
- **Remote Client (View)**:
  - 확정된 이벤트를 수신하여 시각 효과 재생 및 상태 업데이트.

### 4.2 단방향 데이터 흐름 (Unidirectional Data Flow)

이벤트 혼선을 막기 위해 데이터는 한 방향으로만 흐릅니다.

> **Input** → **Network Request** → **Master Logic** → **Network Broadcast** → **GameObservables** → **View/Audio**

### 4.3 핵심 이벤트 흐름 예시

1. **발사 (Fire)**:
   - `Input` -> `Firearm.fire()` (예측 사운드 재생) -> `NetworkManager.requestFire()`
   - (Master) `OnEvent(REQ_FIRE)` -> 검증 -> `SendEvent(FIRE)`
   - (All) `OnEvent(FIRE)` -> `GameObservables.weaponFire.notify()` -> 총구 화염/탄피 효과
2. **피격 (Hit)**:
   - `Firearm.performRaycast()` -> 충돌 감지 -> `NetworkManager.requestHit()`
   - (Master) `OnEvent(REQ_HIT)` -> 거리/지형 검증 -> HP 차감 -> `SendEvent(CONFIRM_HIT)`
   - (All) `OnEvent(CONFIRM_HIT)` -> `GameObservables.targetHit.notify()` -> HP바 갱신/사망 처리

## 5. 디렉토리 구조 (Hybrid Layout)

```
src/
├── assets/         # 리소스 (모델, 사운드, 번역)
├── core/
│   ├── events/     # Type-safe EventBus & GameObservables
│   ├── network/    # NetworkManager, Protocol (Req/Res Pattern)
│   ├── persistence/# Save/Load Systems
│   ├── services/   # AuthService, LocalizationService
│   └── controllers/# PlayerController, AIController
├── components/     # ECS 컴포넌트 데이터 (Combat, Movement)
├── systems/        # Pawn 구현부 (PlayerPawn, EnemyPawn)
├── weapons/        # 무기 로직 분류 (Firearm, Melee)
├── types/          # IWeapon, ITarget, IPawn 인터페이스
└── utils/          # 범용 헬퍼 및 ObjectPool
```

## 6. 아키텍처 한계점 및 개선 (Analysis)

- **추적성 문제**: 이벤트 로깅 인터셉터를 통해 해결.
- **상태 초기화(Stale State)**: `IResettable` 규약을 통한 Object Pool 초기화 강제.
- **레이턴시**: Master Client 권한 위임으로 인한 RTT 지연 발생 가능 -> Client-side Prediction(예측)으로 시각적 보정 필수.

## 7. 향후 로드맵

1. **1단계**: 하이브리드 구조(Controller-Pawn) 기반 FPS 리팩토링. (완료)
2. **2단계**: 데이터 중심 무기 시스템 및 밸런스 설정 구축. (완료)
3. **3단계**: **네트워크 권한 분리 및 이벤트 전파 구조 리팩토링.** (진행 중)
4. **4단계**: 세이브/로드 및 영속성 레이어 완성.
5. **5단계**: 시각적 고도화 및 다국어 지원.
