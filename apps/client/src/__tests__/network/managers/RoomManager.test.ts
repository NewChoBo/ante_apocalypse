import { describe, expect, it, vi } from 'vitest';
import { RoomManager } from '../../../core/network/RoomManager';
import {
  INetworkProvider,
  NetworkProviderSubscriber,
} from '../../../core/network/INetworkProvider';
import { NetworkState } from '@ante/common';

function createProviderMock(): INetworkProvider {
  const subscribers = new Set<NetworkProviderSubscriber>();

  return {
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn(),
    leaveRoom: vi.fn(),
    createRoom: vi.fn().mockResolvedValue(true),
    joinRoom: vi.fn().mockResolvedValue(true),
    getRoomList: vi.fn().mockResolvedValue([]),
    publish: vi.fn(),
    subscribe: vi.fn((handler: NetworkProviderSubscriber) => {
      subscribers.add(handler);
      return () => subscribers.delete(handler);
    }),
    getLocalPlayerId: vi.fn().mockReturnValue('local-player'),
    getServerTime: vi.fn().mockReturnValue(0),
    isMasterClient: vi.fn().mockReturnValue(false),
    getActors: vi.fn().mockReturnValue(new Map()),
    getCurrentRoomProperty: vi.fn().mockReturnValue(null),
    refreshRoomList: vi.fn(),
  };
}

describe('RoomManager', () => {
  it('calls provider.leaveRoom and does not disconnect network', () => {
    const provider = createProviderMock();
    const manager = new RoomManager(provider, () => NetworkState.InLobby);

    manager.leaveRoom();

    expect(provider.leaveRoom).toHaveBeenCalledTimes(1);
    expect(provider.disconnect).not.toHaveBeenCalled();
  });

  it('passes mapId via customGameProperties when creating a room', async () => {
    const provider = createProviderMock();
    const manager = new RoomManager(provider, () => NetworkState.InLobby);

    const created = await manager.createRoom('alpha-room', 'training_ground');

    expect(created).toBe(true);
    expect(provider.createRoom).toHaveBeenCalledTimes(1);
    expect(provider.createRoom).toHaveBeenCalledWith('alpha-room', {
      maxPlayers: 20,
      customGameProperties: { mapId: 'training_ground' },
      propsListedInLobby: ['mapId'],
    });
  });

  it('blocks createRoom when state is not lobby/master-connected', async () => {
    const provider = createProviderMock();
    const manager = new RoomManager(provider, () => NetworkState.InRoom);

    const created = await manager.createRoom('blocked-room', 'combat_zone');

    expect(created).toBe(false);
    expect(provider.createRoom).not.toHaveBeenCalled();
  });

  it('blocks joinRoom when state is not lobby/master-connected', async () => {
    const provider = createProviderMock();
    const manager = new RoomManager(provider, () => NetworkState.Disconnected);

    const joined = await manager.joinRoom('blocked-room');

    expect(joined).toBe(false);
    expect(provider.joinRoom).not.toHaveBeenCalled();
  });

  it('refreshes room list through provider', () => {
    const provider = createProviderMock();
    const manager = new RoomManager(provider, () => NetworkState.InLobby);

    manager.refreshRoomList();

    expect(provider.refreshRoomList).toHaveBeenCalledTimes(1);
  });

  it('returns string mapId and null for non-string mapId', () => {
    const provider = createProviderMock();
    const manager = new RoomManager(provider, () => NetworkState.InLobby);

    (provider.getCurrentRoomProperty as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      'training_ground'
    );
    (provider.getCurrentRoomProperty as ReturnType<typeof vi.fn>).mockReturnValueOnce(123);

    expect(manager.getMapId()).toBe('training_ground');
    expect(manager.getMapId()).toBeNull();
  });
});


