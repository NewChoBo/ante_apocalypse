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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    reliable: boolean = true,
    targetId: string = 'all'
  ): void {
    // Adapter logic: Map 'targetId' from Server Interface to NetworkManager 'target'
    // Server implementation might pass specific ID, 'all', or 'others'.
    // NetworkManager.sendEvent signature: (code, data, reliable, target)
    this.networkManager.sendEvent(code, data, reliable, targetId);
  }

  public get onEvent(): {
    add: (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callback: (payload: { code: number; data: any; senderId: string }) => void
    ) => any;
  } {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      add: (callback: (payload: { code: number; data: any; senderId: string }) => void) => {
        return this.networkManager.onEvent.add(callback);
      },
    };
  }

  public get onPlayerJoined(): {
    add: (callback: (player: PlayerData) => void) => any;
  } {
    return {
      add: (callback: (player: PlayerData) => void) => {
        return this.networkManager.onPlayerJoined.add(callback);
      },
    };
  }

  public get onPlayerLeft(): {
    add: (callback: (id: string) => void) => any;
  } {
    return {
      add: (callback: (id: string) => void) => {
        return this.networkManager.onPlayerLeft.add(callback);
      },
    };
  }
}
