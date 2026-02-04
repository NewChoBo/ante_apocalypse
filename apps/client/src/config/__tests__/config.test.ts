import { describe, it, expect } from 'vitest';
import {
  MovementConfig,
  AimConfig,
  WeaponConfig,
  FirearmConfig,
  WeaponMovementConfig,
} from '../index';

describe('MovementConfig', () => {
  it('should have correct walk speed', () => {
    expect(MovementConfig.WALK_SPEED).toBe(6);
  });

  it('should have correct run speed multiplier', () => {
    expect(MovementConfig.RUN_SPEED_MULTIPLIER).toBe(1.6);
  });

  it('should have correct crouch multiplier', () => {
    expect(MovementConfig.CROUCH_MULTIPLIER).toBe(0.5);
  });

  it('should have correct jump force', () => {
    expect(MovementConfig.JUMP_FORCE).toBe(9);
  });

  it('should have correct ghost speed multiplier', () => {
    expect(MovementConfig.GHOST_SPEED_MULTIPLIER).toBe(2.0);
  });

  it('should have correct gravity', () => {
    expect(MovementConfig.GRAVITY).toBe(-25);
  });

  it('run speed should be calculated correctly', () => {
    const expectedRunSpeed = MovementConfig.WALK_SPEED * MovementConfig.RUN_SPEED_MULTIPLIER;
    expect(expectedRunSpeed).toBeCloseTo(9.6);
  });
});

describe('AimConfig', () => {
  it('should have correct aim spread', () => {
    expect(AimConfig.AIM_SPREAD).toBe(0.01);
  });

  it('should have correct normal spread', () => {
    expect(AimConfig.NORMAL_SPREAD).toBe(0.05);
  });

  it('should have correct aim transition speed', () => {
    expect(AimConfig.AIM_TRANSITION_SPEED).toBe(5.0);
  });

  it('aim spread should be less than normal spread', () => {
    expect(AimConfig.AIM_SPREAD).toBeLessThan(AimConfig.NORMAL_SPREAD);
  });
});

describe('WeaponConfig', () => {
  it('should have correct default ammo multiplier', () => {
    expect(WeaponConfig.DEFAULT_AMMO_MULTIPLIER).toBe(5);
  });
});

describe('FirearmConfig', () => {
  it('should have correct magazine size', () => {
    expect(FirearmConfig.MAGAZINE_SIZE.width).toBe(0.04);
    expect(FirearmConfig.MAGAZINE_SIZE.height).toBe(0.08);
    expect(FirearmConfig.MAGAZINE_SIZE.depth).toBe(0.04);
  });

  it('should have correct magazine offset', () => {
    expect(FirearmConfig.MAGAZINE_OFFSET.x).toBe(0);
    expect(FirearmConfig.MAGAZINE_OFFSET.y).toBe(-0.1);
    expect(FirearmConfig.MAGAZINE_OFFSET.z).toBe(0);
  });

  it('should have correct magazine lifetime', () => {
    expect(FirearmConfig.MAGAZINE_LIFETIME_FRAMES).toBe(60);
  });

  it('should have correct gravity', () => {
    expect(FirearmConfig.MAGAZINE_GRAVITY).toBe(-0.01);
  });

  it('should have correct initial velocity', () => {
    expect(FirearmConfig.MAGAZINE_INITIAL_VELOCITY).toBe(-0.05);
  });

  it('should have correct rotation values', () => {
    expect(FirearmConfig.MAGAZINE_ROTATION_X).toBe(0.1);
    expect(FirearmConfig.MAGAZINE_ROTATION_Z).toBe(0.05);
  });
});

describe('WeaponMovementConfig', () => {
  it('should have correct aiming speed multiplier', () => {
    expect(WeaponMovementConfig.AIMING_SPEED_MULTIPLIER).toBe(0.4);
  });

  it('should have correct normal speed multiplier', () => {
    expect(WeaponMovementConfig.NORMAL_SPEED_MULTIPLIER).toBe(1.0);
  });

  it('should have correct melee speed multiplier', () => {
    expect(WeaponMovementConfig.MELEE_SPEED_MULTIPLIER).toBe(1.0);
  });

  it('aiming speed should be less than normal speed', () => {
    expect(WeaponMovementConfig.AIMING_SPEED_MULTIPLIER).toBeLessThan(
      WeaponMovementConfig.NORMAL_SPEED_MULTIPLIER
    );
  });
});
