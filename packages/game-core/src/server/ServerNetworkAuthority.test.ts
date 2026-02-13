import { Vector3 } from '@babylonjs/core';
import { EventCode, HitEventData } from '@ante/common';
import { describe, expect, it, vi } from 'vitest';
import { ServerNetworkAuthority } from './ServerNetworkAuthority.js';
import { IWorldEntity } from '../types/IWorldEntity.js';

function createPlayerEntity(health: number): IWorldEntity {
  return {
    id: 'target',
    mesh: {} as never,
    position: new Vector3(0, 0, 0),
    rotation: new Vector3(0, 0, 0),
    name: 'Target',
    type: 'player',
    health,
    maxHealth: 100,
    isActive: true,
    isDead: false,
    weaponId: 'Pistol',
    takeDamage: (): void => undefined,
    die: (): void => undefined,
    dispose: (): void => undefined,
  };
}

function createEnemyEntity(health: number): IWorldEntity {
  return {
    id: 'enemy',
    mesh: {} as never,
    position: new Vector3(0, 0, 0),
    rotation: new Vector3(0, 0, 0),
    name: 'Enemy',
    type: 'enemy',
    health,
    maxHealth: 100,
    isActive: true,
    isDead: false,
    takeDamage: (): void => undefined,
    die: (): void => undefined,
    dispose: (): void => undefined,
  };
}

describe('ServerNetworkAuthority broadcast flow', () => {
  it('broadcasts player hit without cascading local death emission', () => {
    const target = createPlayerEntity(100);
    const sendEventToAll = vi.fn<(code: number, data: unknown) => void>();
    const broadcastDeath = vi.fn<
      (
        targetId: string,
        attackerId: string,
        respawnDelaySeconds?: number,
        canRespawn?: boolean,
        gameMode?: string
      ) => void
    >();

    const authorityLike = {
      entityManager: {
        getEntity: vi.fn().mockReturnValue(target),
      },
      sendEventToAll,
      broadcastDeath,
    };

    const hitPayload: HitEventData = {
      targetId: 'target',
      attackerId: 'attacker',
      damage: 100,
      newHealth: 0,
      part: 'head',
    };

    ServerNetworkAuthority.prototype.broadcastHit.call(
      authorityLike as unknown as ServerNetworkAuthority,
      hitPayload,
      EventCode.HIT
    );

    expect(target.health).toBe(0);
    expect(sendEventToAll).toHaveBeenCalledTimes(1);
    expect(sendEventToAll).toHaveBeenCalledWith(EventCode.HIT, hitPayload);
    expect(broadcastDeath).not.toHaveBeenCalled();
  });

  it('broadcasts non-player hit payloads unchanged', () => {
    const target = createEnemyEntity(100);
    const sendEventToAll = vi.fn<(code: number, data: unknown) => void>();

    const authorityLike = {
      entityManager: {
        getEntity: vi.fn().mockReturnValue(target),
      },
      sendEventToAll,
      broadcastDeath: vi.fn(),
    };

    const hitPayload: HitEventData = {
      targetId: 'enemy',
      attackerId: 'attacker',
      damage: 25,
      newHealth: 75,
      part: 'body',
    };

    ServerNetworkAuthority.prototype.broadcastHit.call(
      authorityLike as unknown as ServerNetworkAuthority,
      hitPayload,
      EventCode.TARGET_HIT
    );

    expect(target.health).toBe(100);
    expect(sendEventToAll).toHaveBeenCalledTimes(1);
    expect(sendEventToAll).toHaveBeenCalledWith(EventCode.TARGET_HIT, hitPayload);
  });

  it('broadcastDeath forwards respawn metadata fields', () => {
    const sendEventToAll = vi.fn<(code: number, data: unknown) => void>();
    const authorityLike = {
      sendEventToAll,
    };

    ServerNetworkAuthority.prototype.broadcastDeath.call(
      authorityLike as unknown as ServerNetworkAuthority,
      'target',
      'attacker',
      3,
      true,
      'deathmatch'
    );

    expect(sendEventToAll).toHaveBeenCalledTimes(1);
    expect(sendEventToAll).toHaveBeenCalledWith(EventCode.PLAYER_DEATH, {
      targetId: 'target',
      attackerId: 'attacker',
      respawnDelaySeconds: 3,
      canRespawn: true,
      gameMode: 'deathmatch',
    });
  });
});
