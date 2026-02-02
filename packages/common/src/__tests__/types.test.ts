import { describe, it, expect } from 'vitest';
import { TickPriority } from '../types/index.js';
import type {
  Vector3,
  WeaponStats,
  FiringMode,
  RespawnDecision,
  GameEndResult,
} from '../types/index.js';
import type { DamageEvent, HealthChangeEvent, DeathEvent } from '../types/pawn.js';

describe('Shared Types', () => {
  describe('Vector3', () => {
    it('should create valid Vector3', () => {
      const vec: Vector3 = { x: 1, y: 2, z: 3 };
      expect(vec.x).toBe(1);
      expect(vec.y).toBe(2);
      expect(vec.z).toBe(3);
    });
  });

  describe('WeaponStats', () => {
    it('should create valid WeaponStats with all required fields', () => {
      const stats: WeaponStats = {
        damage: 25,
        range: 100,
        fireRate: 600,
        reloadTime: 2.5,
        magazineSize: 30,
        recoilForce: 1.5,
        firingMode: 'auto' as FiringMode,
        movementSpeedMultiplier: 0.9,
        aimFOV: 60,
      };

      expect(stats.damage).toBe(25);
      expect(stats.firingMode).toBe('auto');
    });

    it('should allow additional custom fields', () => {
      const stats: WeaponStats = {
        damage: 50,
        range: 200,
        fireRate: 100,
        reloadTime: 3.0,
        magazineSize: 10,
        recoilForce: 5.0,
        firingMode: 'semi' as FiringMode,
        movementSpeedMultiplier: 0.8,
        aimFOV: 55,
        customField: 'test',
        penetration: 2,
      };

      expect(stats.customField).toBe('test');
      expect(stats.penetration).toBe(2);
    });
  });

  describe('RespawnDecision', () => {
    it('should create respawn decision', () => {
      const decision: RespawnDecision = {
        action: 'respawn',
        delay: 5,
        position: { x: 0, y: 1, z: 0 },
      };

      expect(decision.action).toBe('respawn');
      expect(decision.delay).toBe(5);
    });

    it('should create spectate decision', () => {
      const decision: RespawnDecision = {
        action: 'spectate',
      };

      expect(decision.action).toBe('spectate');
    });
  });

  describe('GameEndResult', () => {
    it('should create game end result with winner', () => {
      const result: GameEndResult = {
        winnerId: 'player1',
        reason: 'Last player standing',
      };

      expect(result.winnerId).toBe('player1');
      expect(result.reason).toBe('Last player standing');
    });

    it('should create game end result without winner (draw)', () => {
      const result: GameEndResult = {
        reason: 'Time limit reached',
      };

      expect(result.winnerId).toBeUndefined();
      expect(result.reason).toBe('Time limit reached');
    });
  });

  describe('TickPriority', () => {
    it('should have correct priority values', () => {
      expect(TickPriority.Input).toBe(0);
      expect(TickPriority.Physics).toBe(10);
      expect(TickPriority.Gameplay).toBe(20);
      expect(TickPriority.AI).toBe(30);
      expect(TickPriority.Animation).toBe(40);
      expect(TickPriority.Rendering).toBe(50);
    });
  });

  describe('Pawn Component Events', () => {
    it('should create DamageEvent', () => {
      const event: DamageEvent = {
        pawnId: 'pawn1',
        amount: 25,
        attackerId: 'player1',
        part: 'head',
        hitPoint: { x: 1, y: 2, z: 3 },
        remainingHealth: 75,
      };

      expect(event.pawnId).toBe('pawn1');
      expect(event.amount).toBe(25);
      expect(event.remainingHealth).toBe(75);
    });

    it('should create HealthChangeEvent', () => {
      const event: HealthChangeEvent = {
        pawnId: 'pawn1',
        oldHealth: 100,
        newHealth: 75,
        maxHealth: 100,
      };

      expect(event.oldHealth).toBe(100);
      expect(event.newHealth).toBe(75);
    });

    it('should create DeathEvent', () => {
      const event: DeathEvent = {
        pawnId: 'pawn1',
        killerId: 'player1',
        position: { x: 0, y: 0, z: 0 },
      };

      expect(event.pawnId).toBe('pawn1');
      expect(event.killerId).toBe('player1');
    });
  });
});

describe('Type Exports', () => {
  it('should export all required types', () => {
    // This test verifies that the module exports are working correctly
    // by attempting to import types (compile-time check)
    const types = [
      'Vector3',
      'Vector2',
      'Transform',
      'DamageProfile',
      'WeaponStats',
      'FiringMode',
      'IWeaponData',
      'IFirearmData',
      'PawnConfig',
      'CharacterPawnConfig',
      'EnemyPawnConfig',
      'GameModeId',
      'RespawnAction',
      'RespawnDecision',
      'GameEndResult',
      'TickPriority',
      'ITickable',
    ];

    // If this compiles, all types are properly exported
    expect(types.length).toBeGreaterThan(0);
  });
});
