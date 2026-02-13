import { Observer } from '@babylonjs/core';
import { GameEndEventData, NetworkState } from '@ante/common';
import { INetworkManager } from '../interfaces/INetworkManager';

interface GameNetworkCoordinatorDeps {
  networkManager: INetworkManager;
  onNetworkStateChanged: (state: NetworkState) => void;
  onGameEnd: (data: GameEndEventData) => void;
}

export class GameNetworkCoordinator {
  private networkStateObserver: Observer<NetworkState> | null = null;
  private gameEndObserver: Observer<GameEndEventData> | null = null;

  constructor(private readonly deps: GameNetworkCoordinatorDeps) {}

  public bind(): void {
    this.dispose();
    this.networkStateObserver = this.deps.networkManager.onStateChanged.add(
      (state: NetworkState): void => {
        this.deps.onNetworkStateChanged(state);
      }
    );
    this.gameEndObserver = this.deps.networkManager.onGameEnd.add((data: GameEndEventData): void => {
      this.deps.onGameEnd(data);
    });
  }

  public dispose(): void {
    if (this.networkStateObserver) {
      this.deps.networkManager.onStateChanged.remove(this.networkStateObserver);
      this.networkStateObserver = null;
    }
    if (this.gameEndObserver) {
      this.deps.networkManager.onGameEnd.remove(this.gameEndObserver);
      this.gameEndObserver = null;
    }
  }
}
