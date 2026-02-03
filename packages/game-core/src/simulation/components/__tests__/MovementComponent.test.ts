import { describe, it, expect, beforeEach } from 'vitest';
import { NullEngine, Scene, Vector3 } from '@babylonjs/core';
import { MovementComponent, MovementConfig, MovementState } from '../MovementComponent.js';
import { IMovable } from '../interfaces/IMovable.js';
import { IPawn } from '@ante/common';

/**
 * MovementComponent 단위 테스트
 *
 * 테스트 전략:
 * 1. 순수 함수 테스트 (계산 로직)
 * 2. 상태 전이 테스트 (move -> stop)
 * 3. IMovable 인터페이스 준수 테스트
 * 4. 경계 조건 테스트 (zero vector, null owner)
 */

describe('MovementComponent', () => {
  let engine: NullEngine;
  let scene: Scene;
  let component: MovementComponent;
  let mockPawn: IPawn;

  const defaultConfig: MovementConfig = {
    walkSpeed: 5,
    runSpeed: 10,
    acceleration: 10,
    deceleration: 8,
    rotationSpeed: 5,
  };

  beforeEach(() => {
    // NullEngine으로 헤드리스 테스트
    engine = new NullEngine();
    scene = new Scene(engine);

    // Mock Pawn 생성
    mockPawn = {
      id: 'test-pawn',
      type: 'enemy',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      health: 100,
      maxHealth: 100,
      isDead: false,
      isActive: true,
      mesh: null,
      addComponent: () => {},
      removeComponent: () => {},
      getComponent: () => undefined,
      getAllComponents: () => [],
      hasComponent: () => false,
      takeDamage: () => {},
      die: () => {},
      tick: () => {},
      dispose: () => {},
    };

    component = new MovementComponent(scene, defaultConfig);
    component.onAttach(mockPawn);
  });

  describe('인터페이스 준수', () => {
    it('IMovable 인터페이스를 구현해야 함', () => {
      const movable: IMovable = component;
      expect(movable).toBeDefined();
      expect(typeof movable.move).toBe('function');
      expect(typeof movable.moveTo).toBe('function');
      expect(typeof movable.stop).toBe('function');
      expect(typeof movable.lookAt).toBe('function');
      expect(typeof movable.teleport).toBe('function');
      expect(typeof movable.getVelocity).toBe('function');
      expect(typeof movable.getSpeed).toBe('function');
      expect(typeof movable.getIsMoving).toBe('function');
      expect(typeof movable.getRemainingDistance).toBe('function');
    });

    it('IPawnComponent 인터페이스를 구현해야 함', () => {
      expect(component.componentId).toBeDefined();
      expect(component.componentType).toBe('MovementComponent');
      expect(component.isActive).toBe(true);
      expect(typeof component.onAttach).toBe('function');
      expect(typeof component.update).toBe('function');
      expect(typeof component.onDetach).toBe('function');
      expect(typeof component.dispose).toBe('function');
    });
  });

  describe('초기화', () => {
    it('설정값으로 초기화되어야 함', () => {
      expect(component.getIsMoving()).toBe(false);
      expect(component.getSpeed()).toBe(0);
      expect(component.getIsRunning()).toBe(false);
    });

    it('componentId가 생성되어야 함', () => {
      expect(component.componentId).toContain('movement_');
    });

    it('custom componentId를 사용할 수 있어야 함', () => {
      const customComponent = new MovementComponent(scene, {
        ...defaultConfig,
        componentId: 'custom-movement',
      });
      expect(customComponent.componentId).toBe('custom-movement');
    });
  });

  describe('이동', () => {
    it('move() 호출 시 이동 상태가 되어야 함', () => {
      component.move(new Vector3(1, 0, 0));
      expect(component.getIsMoving()).toBe(true);
    });

    it('stop() 호출 시 정지 상태가 되어야 함', () => {
      component.move(new Vector3(1, 0, 0));
      expect(component.getIsMoving()).toBe(true);

      component.stop();
      expect(component.getIsMoving()).toBe(false);
    });

    it('zero vector로 move() 호출 시 정지해야 함', () => {
      component.move(new Vector3(0, 0, 0));
      expect(component.getIsMoving()).toBe(false);
    });

    it('정지 후 속도가 0이어야 함', () => {
      component.move(new Vector3(1, 0, 0));
      component.stop();

      // 감속 업데이트
      component.update(1.0);

      expect(component.getSpeed()).toBe(0);
    });
  });

  describe('속도', () => {
    it('walkSpeed로 이동 시 정확한 속도를 반환해야 함', () => {
      component.move(new Vector3(1, 0, 0));

      // 충분한 시간 동안 가속
      component.update(10.0);

      expect(component.getSpeed()).toBeCloseTo(defaultConfig.walkSpeed, 1);
    });

    it('runSpeed로 이동 시 정확한 속도를 반환해야 함', () => {
      component.setRunning(true);
      component.move(new Vector3(1, 0, 0));

      // 충분한 시간 동안 가속
      component.update(10.0);

      expect(component.getSpeed()).toBeCloseTo(defaultConfig.runSpeed!, 1);
    });

    it('달리기 상태 전환이 가능해야 함', () => {
      component.move(new Vector3(1, 0, 0));
      expect(component.getIsRunning()).toBe(false);

      component.setRunning(true);
      expect(component.getIsRunning()).toBe(true);

      component.setRunning(false);
      expect(component.getIsRunning()).toBe(false);
    });
  });

  describe('위치 계산', () => {
    it('teleport()로 위치를 즉시 변경해야 함', () => {
      const newPosition = new Vector3(10, 5, 10);
      component.teleport(newPosition);

      expect(mockPawn.position.x).toBe(10);
      expect(mockPawn.position.y).toBe(5);
      expect(mockPawn.position.z).toBe(10);
    });

    it('update() 호출 시 위치가 변경되어야 함', () => {
      component.move(new Vector3(1, 0, 0));

      // 가속 완료를 위한 충분한 시간
      component.update(10.0);

      const initialX = mockPawn.position.x;

      // 1초 동안 이동
      component.update(1.0);

      expect(mockPawn.position.x).toBeGreaterThan(initialX);
    });

    it('getRemainingDistance()가 정확한 거리를 반환해야 함', () => {
      const target = new Vector3(10, 0, 0);
      const distance = component.getRemainingDistance(target);

      expect(distance).toBe(10);
    });
  });

  describe('회전', () => {
    it('lookAt()으로 특정 지점을 바라봐야 함', () => {
      const target = new Vector3(0, 0, 10);
      component.lookAt(target);

      // Y축 회전이 0에 가까워야 함 (정면)
      expect(mockPawn.rotation.y).toBeCloseTo(0, 1);
    });

    it('lookAt()으로 뒤를 볼 수 있어야 함', () => {
      const target = new Vector3(0, 0, -10);
      component.lookAt(target);

      // Y축 회전이 π에 가까워야 함 (뒤)
      expect(Math.abs(mockPawn.rotation.y)).toBeCloseTo(Math.PI, 1);
    });
  });

  describe('moveTo()', () => {
    it('moveTo()로 목표 지점을 향해 이동해야 함', () => {
      const target = new Vector3(10, 0, 0);
      component.moveTo(target);

      expect(component.getIsMoving()).toBe(true);
    });

    it('이미 도착한 경우 onArrival가 즉시 호출되어야 함', () => {
      mockPawn.position = { x: 10, y: 0, z: 10 };
      const target = new Vector3(10, 0, 10);

      let arrived = false;
      component.moveTo(target, () => {
        arrived = true;
      });

      expect(arrived).toBe(true);
    });
  });

  describe('상태 관리', () => {
    it('getState()가 전체 상태를 반환해야 함', () => {
      component.move(new Vector3(1, 0, 0));
      component.update(1.0);

      const state: MovementState = component.getState();

      expect(state).toHaveProperty('velocity');
      expect(state).toHaveProperty('isMoving');
      expect(state).toHaveProperty('speed');
      expect(state).toHaveProperty('isRunning');
    });
  });

  describe('경계 조건', () => {
    it('owner가 없을 때 move()가 조용히 실패해야 함', () => {
      component.onDetach();
      expect(() => component.move(new Vector3(1, 0, 0))).not.toThrow();
    });

    it('isActive가 false일 때 update()가 실행되지 않아야 함', () => {
      component.move(new Vector3(1, 0, 0));
      component.isActive = false;

      const initialX = mockPawn.position.x;
      component.update(1.0);

      expect(mockPawn.position.x).toBe(initialX);
    });

    it('dispose() 후 정리되어야 함', () => {
      component.dispose();
      expect(component.getIsMoving()).toBe(false);
    });
  });

  describe('중력', () => {
    it('기본적으로 중력이 적용되어야 함', () => {
      mockPawn.position.y = 10;
      component.move(new Vector3(0, 1, 0)); // 위로 이동 시도

      component.update(0.1);

      // 중력 적용 확인 (양수 값이 작아짐)
      expect(component.getVelocity().y).toBeLessThan(1);
    });

    it('canFly가 true일 때 중력이 무시되어야 함', () => {
      const flyingComponent = new MovementComponent(scene, {
        ...defaultConfig,
        canFly: true,
      });
      flyingComponent.onAttach(mockPawn);

      mockPawn.position.y = 10;
      flyingComponent.update(0.1);

      // 중력 무시
      expect(flyingComponent.getVelocity().y).toBe(0);
    });
  });
});
