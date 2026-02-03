# Phase 2 Migration Guide

## 개요

이 문서는 Phase 2 리팩토링에서 도입된 새로운 컴포넌트 시스템과 `CompositionalEnemyPawn` 사용 방법을 설명합니다.

## 새로운 컴포넌트

### 1. MovementComponent

서버 측 이동 로직을 담당하는 컴포넌트입니다.

#### 특징

- 속도 기반 이동
- 가속/감속 처리
- 부드러운 회전
- AI 경로 추적 지원

#### 사용법

```typescript
import { MovementComponent } from '@ante/game-core';
import { Vector3, Scene } from '@babylonjs/core';

// 생성
const movement = new MovementComponent(scene, {
  walkSpeed: 3, // 기본 걷기 속도
  runSpeed: 6, // 달리기 속도
  acceleration: 10, // 가속도
  deceleration: 8, // 감속도
  rotationSpeed: 5, // 회전 속도
  canFly: false, // 비행 가능 여부
  gravity: 9.81, // 중력
});

// Pawn에 추가
pawn.addComponent(movement);

// 이동 명령
movement.move(new Vector3(1, 0, 0)); // 방향으로 이동
movement.moveTo(targetPosition, () => {
  console.log('목표 지점 도착!');
}); // 특정 위치로 이동

// 회전
movement.lookAt(targetPosition); // 특정 지점 바라보기

// 정지
movement.stop();

// 달리기 토글
movement.setRunning(true);

// 순간 이동
movement.teleport(new Vector3(10, 0, 10));
```

#### 주요 메서드

| 메서드                         | 설명               |
| ------------------------------ | ------------------ |
| `move(direction, speed?)`      | 방향으로 이동      |
| `moveTo(position, onArrival?)` | 특정 위치로 이동   |
| `stop()`                       | 이동 정지          |
| `setRunning(running)`          | 달리기 상태 설정   |
| `lookAt(targetPoint)`          | 특정 지점 바라보기 |
| `teleport(position)`           | 순간 이동          |
| `getVelocity()`                | 현재 속도 반환     |
| `getSpeed()`                   | 현재 스피드 반환   |
| `getIsMoving()`                | 이동 중인지 확인   |

---

### 2. AIComponent

AI 행동 상태 머신을 담당하는 컴포넌트입니다.

#### 특징

- 상태 머신 (idle, patrol, chase, attack, flee, dead)
- 타겟 탐지 및 추적
- 순찰 경로 생성
- 콜백 기반 행동 정의

#### 사용법

```typescript
import { AIComponent, AITarget, AIBehaviorCallbacks } from '@ante/game-core';

// 생성
const ai = new AIComponent(scene, {
  detectionRange: 10, // 탐지 범위
  attackRange: 2, // 공격 범위
  loseInterestRange: 15, // 흥미 상실 범위
  patrolRadius: 5, // 순찰 반경
  patrolWaitTime: 2, // 순찰 대기 시간
  attackCooldown: 1, // 공격 쿨다운
});

// Pawn에 추가
pawn.addComponent(ai);

// 타겟 제공자 설정
ai.setTargetProvider(() => {
  // 가장 가까운 플레이어 반환
  return {
    id: 'player_1',
    position: playerPosition,
    isValid: true,
  };
});

// 행동 콜백 설정
const callbacks: AIBehaviorCallbacks = {
  onDetectTarget: (target: AITarget) => {
    console.log(`타겟 발견: ${target.id}`);
  },
  onLostTarget: () => {
    console.log('타겟을 잃음');
  },
  onAttack: (target: AITarget) => {
    console.log(`${target.id} 공격!`);
    // 공격 로직 실행
  },
  onPatrolStart: () => {
    console.log('순찰 시작');
  },
  onPatrolReached: () => {
    console.log('순찰 지점 도착');
  },
};

ai.setBehaviorCallbacks(callbacks);

// 강제 타겟 지정
ai.forceTarget({
  id: 'player_1',
  position: new Vector3(10, 0, 10),
  isValid: true,
});

// 상태 확인
console.log(ai.getCurrentState()); // 'idle', 'patrol', 'chase', 'attack'
```

#### AI 상태

