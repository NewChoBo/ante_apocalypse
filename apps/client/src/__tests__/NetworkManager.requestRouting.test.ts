import { describe, expect, it, vi } from 'vitest';
import { NetworkManager } from '../core/systems/NetworkManager';
import { INetworkProvider } from '../core/network/INetworkProvider';
import { LocalServerManager } from '../core/server/LocalServerManager';
import { EventCode } from '@ante/common';

function createProviderMock(master: boolean): INetworkProvider {
  return {
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn(),
    leaveRoom: vi.fn(),
    createRoom: vi.fn().mockResolvedValue(true),
    joinRoom: vi.fn().mockResolvedValue(true),
    getRoomList: vi.fn().mockResolvedValue([]),
    sendEvent: vi.fn(),
    sendEventToMaster: vi.fn(),
    getLocalPlayerId: vi.fn().mockReturnValue(master ? '1' : '2'),
    getServerTime: vi.fn().mockReturnValue(0),
    isMasterClient: vi.fn().mockReturnValue(master),
    getActors: vi.fn().mockReturnValue(new Map()),
    getCurrentRoomProperty: vi.fn().mockReturnValue(null),
    onStateChanged: undefined,
    onEvent: undefined,
    onPlayerJoined: undefined,
    onPlayerLeft: undefined,
    onMasterClientSwitched: undefined,
    onRoomListUpdated: undefined,
  };
}

describe('NetworkManager request routing', () => {
  it('routes request events to master only for non-master clients', () => {
    const provider = createProviderMock(false);
    const manager = new NetworkManager(new LocalServerManager(), provider);

    manager.fire({ weaponId: 'Pistol' });

    expect(provider.sendEventToMaster).toHaveBeenCalledTimes(1);
    expect(provider.sendEventToMaster).toHaveBeenCalledWith(
      EventCode.FIRE,
      { weaponId: 'Pistol' },
      true
    );
    expect(provider.sendEvent).not.toHaveBeenCalled();
  });

  it('loops request events locally when client is master', () => {
    const provider = createProviderMock(true);
    const manager = new NetworkManager(new LocalServerManager(), provider);
    const observer = vi.fn();
    manager.onEvent.add(observer);

    manager.reload('Pistol');

    expect(provider.sendEventToMaster).not.toHaveBeenCalled();
    expect(observer).toHaveBeenCalledTimes(1);
    expect(observer.mock.calls[0][0]).toMatchObject({
      code: EventCode.RELOAD,
      senderId: '1',
    });
  });
});
