import { describe, it, expect, vi } from 'vitest';
import { SessionController } from '../../../core/systems/SessionController';
import { Scene, ShadowGenerator } from '@babylonjs/core';
import type { INetworkManager } from '../../../core/interfaces/INetworkManager';
import type { IUIManager } from '../../../ui/IUIManager';
import type { WorldEntityManager } from '../../../core/systems/WorldEntityManager';
import type { EnemyManager } from '../../../core/systems/EnemyManager';
import type { PickupManager } from '../../../core/systems/PickupManager';
import type { LocalServerManager } from '../../../core/server/LocalServerManager';
import type { TickManager } from '@ante/game-core';
import type { SessionControllerOptions } from '../../../core/systems/SessionController';

describe('SessionController', () => {
  it('should be instantiable with mocked dependencies', () => {
    const mockScene = {} as Scene;
    const mockCanvas = {} as HTMLCanvasElement;
    const mockShadowGenerator = {} as ShadowGenerator;

    const mockOptions = {
      networkManager: {
        onStateChanged: { add: vi.fn(), remove: vi.fn() },
        onInitialStateReceived: { add: vi.fn(), remove: vi.fn() },
        onPlayerRespawn: { add: vi.fn() },
        clearObservers: vi.fn(),
      } as unknown as INetworkManager,
      uiManager: {
        onLogin: { add: vi.fn() },
        onStartMultiplayer: { add: vi.fn() },
        onLogout: { add: vi.fn() },
        onResume: { add: vi.fn() },
        onAbort: { add: vi.fn() },
        showScreen: vi.fn(),
        getTexture: vi.fn(),
      } as unknown as IUIManager,
      worldManager: {
        initialize: vi.fn(),
        register: vi.fn(),
        unregister: vi.fn(),
        clear: vi.fn(),
      } as unknown as WorldEntityManager,
      enemyManager: {
        applyEnemyStates: vi.fn(),
        dispose: vi.fn(),
      } as unknown as EnemyManager,
      pickupManager: {
        initialize: vi.fn(),
      } as unknown as PickupManager,
      tickManager: {
        register: vi.fn(),
        unregister: vi.fn(),
        tick: vi.fn(),
        clear: vi.fn(),
      } as unknown as TickManager,
      localServerManager: {
        isServerRunning: vi.fn().mockReturnValue(false),
      } as unknown as LocalServerManager,
    };

    const controller = new SessionController(
      mockScene,
      mockCanvas,
      mockShadowGenerator,
      mockOptions as SessionControllerOptions
    );

    expect(controller).toBeDefined();
  });
});


