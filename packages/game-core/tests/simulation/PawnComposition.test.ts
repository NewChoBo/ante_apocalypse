import { describe, it, expect, beforeEach } from 'vitest';
import { NullEngine, Scene, Vector3 } from '@babylonjs/core';
import { IPawnComponent } from '@ante/common';
import { MovementComponent } from '../../src/simulation/components/MovementComponent.js';
import { AIComponent } from '../../src/simulation/components/AIComponent.js';
import { HealthComponent } from '../../src/simulation/components/HealthComponent.js';

/**
 * Mock Pawn for testing composition
 */
class MockPawn {
  public id = `test_pawn_${Math.random().toString(36).substr(2, 9)}`;
  public position: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
  public rotation: { y: number } = { y: 0 };
  public isDead = false;

  private components: Map<string, IPawnComponent<any>> = new Map();

  public addComponent<T>(component: IPawnComponent<T>): void {
    component.onAttach(this as any);
    this.components.set(component.componentType, component);
  }

  public getComponent<T>(componentType: string): T | undefined {
    return this.components.get(componentType) as T | undefined;
  }
}

/**
 * Integration tests for Pawn + Component composition
 */
describe('Pawn + Component Integration', () => {
  let engine: NullEngine;
  let scene: Scene;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
  });

  describe('Basic Pawn with MovementComponent', () => {
    it('should attach MovementComponent and use it for movement', () => {
      const pawn = new MockPawn();
      const movement = new MovementComponent(scene, {
        walkSpeed: 5,
        runSpeed: 10,
        componentId: 'test_movement',
      });

      pawn.addComponent(movement);
      movement.onAttach(pawn as any);

      // Initial state
      expect(movement.getIsMoving()).toBe(false);
      expect(movement.getSpeed()).toBe(0);

      // Move
      const direction = new Vector3(1, 0, 0);
      movement.move(direction, 5);

      // After move, state should indicate movement
      expect(movement.getIsMoving()).toBe(true);

      // Verify target velocity is set
      const state = movement.getState();
      expect(state.isMoving).toBe(true);
    });

    it('should handle movement lifecycle properly', () => {
      const pawn = new MockPawn();
      const movement = new MovementComponent(scene, {
        walkSpeed: 6,
        runSpeed: 12,
      });

      pawn.addComponent(movement);
      movement.onAttach(pawn as any);

      // Start moving
      movement.move(new Vector3(0, 0, 1), 6);
      expect(movement.getIsMoving()).toBe(true);

      // Stop
      movement.stop();
      expect(movement.getIsMoving()).toBe(false);
      expect(movement.getSpeed()).toBe(0);
    });

    it('should handle running state toggle', () => {
      const pawn = new MockPawn();
      const movement = new MovementComponent(scene, {
        walkSpeed: 5,
        runSpeed: 10,
      });

      pawn.addComponent(movement);
      movement.onAttach(pawn as any);

      movement.move(new Vector3(1, 0, 0), 5);
      expect(movement.getIsMoving()).toBe(true);

      movement.setRunning(true);
      expect(movement.getIsRunning()).toBe(true);
    });
  });

  describe('Pawn with Multiple Components', () => {
    it('should support multiple components on same pawn', () => {
      const pawn = new MockPawn();

      const movement = new MovementComponent(scene, { walkSpeed: 5 });
      const health = new HealthComponent({
        maxHealth: 100,
        componentId: 'test_health',
      });

      pawn.addComponent(movement);
      pawn.addComponent(health);

      // Both components should be retrievable
      const retrievedMovement = pawn.getComponent<MovementComponent>('MovementComponent');
      const retrievedHealth = pawn.getComponent<HealthComponent>('HealthComponent');

      expect(retrievedMovement).toBeDefined();
      expect(retrievedHealth).toBeDefined();
      expect(retrievedHealth?.health).toBe(100);
    });

    it('should allow components to interact through pawn', () => {
      const pawn = new MockPawn();

      const movement = new MovementComponent(scene, { walkSpeed: 5 });
      const health = new HealthComponent({ maxHealth: 100 });

      pawn.addComponent(movement);
      pawn.addComponent(health);
      expect(movement.getIsMoving()).toBe(false);
    });

    it('should handle component lifecycle properly', () => {
      const pawn = new MockPawn();

      const movement = new MovementComponent(scene, { walkSpeed: 5 });
      const ai = new AIComponent(scene, {
        detectionRange: 20,
        attackRange: 2,
        componentId: 'test_ai',
      });

      pawn.addComponent(movement);
      pawn.addComponent(ai);

      // Update both
      movement.update(0.016);
      ai.update(0.016);

      // Dispose
      movement.dispose();
    });
  });

  describe('AIComponent + MovementComponent Integration', () => {
    it('should integrate AI decisions with movement', () => {
      const pawn = new MockPawn();
      const movement = new MovementComponent(scene, { walkSpeed: 5, runSpeed: 10 });
      const ai = new AIComponent(scene, {
        detectionRange: 20,
        attackRange: 2,
        componentId: 'test_ai',
      });

      pawn.addComponent(movement);
      pawn.addComponent(ai);

      // AI sets target with AITarget format
      ai.forceTarget({
        id: 'test_target',
        position: new Vector3(10, 0, 10),
        isValid: true,
      });

      // AI should be in chase state
      expect((ai as any).currentState).toBe('chase');

      // Update loop should trigger movement
      ai.update(0.016);
      movement.update(0.016);

      // Pawn should now be moving towards target
      expect(movement.getIsMoving()).toBe(true);
    });

    it('should handle AI state transitions with movement', () => {
      const pawn = new MockPawn();
      const movement = new MovementComponent(scene, { walkSpeed: 5 });
      const ai = new AIComponent(scene, {
        detectionRange: 20,
        attackRange: 2,
        componentId: 'test_ai',
      });

      pawn.addComponent(movement);
      pawn.addComponent(ai);

      // Initial state - idle
      expect((ai as any).currentState).toBe('idle');

      // Set target - chase
      ai.forceTarget({
        id: 'test_target',
        position: new Vector3(5, 0, 5),
        isValid: true,
      });
      expect((ai as any).currentState).toBe('chase');

      // Clear target - idle
      ai.clearTarget();
      expect((ai as any).currentState).toBe('idle');

      // Death state - movement should stop
      ai.forceTarget({
        id: 'test_target',
        position: new Vector3(5, 0, 5),
        isValid: true,
      });
      expect((ai as any).currentState).toBe('chase');

      ai.onDeath();
      expect((ai as any).currentState).toBe('dead');
    });
  });

  describe('HealthComponent Integration', () => {
    it('should report health status correctly', () => {
      const pawn = new MockPawn();
      const health = new HealthComponent({
        maxHealth: 100,
        componentId: 'test_health',
      });

      pawn.addComponent(health);

      expect(health.health).toBe(100);
      expect(health.maxHealth).toBe(100);
      expect(health.healthPercent).toBe(1.0);
    });

    it('should handle damage correctly', () => {
      const pawn = new MockPawn();
      const health = new HealthComponent({
        maxHealth: 100,
        componentId: 'test_health',
      });

      pawn.addComponent(health);

      health.takeDamage(25);
      expect(health.health).toBe(75);
      expect(health.isDead).toBe(false);

      health.takeDamage(75);
      expect(health.health).toBe(0);
      expect(health.isDead).toBe(true);
    });

    it('should handle healing correctly', () => {
      const pawn = new MockPawn();
      const health = new HealthComponent({
        maxHealth: 100,
        componentId: 'test_health',
      });

      pawn.addComponent(health);

      health.takeDamage(30);
      health.heal(20);

      expect(health.health).toBe(90);
    });

    it('should not exceed max health when healing', () => {
      const pawn = new MockPawn();
      const health = new HealthComponent({
        maxHealth: 100,
        componentId: 'test_health',
      });

      pawn.addComponent(health);

      health.takeDamage(10);
      health.heal(50);

      expect(health.health).toBe(100);
    });
  });

  describe('Component Communication', () => {
    it('should allow AI to trigger damage on attack', () => {
      const targetPawn = new MockPawn();
      const targetHealth = new HealthComponent({
        maxHealth: 100,
        componentId: 'target_health',
      });

      targetPawn.addComponent(targetHealth);

      // Simulate attack
      targetHealth.takeDamage(25);

      expect(targetHealth.health).toBe(75);
      expect(targetHealth.isDead).toBe(false);

      // Kill target
      targetHealth.takeDamage(75);
      expect(targetHealth.health).toBe(0);
      expect(targetHealth.isDead).toBe(true);
    });
  });
});