| 상태     | 설명                 |
| -------- | -------------------- |
| `idle`   | 대기 상태, 타겟 탐색 |
| `patrol` | 순찰 중              |
| `chase`  | 타겟 추적 중         |
| `attack` | 공격 중              |
| `flee`   | 도주 중              |
| `dead`   | 사망                 |

#### 주요 메서드

| 메서드                            | 설명                |
| --------------------------------- | ------------------- |
| `setTargetProvider(provider)`     | 타겟 제공 함수 설정 |
| `setBehaviorCallbacks(callbacks)` | 행동 콜백 설정      |
| `forceTarget(target)`             | 강제 타겟 지정      |
| `clearTarget()`                   | 타겟 해제           |
| `getCurrentState()`               | 현재 상태 반환      |
| `getCurrentTarget()`              | 현재 타겟 반환      |
| `onDeath()`                       | 사망 처리           |

---

## CompositionalEnemyPawn

새로운 컴포지션 기반 EnemyPawn입니다.

### 특징

- `Pawn` 클래스 상속 (컴포지션 기반)
- `HealthComponent`로 체계 관리
- `MovementComponent`로 이동 처리
- `AIComponent`로 AI 행동 제어

### 사용법

```typescript
import { CompositionalEnemyPawn } from '@ante/game-core';
import { Scene, Vector3 } from '@babylonjs/core';

// 생성
const enemy = new CompositionalEnemyPawn(
  scene,
  'enemy_1', // ID
  new Vector3(10, 0, 10), // 위치
  {
    // Health 설정
    maxHealth: 100,
    initialHealth: 100,

    // Movement 설정
    walkSpeed: 3,
    runSpeed: 6,
    acceleration: 10,
    deceleration: 8,

    // AI 설정
    detectionRange: 10,
    attackRange: 2,
    patrolRadius: 5,
    patrolWaitTime: 2,
    attackCooldown: 1,
  }
);

// 활성화
enemy.activate();

// 타겟 설정
enemy.setTargetProvider(() => {
  // 플레이어 찾기 로직
  return findNearestPlayer();
});

// 행동 콜백 설정
enemy.setBehaviorCallbacks({
  onAttack: (target) => {
    // 공격 처리
    dealDamage(target.id, 10);
  },
});

// 상태 확인
console.log(enemy.getAIState()); // 현재 AI 상태
console.log(enemy.health); // 현재 체계
console.log(enemy.isDead); // 사망 여부
console.log(enemy.isMoving()); // 이동 중 여부
console.log(enemy.getSpeed()); // 현재 속도

// 데미지 처리
enemy.takeDamage(25, 'player_1', 'head', { x: 0, y: 1.7, z: 0 });

// 정리
enemy.dispose();
```

### ServerEnemyPawn vs CompositionalEnemyPawn

| 특성          | ServerEnemyPawn | CompositionalEnemyPawn |
| ------------- | --------------- | ---------------------- |
| 기반 클래스   | BasePawn        | Pawn                   |
| 아키텍처      | 상속 기반       | 컴포지션 기반          |
| 이동 로직     | 낶아짐          | MovementComponent      |
| AI 로직       | 외부에서 제어   | AIComponent            |
| 체계 관리     | 직접 관리       | HealthComponent        |
| 유연성        | 낮음            | 높음                   |
| 테스트 용이성 | 낮음            | 높음                   |

---

## 마이그레이션 예시

### 기존 ServerEnemyPawn 사용 코드

```typescript
import { ServerEnemyPawn } from '@ante/game-core';

// 생성
const enemy = new ServerEnemyPawn(scene, 'enemy_1', position);
enemy.health = 100;
enemy.maxHealth = 100;

// 활성화
enemy.activate();

// 이동 (직접 제어)
enemy.move(direction, speed, deltaTime);
enemy.lookAt(targetPosition);

// 데미지
enemy.takeDamage(10);
```

### 새로운 CompositionalEnemyPawn 사용 코드

