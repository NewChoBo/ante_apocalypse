import { describe, expect, it, vi } from 'vitest';
import { NullEngine, Scene, UniversalCamera, Vector3 } from '@babylonjs/core';
import { TickManager } from '@ante/game-core';
import { Pistol } from '../../weapons/Pistol';
import { Rifle } from '../../weapons/Rifle';
import { Knife } from '../../weapons/Knife';
import { Bat } from '../../weapons/Bat';
import { GameAssets } from '../../core/GameAssets';
import type { GameContext } from '../../types/GameContext';
import type { INetworkManager } from '../../core/interfaces/INetworkManager';
import type { WorldEntityManager } from '../../core/systems/WorldEntityManager';

function createContext(): { context: GameContext; teardown: () => void } {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const camera = new UniversalCamera('test-camera', Vector3.Zero(), scene);
  const tickManager = new TickManager();

  const networkManager = {
    fire: vi.fn(),
    reload: vi.fn(),
    requestHit: vi.fn(),
  } as unknown as INetworkManager;

  const worldManager = {
    processHit: vi.fn(),
  } as unknown as WorldEntityManager;

  const context = {
    scene,
    camera,
    tickManager,
    networkManager,
    worldManager,
  } as GameContext;

  return {
    context,
    teardown: (): void => {
      scene.dispose();
      engine.dispose();
    },
  };
}

describe('IWeapon reset contract', () => {
  it('all concrete weapons expose reset() and can invoke it safely', () => {
    const modelSpy = vi.spyOn(GameAssets, 'instantiateModel').mockReturnValue(null);
    const { context, teardown } = createContext();

    const weapons = [new Pistol(context), new Rifle(context), new Knife(context), new Bat(context)];

    for (const weapon of weapons) {
      expect(typeof weapon.reset).toBe('function');
      expect(() => weapon.reset()).not.toThrow();
    }

    for (const weapon of weapons) {
      weapon.dispose();
    }
    teardown();
    modelSpy.mockRestore();
  });
});

