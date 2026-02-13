interface NetworkLifecycleServiceDeps {
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
}

export class NetworkLifecycleService {
  constructor(private readonly deps: NetworkLifecycleServiceDeps) {}

  public clearObservers(scope: 'session' | 'all' = 'session'): void {
    this.deps.clearEventObservers(scope);
    this.deps.clearPlayerStateObservers();

    if (scope === 'all') {
      this.deps.clearStateObservers();
      this.deps.clearRoomObservers();
    }
  }

  public dispose(): void {
    this.deps.unsubscribeProvider();
    this.clearObservers('all');
    this.deps.stopLocalServer();
    this.deps.disposeConnectionManager();
    this.deps.disposeRoomManager();
    this.deps.disposePlayerStateManager();
    this.deps.disconnectProvider();
  }
}