```typescript
import { CompositionalEnemyPawn } from '@ante/game-core';

// 생성 (설정 통합)
const enemy = new CompositionalEnemyPawn(scene, 'enemy_1', position, {
  maxHealth: 100,
  walkSpeed: 3,
  detectionRange: 10,
  attackRange: 2,
});

// 활성화
enemy.activate();

// AI 자동 제어 (필요시 콜백만 설정)
enemy.setBehaviorCallbacks({
  onAttack: (target) => dealDamage(target.id, 10),
});

// 타겟 제공
enemy.setTargetProvider(() => getNearestPlayer());

// 데미지 (HealthComponent로 위임)
enemy.takeDamage(10);
```

---

## 타입 정의

### AITarget

```typescript
interface AITarget {
  id: string;
  position: Vector3;
  isValid: boolean;
}
```

### AIBehaviorCallbacks

```typescript
interface AIBehaviorCallbacks {
  onDetectTarget?: (target: AITarget) => void;
  onLostTarget?: () => void;
  onAttack?: (target: AITarget) => void;
  onPatrolStart?: () => void;
  onPatrolReached?: () => void;
}
```

### CompositionalEnemyPawnConfig

```typescript
interface CompositionalEnemyPawnConfig {
  maxHealth: number;
  initialHealth?: number;
  walkSpeed: number;
  runSpeed?: number;
  acceleration?: number;
  deceleration?: number;
  detectionRange: number;
  attackRange: number;
  patrolRadius?: number;
  patrolWaitTime?: number;
  attackCooldown?: number;
}
```

---

## 컴포넌트 기반 설계의 이점

### 1. 모듈성

각 기능이 독립된 컴포넌트로 분리되어 있어 개별적으로 수정/교체가 가능합니다.

```typescript
// 이동 방식 변경
pawn.removeComponent(movementComponentId);
pawn.addComponent(new FlyingMovementComponent(scene, config));
```

### 2. 재사용성

동일한 컴포넌트를 다양한 Pawn 타입에서 재사용할 수 있습니다.

```typescript
// 플레이어와 적이 같은 MovementComponent 사용
playerPawn.addComponent(new MovementComponent(scene, playerConfig));
enemyPawn.addComponent(new MovementComponent(scene, enemyConfig));
```

### 3. 테스트 용이성

각 컴포넌트를 독립적으로 단위 테스트할 수 있습니다.

```typescript
describe('MovementComponent', () => {
  it('should move to target position', () => {
    const movement = new MovementComponent(scene, { walkSpeed: 5 });
    // 테스트 로직
  });
});
```

### 4. 유연성

런타임에 컴포넌트를 추가/제거하여 동적으로 기능을 변경할 수 있습니다.

```typescript
// 버프 효과: 일시적으로 이동 속도 증가
const buffMovement = new MovementComponent(scene, { walkSpeed: 10 });
pawn.addComponent(buffMovement);

// 5초 후 원래대로
setTimeout(() => {
  pawn.removeComponent(buffMovement.componentId);
}, 5000);
```

---

## 주의사항

### 1. 컴포넌트 의존성

AIComponent는 MovementComponent에 의존합니다. 반드시 함께 추가하세요.

```typescript
// ✅ 올바른 사용
pawn.addComponent(movementComponent);
pawn.addComponent(aiComponent);

// ❌ 잘못된 사용
pawn.addComponent(aiComponent); // MovementComponent 없음 - AI 이동 불가
```

### 2. 타입 안전성

`getComponent`는 제네릭을 사용하여 타입을 지정해야 합니다.

```typescript
// ✅ 올바른 사용
const movement = pawn.getComponent<MovementComponent>('MovementComponent');

// ❌ 잘못된 사용
const movement = pawn.getComponent('MovementComponent'); // 타입: unknown
```

### 3. 생명주기 관리

Pawn을 dispose할 때 컴포넌트들도 함께 정리됩니다.

```typescript
// 모든 컴포넌트가 자동으로 dispose됨
pawn.dispose();
```

---

## 결론

Phase 2 리팩토링은 기존 상속 기반 구조에서 컴포지션 기반 구조로 전환하여 더 나은 모듈성, 테스트 용이성, 유연성을 제공합니다. `CompositionalEnemyPawn`은 이러한 아키텍처의 대표적인 예시이며, 향후 모든 Pawn 타입이 이 패턴을 따를 것을 권장합니다.
