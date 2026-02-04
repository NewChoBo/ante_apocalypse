import { describe, it, expect, vi } from 'vitest';
import { SessionController } from '../core/systems/SessionController';
import { Scene, ShadowGenerator } from '@babylonjs/core';

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
      } as any,
      uiManager: {
        onLogin: { add: vi.fn() },
        onStartMultiplayer: { add: vi.fn() },
        onLogout: { add: vi.fn() },
        onResume: { add: vi.fn() },
        onAbort: { add: vi.fn() },
        showScreen: vi.fn(),
        getTexture: vi.fn(),
      } as any,
      worldManager: {
        initialize: vi.fn(),
        register: vi.fn(),
        unregister: vi.fn(),
        clear: vi.fn(),
      } as any,
      enemyManager: {
        applyEnemyStates: vi.fn(),
        dispose: vi.fn(),
      } as any,
      pickupManager: {
        initialize: vi.fn(),
      } as any,
      tickManager: {
        register: vi.fn(),
        unregister: vi.fn(),
        tick: vi.fn(),
        clear: vi.fn(),
      } as any,
      localServerManager: {
        isServerRunning: vi.fn().mockReturnValue(false),
      } as any,
    };

    const controller = new SessionController(
      mockScene,
      mockCanvas,
      mockShadowGenerator,
      mockOptions as any
    );

    expect(controller).toBeDefined();
  });
});
