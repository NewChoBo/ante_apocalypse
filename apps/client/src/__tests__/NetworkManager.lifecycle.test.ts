import { describe, expect, it, vi } from 'vitest';
import { EventCode, NetworkState, RoomInfo } from '@ante/common';
import { NetworkManager } from '../core/systems/NetworkManager';
import {
  INetworkProvider,
  NetworkProviderEvent,
  NetworkProviderSubscriber,
} from '../core/network/INetworkProvider';
import { LocalServerManager } from '../core/server/LocalServerManager';

interface ProviderMockBundle {
  provider: INetworkProvider;
  emit: (event: NetworkProviderEvent) => void;
}

function createProviderMock(master: boolean = false): ProviderMockBundle {
  const subscribers = new Set<NetworkProviderSubscriber>();

  const provider: INetworkProvider = {
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
    getLocalPlayerId: vi.fn().mockReturnValue(master ? '1' : '2'),
    getServerTime: vi.fn().mockReturnValue(0),
    isMasterClient: vi.fn().mockReturnValue(master),
    getActors: vi.fn().mockReturnValue(new Map()),
    getCurrentRoomProperty: vi.fn().mockReturnValue(null),
    getCurrentRoomName: vi.fn().mockReturnValue('room'),
  };

  return {
    provider,
    emit: (event: NetworkProviderEvent): void => {
      subscribers.forEach((subscriber) => subscriber(event));
    },
  };
}

function createLocalServerManagerMock(
  isRunning: boolean = false
): {
  manager: LocalServerManager;
  stopSession: ReturnType<typeof vi.fn>;
} {
  const stopSession = vi.fn();

  const manager = {
    isServerRunning: vi.fn().mockReturnValue(isRunning),
    stopSession,
    startSession: vi.fn().mockResolvedValue(undefined),
    takeover: vi.fn().mockResolvedValue(undefined),
    getLogicalServer: vi.fn().mockReturnValue(null),
  } as unknown as LocalServerManager;

  return { manager, stopSession };
}

function sampleRoomList(): RoomInfo[] {
  return [
    {
      id: 'room-1',
      name: 'room-1',
      playerCount: 1,
      maxPlayers: 20,
      isOpen: true,
    },
  ];
}

describe('NetworkManager lifecycle', () => {
  it('publishes player snapshots when players join and leave', () => {
    const { provider, emit } = createProviderMock(false);
    const { manager: localServerManager } = createLocalServerManagerMock(false);
    const manager = new NetworkManager(localServerManager, provider);
    const listObserver = vi.fn();
    manager.onPlayersList.add(listObserver);

    emit({
      type: 'playerJoined',
      user: { userId: '2', name: 'remote', isMaster: false },
    });
    emit({ type: 'playerLeft', userId: '2' });

    expect(listObserver).toHaveBeenCalledTimes(2);
    expect(listObserver.mock.calls[0][0]).toHaveLength(1);
    expect(listObserver.mock.calls[1][0]).toHaveLength(0);
  });

  it('clearObservers(session) keeps global observers and clears session observers', () => {
    const { provider, emit } = createProviderMock(false);
    const { manager: localServerManager } = createLocalServerManagerMock(false);
    const manager = new NetworkManager(localServerManager, provider);
    const stateObserver = vi.fn();
    const roomObserver = vi.fn();
    const hitObserver = vi.fn();

    manager.onStateChanged.add(stateObserver);
    manager.onRoomListUpdated.add(roomObserver);
    manager.onPlayerHit.add(hitObserver);

    manager.clearObservers('session');

    emit({ type: 'stateChanged', state: NetworkState.InLobby });
    emit({ type: 'roomListUpdated', rooms: sampleRoomList() });
    emit({
      type: 'transport',
      event: {
        kind: 'authority',
        code: EventCode.HIT,
        data: {
          targetId: '2',
          attackerId: '1',
          damage: 10,
          newHealth: 90,
        },
        senderId: '1',
      },
    });

    expect(stateObserver).toHaveBeenCalledTimes(1);
    expect(roomObserver).toHaveBeenCalledTimes(1);
    expect(hitObserver).not.toHaveBeenCalled();
  });

  it('clearObservers(all) clears global observers and dispatcher handlers', () => {
    const { provider, emit } = createProviderMock(false);
    const { manager: localServerManager } = createLocalServerManagerMock(false);
    const manager = new NetworkManager(localServerManager, provider);
    const stateObserver = vi.fn();
    const roomObserver = vi.fn();
    const hitObserver = vi.fn();

    manager.onStateChanged.add(stateObserver);
    manager.onRoomListUpdated.add(roomObserver);
    manager.onPlayerHit.add(hitObserver);

    manager.clearObservers('all');

    emit({ type: 'stateChanged', state: NetworkState.InLobby });
    emit({ type: 'roomListUpdated', rooms: sampleRoomList() });
    emit({
      type: 'transport',
      event: {
        kind: 'authority',
        code: EventCode.HIT,
        data: {
          targetId: '2',
          attackerId: '1',
          damage: 10,
          newHealth: 90,
        },
        senderId: '1',
      },
    });

    expect(stateObserver).not.toHaveBeenCalled();
    expect(roomObserver).not.toHaveBeenCalled();
    expect(hitObserver).not.toHaveBeenCalled();
  });

  it('dispose stops local server when running and disconnects provider', () => {
    const { provider } = createProviderMock(false);
    const { manager: localServerManager, stopSession } = createLocalServerManagerMock(true);
    const manager = new NetworkManager(localServerManager, provider);

    manager.dispose();

    expect(stopSession).toHaveBeenCalledTimes(1);
    expect(provider.disconnect).toHaveBeenCalledTimes(1);
  });
});
