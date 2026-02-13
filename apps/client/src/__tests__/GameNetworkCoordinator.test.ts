import { describe, expect, it, vi } from 'vitest';
import { Observable } from '@babylonjs/core';
import { GameEndEventData, NetworkState } from '@ante/common';
import { GameNetworkCoordinator } from '../core/systems/GameNetworkCoordinator';
import type { INetworkManager } from '../core/interfaces/INetworkManager';

interface NetworkManagerBundle {
  networkManager: INetworkManager;
  onStateChanged: Observable<NetworkState>;
  onGameEnd: Observable<GameEndEventData>;
}

function createNetworkManagerMock(): NetworkManagerBundle {
  const onStateChanged = new Observable<NetworkState>();
  const onGameEnd = new Observable<GameEndEventData>();
  const networkManager = {
    onStateChanged,
    onGameEnd,
  } as unknown as INetworkManager;

  return {
    networkManager,
    onStateChanged,
    onGameEnd,
  };
}

describe('GameNetworkCoordinator', (): void => {
  it('binds and routes network state/game end events', (): void => {
    const { networkManager, onStateChanged, onGameEnd } = createNetworkManagerMock();
    const onNetworkStateChanged = vi.fn();
    const onGameEndHandler = vi.fn();

    const coordinator = new GameNetworkCoordinator({
      networkManager,
      onNetworkStateChanged,
      onGameEnd: onGameEndHandler,
    });

    coordinator.bind();
    onStateChanged.notifyObservers(NetworkState.InRoom);
    onGameEnd.notifyObservers({ reason: 'victory' });

    expect(onNetworkStateChanged).toHaveBeenCalledTimes(1);
    expect(onNetworkStateChanged).toHaveBeenCalledWith(NetworkState.InRoom);
    expect(onGameEndHandler).toHaveBeenCalledTimes(1);
    expect(onGameEndHandler).toHaveBeenCalledWith({ reason: 'victory' });
  });

  it('rebinds without duplicating observers', (): void => {
    const { networkManager, onStateChanged, onGameEnd } = createNetworkManagerMock();
    const onNetworkStateChanged = vi.fn();
    const onGameEndHandler = vi.fn();

    const coordinator = new GameNetworkCoordinator({
      networkManager,
      onNetworkStateChanged,
      onGameEnd: onGameEndHandler,
    });

    coordinator.bind();
    coordinator.bind();

    onStateChanged.notifyObservers(NetworkState.Error);
    onGameEnd.notifyObservers({ reason: 'terminated' });

    expect(onNetworkStateChanged).toHaveBeenCalledTimes(1);
    expect(onGameEndHandler).toHaveBeenCalledTimes(1);
  });

  it('dispose removes bound observers', (): void => {
    const { networkManager, onStateChanged, onGameEnd } = createNetworkManagerMock();
    const onNetworkStateChanged = vi.fn();
    const onGameEndHandler = vi.fn();

    const coordinator = new GameNetworkCoordinator({
      networkManager,
      onNetworkStateChanged,
      onGameEnd: onGameEndHandler,
    });

    coordinator.bind();
    coordinator.dispose();

    onStateChanged.notifyObservers(NetworkState.Disconnected);
    onGameEnd.notifyObservers({ reason: 'disconnected' });

    expect(onNetworkStateChanged).not.toHaveBeenCalled();
    expect(onGameEndHandler).not.toHaveBeenCalled();
  });
});
