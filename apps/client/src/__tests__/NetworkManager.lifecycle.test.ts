import { describe, expect, it, vi } from 'vitest';
import { EventCode, NetworkState, RoomInfo } from '@ante/common';
import { NetworkManager } from '../core/systems/NetworkManager';
import { INetworkProvider } from '../core/network/INetworkProvider';
import { LocalServerManager } from '../core/server/LocalServerManager';

function createProviderMock(master: boolean = false): INetworkProvider {
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
  it('clearObservers(session) keeps global observers and clears session observers', () => {
    const provider = createProviderMock(false);
    const { manager: localServerManager } = createLocalServerManagerMock(false);
    const manager = new NetworkManager(localServerManager, provider);
    const stateObserver = vi.fn();
    const roomObserver = vi.fn();
    const hitObserver = vi.fn();

    manager.onStateChanged.add(stateObserver);
    manager.onRoomListUpdated.add(roomObserver);
    manager.onPlayerHit.add(hitObserver);

    manager.clearObservers('session');

    provider.onStateChanged?.(NetworkState.InLobby);
    provider.onRoomListUpdated?.(sampleRoomList());
    provider.onEvent?.(
      EventCode.HIT,
      {
        targetId: '2',
        attackerId: '1',
        damage: 10,
        newHealth: 90,
      },
      '1'
    );

    expect(stateObserver).toHaveBeenCalledTimes(1);
    expect(roomObserver).toHaveBeenCalledTimes(1);
    expect(hitObserver).not.toHaveBeenCalled();
  });

  it('clearObservers(all) clears global observers and dispatcher handlers', () => {
    const provider = createProviderMock(false);
    const { manager: localServerManager } = createLocalServerManagerMock(false);
    const manager = new NetworkManager(localServerManager, provider);
    const stateObserver = vi.fn();
    const roomObserver = vi.fn();
    const hitObserver = vi.fn();

    manager.onStateChanged.add(stateObserver);
    manager.onRoomListUpdated.add(roomObserver);
    manager.onPlayerHit.add(hitObserver);

    manager.clearObservers('all');

    provider.onStateChanged?.(NetworkState.InLobby);
    provider.onRoomListUpdated?.(sampleRoomList());
    provider.onEvent?.(
      EventCode.HIT,
      {
        targetId: '2',
        attackerId: '1',
        damage: 10,
        newHealth: 90,
      },
      '1'
    );

    expect(stateObserver).not.toHaveBeenCalled();
    expect(roomObserver).not.toHaveBeenCalled();
    expect(hitObserver).not.toHaveBeenCalled();
  });

  it('dispose stops local server when running and disconnects provider', () => {
    const provider = createProviderMock(false);
    const { manager: localServerManager, stopSession } = createLocalServerManagerMock(true);
    const manager = new NetworkManager(localServerManager, provider);

    manager.dispose();

    expect(stopSession).toHaveBeenCalledTimes(1);
    expect(provider.disconnect).toHaveBeenCalledTimes(1);
  });
});

