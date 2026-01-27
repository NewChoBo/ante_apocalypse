import { IServerNetwork } from '../../server/interfaces/IServerNetwork';
import { NetworkManager } from '../../core/network/NetworkManager';
import { PlayerData } from '../../shared/protocol/NetworkProtocol';

export class LocalNetworkAdapter implements IServerNetwork {
  private networkManager: NetworkManager;

  constructor(networkManager: NetworkManager) {
    this.networkManager = networkManager;
  }

  public sendEvent(
    code: number,
    data: any,
    reliable: boolean = true,
    targetId: string = 'all'
  ): void {
    // Adapter logic: Map 'targetId' from Server Interface to NetworkManager 'target'
    // Server implementation might pass specific ID, 'all', or 'others'.
    // NetworkManager.sendEvent signature: (code, data, reliable, target)
    this.networkManager.sendEvent(code, data, reliable, targetId);
  }

  public get onEvent() {
    return {
      add: (callback: (payload: { code: number; data: any; senderId: string }) => void) => {
        return this.networkManager.onEvent.add(callback);
      },
    };
  }

  public get onPlayerJoined() {
    return {
      add: (callback: (player: PlayerData) => void) => {
        return this.networkManager.onPlayerJoined.add(callback);
      },
    };
  }

  public get onPlayerLeft() {
    return {
      add: (callback: (id: string) => void) => {
        return this.networkManager.onPlayerLeft.add(callback);
      },
    };
  }
}
