import { describe, it, expect, beforeEach } from 'vitest';
import { NullEngine, Scene, Vector3 } from '@babylonjs/core';
import {
  AIComponent,
  AIConfig,
  AITarget,
  AIBehaviorCallbacks,
} from '../../src/simulation/components/AIComponent.js';
import {
  MovementComponent,
  MovementConfig,
} from '../../src/simulation/components/MovementComponent.js';
import { isMovable } from '../../src/simulation/components/interfaces/IMovable.js';
import { IPawnComponent, IPawn } from '@ante/common';

/**
 * AIComponent 단위 테스트
 */

describe('AIComponent', () => {
  let engine: NullEngine;
  let scene: Scene;
  let aiComponent: AIComponent;
  let movementComponent: MovementComponent;
  let mockPawn: IPawn;

  const defaultAIConfig: AIConfig = {
    detectionRange: 10,
    attackRange: 2,
    patrolRadius: 5,
    patrolWaitTime: 1,
    attackCooldown: 0.5,
  };

  const defaultMovementConfig: MovementConfig = {
    walkSpeed: 5,
    runSpeed: 10,
    acceleration: 10,
    deceleration: 8,
  };

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);

    // MovementComponent 먼저 생성
    movementComponent = new MovementComponent(scene, defaultMovementConfig);

    // Mock Pawn 생성
    mockPawn = {
      id: 'test-enemy',
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
      getComponent: ((_type: string) => movementComponent) as <T extends IPawnComponent>(
        _type: string
      ) => T | undefined,
      getAllComponents: () => [movementComponent as unknown as IPawnComponent],
      hasComponent: () => true,
      takeDamage: () => {},
      die: () => {},
      tick: () => {},
      dispose: () => {},
    };

    movementComponent.onAttach(mockPawn);

    // AIComponent 생성
    aiComponent = new AIComponent(scene, defaultAIConfig);
    aiComponent.onAttach(mockPawn);
  });

  describe('초기화', () => {
    it('초기 상태가 idle이어야 함', () => {
      expect(aiComponent.getCurrentState()).toBe('idle');
    });

    it('componentId가 생성되어야 함', () => {
      expect(aiComponent.componentId).toContain('ai_');
    });

    it('custom componentId를 사용할 수 있어야 함', () => {
      const customAI = new AIComponent(scene, {
        ...defaultAIConfig,
        componentId: 'custom-ai',
      });
      expect(customAI.componentId).toBe('custom-ai');
    });
  });

  describe('상태 전이', () => {
    it('forceTarget()로 chase 상태로 전환할 수 있어야 함', () => {
      const target: AITarget = {
        id: 'player-1',
        position: new Vector3(5, 0, 5),
        isValid: true,
      };

      aiComponent.forceTarget(target);

      expect(aiComponent.getCurrentState()).toBe('chase');
    });

    it('clearTarget()로 idle 상태로 전환할 수 있어야 함', () => {
      const target: AITarget = {
        id: 'player-1',
        position: new Vector3(5, 0, 5),
        isValid: true,
      };

      aiComponent.forceTarget(target);
      expect(aiComponent.getCurrentState()).toBe('chase');

      aiComponent.clearTarget();
      expect(aiComponent.getCurrentState()).toBe('idle');
    });

    it('setState()로 직접 상태를 설정할 수 있어야 함', () => {
      aiComponent.setState('patrol');
      expect(aiComponent.getCurrentState()).toBe('patrol');

      aiComponent.setState('dead');
      expect(aiComponent.getCurrentState()).toBe('dead');
    });

    it('onDeath()로 dead 상태로 전환할 수 있어야 함', () => {
      aiComponent.onDeath();
      expect(aiComponent.getCurrentState()).toBe('dead');
    });
  });

  describe('타겟 관리', () => {
    it('forceTarget()로 타겟을 설정할 수 있어야 함', () => {
      const target: AITarget = {
        id: 'player-1',
        position: new Vector3(5, 0, 5),
        isValid: true,
      };

      aiComponent.forceTarget(target);

      expect(aiComponent.getCurrentTarget()?.id).toBe('player-1');
    });

    it('getCurrentTarget()가 현재 타겟을 반환해야 함', () => {
      const target: AITarget = {
        id: 'player-1',
        position: new Vector3(5, 0, 5),
        isValid: true,
      };

      aiComponent.forceTarget(target);

      expect(aiComponent.getCurrentTarget()).toEqual(target);
    });

    it('getDistanceToTarget()가 정확한 거리를 반환해야 함', () => {
      const target: AITarget = {
        id: 'player-1',
        position: new Vector3(3, 0, 4), // 거리 = 5
        isValid: true,
      };

      aiComponent.forceTarget(target);

      expect(aiComponent.getDistanceToTarget()).toBeCloseTo(5, 0);
    });
  });

  describe('콜백', () => {
    it('setBehaviorCallbacks()로 콜백을 설정할 수 있어야 함', () => {
      const callbacks: AIBehaviorCallbacks = {
        onDetectTarget: () => {},
        onLostTarget: () => {},
        onAttack: () => {},
        onPatrolStart: () => {},
        onPatrolReached: () => {},
      };

      expect(() => aiComponent.setBehaviorCallbacks(callbacks)).not.toThrow();
    });

    it('onDetectTarget 콜백이 트리거되어야 함', () => {
      let detectCalled = false;

      aiComponent.setBehaviorCallbacks({
        onDetectTarget: () => {
          detectCalled = true;
        },
      });

      const target: AITarget = {
        id: 'player-1',
        position: new Vector3(5, 0, 5),
        isValid: true,
      };

      // chase 상태로 전환 (onDetectTarget 트리거)
      aiComponent.forceTarget(target);
      expect(detectCalled).toBe(true);
    });
  });

  describe('타겟 제공자', () => {
    it('setTargetProvider()로 타겟 제공자를 설정할 수 있어야 함', () => {
      const provider = (): AITarget | null => ({
        id: 'dynamic-target',
        position: new Vector3(10, 0, 10),
        isValid: true,
      });

      aiComponent.setTargetProvider(provider);
      aiComponent.update(0.1);

      expect(aiComponent.getCurrentTarget()?.id).toBe('dynamic-target');
    });

    it('provider가 null을 반환하면 타겟이 해제되어야 함', () => {
      const provider = (): null => null;

      aiComponent.setTargetProvider(provider);
      aiComponent.update(0.1);

      expect(aiComponent.getCurrentTarget()).toBeNull();
    });
  });

  describe('IMovable 의존성', () => {
    it('MovementComponent가 IMovable로 인식되어야 함', () => {
      expect(isMovable(movementComponent)).toBe(true);
    });

    it('AIComponent가 MovementComponent를 찾아야 함', () => {
      const pawnWithoutMovement: IPawn = {
        ...mockPawn,
        getComponent: () => undefined,
        getAllComponents: () => [],
      };

      const aiWithoutMovement = new AIComponent(scene, defaultAIConfig);
      aiWithoutMovement.onAttach(pawnWithoutMovement);

      expect(() => aiWithoutMovement.update(0.1)).not.toThrow();
    });
  });

  describe('상태별 동작', () => {
    it('patrol 상태에서 순찰 지점을 선택해야 함', () => {
      aiComponent.setState('patrol');
      expect(aiComponent.getCurrentState()).toBe('patrol');
    });

    it('attack 상태에서 이동이 정지해야 함', () => {
      const target: AITarget = {
        id: 'player-1',
        position: new Vector3(1, 0, 0),
        isValid: true,
      };

      aiComponent.forceTarget(target);
      mockPawn.position = { x: 1.5, y: 0, z: 0 };

      aiComponent.update(0.1);

      expect(aiComponent.getCurrentState()).toBe('attack');
    });

    it('dead 상태에서 모든 동작이 정지해야 함', () => {
      aiComponent.onDeath();

      const prevState = aiComponent.getCurrentState();
      aiComponent.update(1.0);

      expect(aiComponent.getCurrentState()).toBe(prevState);
    });
  });

  describe('수동 의존성 주입', () => {
    it('setMovable()로 수동으로 IMovable를 주입할 수 있어야 함', () => {
      const newMovement = new MovementComponent(scene, defaultMovementConfig);
      const pawn: IPawn = {
        ...mockPawn,
        getComponent: () => undefined,
      };

      const newAI = new AIComponent(scene, defaultAIConfig);
      newAI.setMovable(newMovement);
      newAI.onAttach(pawn);

      expect(() => newAI.update(0.1)).not.toThrow();
    });
  });

  describe('경계 조건', () => {
    it('isActive가 false일 때 update()가 실행되지 않아야 함', () => {
      aiComponent.isActive = false;
      const prevState = aiComponent.getCurrentState();

      aiComponent.update(1.0);

      expect(aiComponent.getCurrentState()).toBe(prevState);
    });

    it('dispose() 후 정리되어야 함', () => {
      aiComponent.dispose();

      expect(aiComponent.getCurrentState()).toBe('idle');
    });

    it('owner 없이 update()가 조용히 실패해야 함', () => {
      aiComponent.onDetach();

      expect(() => aiComponent.update(0.1)).not.toThrow();
    });
  });
});
