import { describe, expect, it, vi } from 'vitest';
import { RoomManager } from '../core/network/RoomManager';
import { INetworkProvider } from '../core/network/INetworkProvider';
import { NetworkState } from '@ante/common';

function createProviderMock(): INetworkProvider {
  return {
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn(),
    leaveRoom: vi.fn(),
    createRoom: vi.fn().mockResolvedValue(true),
    joinRoom: vi.fn().mockResolvedValue(true),
    getRoomList: vi.fn().mockResolvedValue([]),
    sendEvent: vi.fn(),
    getLocalPlayerId: vi.fn().mockReturnValue('local-player'),
    getServerTime: vi.fn().mockReturnValue(0),
    isMasterClient: vi.fn().mockReturnValue(false),
    getActors: vi.fn().mockReturnValue(new Map()),
    getCurrentRoomProperty: vi.fn().mockReturnValue(null),
  };
}

describe('RoomManager.leaveRoom', () => {
  it('calls provider.leaveRoom and does not disconnect network', () => {
    const provider = createProviderMock();
    const manager = new RoomManager(provider, () => NetworkState.InLobby);

    manager.leaveRoom();

    expect(provider.leaveRoom).toHaveBeenCalledTimes(1);
    expect(provider.disconnect).not.toHaveBeenCalled();
  });
});
