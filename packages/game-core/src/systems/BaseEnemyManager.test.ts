import { describe, expect, it } from 'vitest';
import { Vector3 } from '@babylonjs/core';
import { BaseEnemyManager } from './BaseEnemyManager.js';
import type { IEnemyPawn } from '../types/IEnemyPawn.js';
import type { INetworkAuthority } from '../network/INetworkAuthority.js';
import type { TickManager } from './TickManager.js';

class TestEnemyManager extends BaseEnemyManager {
  public injectPawn(id: string, pawn: IEnemyPawn): void {
    this.pawns.set(id, pawn);
  }
}

function createEnemyPawn(): IEnemyPawn {
  return {
    id: 'enemy_1',
    position: new Vector3(0, 0, 0),
    rotation: new Vector3(0, 0, 0),
    health: 100,
    isDead: false,
    isMoving: false,
    lookAt: (): void => undefined,
    move: (): void => undefined,
    dispose: (): void => undefined,
  };
}

function createManager(isMasterClient: boolean): TestEnemyManager {
  const authority = {
    isMasterClient: (): boolean => isMasterClient,
    sendEvent: (): void => undefined,
  } as unknown as INetworkAuthority;

  const tickManager = {} as TickManager;
  return new TestEnemyManager(authority, tickManager);
}

describe('BaseEnemyManager.processEnemyMove', () => {
  it.each([true, false])('applies authoritative move packets (master=%s)', (master): void => {
    const manager = createManager(master);
    const pawn = createEnemyPawn();
    manager.injectPawn('enemy_1', pawn);

    manager.processEnemyMove({
      id: 'enemy_1',
      position: { x: 5, y: 0, z: -3 },
      rotation: { x: 0, y: 1.5, z: 0 },
      isMoving: true,
    });

    expect(pawn.position.asArray()).toEqual([5, 0, -3]);
    expect(pawn.rotation.asArray()).toEqual([0, 1.5, 0]);
    expect(pawn.isMoving).toBe(true);
  });
});
