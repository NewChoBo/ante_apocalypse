# 안테 아포칼립스 (Ante Apocalypse) 하이브리드 아키텍처 설계 기획서

## 1. 개요
본 문서는 Unreal Engine의 **Controller-Pawn** 구조와 Unity의 **Data-Driven (ScriptableObject)** 방식을 결합한 '하이브리드 아키텍처'를 정의합니다.

### 1.1 목표
- **논리적 분리**: 조작(판단)과 표현(물리/외형)의 완전한 분리.
- **데이터 유연성**: 밸런스 데이터를 코드와 분리하여 관리.
- **확장성**: FPS에서 TPS, 쿼터뷰로의 시점 확장 및 AI 도입 용이성 확보.

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

## 4. 디렉토리 구조 (Hybrid Layout)

```
src/
├── assets/         # 리소스 (모델, 사운드, 번역)
├── core/
│   ├── events/     # Type-safe EventBus
│   ├── persistence/# Save/Load Systems
│   ├── services/   # AuthService, LocalizationService
│   └── controllers/# PlayerController, AIController
├── components/     # ECS 컴포넌트 데이터
├── systems/        # Pawn 구현부 (PlayerPawn, EnemyPawn)
├── weapons/        # 무기 로직 분류
├── types/          # IWeapon, ITarget, IPawn 인터페이스
└── utils/          # 범용 헬퍼 및 ObjectPool
```

## 5. 아키텍처 한계점 및 개선 (Analysis)

- **추적성 문제**: 이벤트 로깅 인터셉터를 통해 해결.
- **상태 초기화(Stale State)**: `IResettable` 규약을 통한 Object Pool 초기화 강제.
- **입력 우선순위**: `InputStack` 매니저를 통한 UI/게임 간 입력 제어 전환.

## 6. 향후 로드맵
1. **1단계**: 하이브리드 구조(Controller-Pawn) 기반 FPS 리팩토링.
2. **2단계**: 데이터 중심 무기 시스템 및 밸런스 설정 구축.
3. **3단계**: 세이브/로드 및 영속성 레이어 완성.
4. **4단계**: 시각적 고도화 및 다국어 지원.
