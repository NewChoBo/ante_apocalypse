import { describe, expect, it, vi } from 'vitest';
import { NetworkLifecycleService } from '../core/network/services/NetworkLifecycleService';

function createLifecycleDeps(): {
  deps: {
    unsubscribeProvider: () => void;
    clearEventObservers: (scope: 'session' | 'all') => void;
    clearPlayerStateObservers: () => void;
    clearStateObservers: () => void;
    clearRoomObservers: () => void;
    stopLocalServer: () => void;
    disposeConnectionManager: () => void;
    disposeRoomManager: () => void;
    disposePlayerStateManager: () => void;
    disconnectProvider: () => void;
  };
  mocks: {
    unsubscribeProvider: ReturnType<typeof vi.fn>;
    clearEventObservers: ReturnType<typeof vi.fn>;
    clearPlayerStateObservers: ReturnType<typeof vi.fn>;
    clearStateObservers: ReturnType<typeof vi.fn>;
    clearRoomObservers: ReturnType<typeof vi.fn>;
    stopLocalServer: ReturnType<typeof vi.fn>;
    disposeConnectionManager: ReturnType<typeof vi.fn>;
    disposeRoomManager: ReturnType<typeof vi.fn>;
    disposePlayerStateManager: ReturnType<typeof vi.fn>;
    disconnectProvider: ReturnType<typeof vi.fn>;
  };
} {
  const mocks = {
    unsubscribeProvider: vi.fn(),
    clearEventObservers: vi.fn(),
    clearPlayerStateObservers: vi.fn(),
    clearStateObservers: vi.fn(),
    clearRoomObservers: vi.fn(),
    stopLocalServer: vi.fn(),
    disposeConnectionManager: vi.fn(),
    disposeRoomManager: vi.fn(),
    disposePlayerStateManager: vi.fn(),
    disconnectProvider: vi.fn(),
  };

  const deps = {
    unsubscribeProvider: (): void => mocks.unsubscribeProvider(),
    clearEventObservers: (scope: 'session' | 'all'): void => mocks.clearEventObservers(scope),
    clearPlayerStateObservers: (): void => mocks.clearPlayerStateObservers(),
    clearStateObservers: (): void => mocks.clearStateObservers(),
    clearRoomObservers: (): void => mocks.clearRoomObservers(),
    stopLocalServer: (): void => mocks.stopLocalServer(),
    disposeConnectionManager: (): void => mocks.disposeConnectionManager(),
    disposeRoomManager: (): void => mocks.disposeRoomManager(),
    disposePlayerStateManager: (): void => mocks.disposePlayerStateManager(),
    disconnectProvider: (): void => mocks.disconnectProvider(),
  };

  return { deps, mocks };
}

describe('NetworkLifecycleService', () => {
  it('clearObservers(session) clears session observers only', () => {
    const { deps, mocks } = createLifecycleDeps();
    const service = new NetworkLifecycleService(deps);

    service.clearObservers('session');

    expect(mocks.clearEventObservers).toHaveBeenCalledWith('session');
    expect(mocks.clearPlayerStateObservers).toHaveBeenCalledTimes(1);
    expect(mocks.clearStateObservers).not.toHaveBeenCalled();
    expect(mocks.clearRoomObservers).not.toHaveBeenCalled();
  });

  it('dispose executes lifecycle cleanup in stable order', () => {
    const callOrder: string[] = [];
    const deps = {
      unsubscribeProvider: (): void => {
        callOrder.push('unsubscribeProvider');
      },
      clearEventObservers: (): void => {
        callOrder.push('clearEventObservers');
      },
      clearPlayerStateObservers: (): void => {
        callOrder.push('clearPlayerStateObservers');
      },
      clearStateObservers: (): void => {
        callOrder.push('clearStateObservers');
      },
      clearRoomObservers: (): void => {
        callOrder.push('clearRoomObservers');
      },
      stopLocalServer: (): void => {
        callOrder.push('stopLocalServer');
      },
      disposeConnectionManager: (): void => {
        callOrder.push('disposeConnectionManager');
      },
      disposeRoomManager: (): void => {
        callOrder.push('disposeRoomManager');
      },
      disposePlayerStateManager: (): void => {
        callOrder.push('disposePlayerStateManager');
      },
      disconnectProvider: (): void => {
        callOrder.push('disconnectProvider');
      },
    };
    const service = new NetworkLifecycleService(deps);

    service.dispose();

    expect(callOrder).toEqual([
      'unsubscribeProvider',
      'clearEventObservers',
      'clearPlayerStateObservers',
      'clearStateObservers',
      'clearRoomObservers',
      'stopLocalServer',
      'disposeConnectionManager',
      'disposeRoomManager',
      'disposePlayerStateManager',
      'disconnectProvider',
    ]);
  });
});
