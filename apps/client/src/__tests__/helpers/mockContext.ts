import { vi } from 'vitest';
import type { GameContext } from '../../types/GameContext';
import type { TickManager } from '@ante/game-core';
import type { INetworkManager } from '../../core/interfaces/INetworkManager';
import type { WorldEntityManager } from '../../core/systems/WorldEntityManager';

/**
 * 테스트용 Mock GameContext 생성
 */
export function createMockGameContext(overrides?: Partial<GameContext>): GameContext {
  return {
    scene: {
      onBeforeRenderObservable: { add: vi.fn(), remove: vi.fn() },
      onAfterRenderObservable: { add: vi.fn(), remove: vi.fn() },
      isDisposed: false,
    } as unknown as import('@babylonjs/core').Scene,

    camera: {
      position: { copyFrom: vi.fn(), addInPlace: vi.fn() },
      rotation: { set: vi.fn() },
      setTarget: vi.fn(),
    } as unknown as import('@babylonjs/core').UniversalCamera,

    tickManager: {
      register: vi.fn(),
      unregister: vi.fn(),
      tick: vi.fn(),
      clear: vi.fn(),
    } as unknown as TickManager,

    networkManager: {
      sendEvent: vi.fn(),
      onEvent: vi.fn(),
      connect: vi.fn().mockResolvedValue(true),
      disconnect: vi.fn(),
      isMasterClient: vi.fn().mockReturnValue(false),
      getSocketId: vi.fn().mockReturnValue('test-socket-id'),
    } as unknown as INetworkManager,

    worldManager: {
      register: vi.fn(),
      unregister: vi.fn(),
      getEntity: vi.fn(),
      getAllEntities: vi.fn().mockReturnValue([]),
      initialize: vi.fn(),
      registerEntity: vi.fn(),
      removeEntity: vi.fn(),
    } as unknown as WorldEntityManager,

    ...overrides,
  } as GameContext;
}

/**
 * 특정 조건을 가진 Mock GameContext 생성
 */
export function createMockGameContextWith(config: {
  isMasterClient?: boolean;
  networkConnected?: boolean;
}): GameContext {
  const context = createMockGameContext();

  if (config.isMasterClient !== undefined) {
    vi.mocked(context.networkManager.isMasterClient).mockReturnValue(config.isMasterClient);
  }

  if (config.networkConnected !== undefined) {
    vi.mocked(context.networkManager.connect).mockResolvedValue(config.networkConnected);
  }

  return context;
}
