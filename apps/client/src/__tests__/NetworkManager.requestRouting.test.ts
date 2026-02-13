import { describe, expect, it, vi } from 'vitest';
import { NetworkManager } from '../core/systems/NetworkManager';
import {
  INetworkProvider,
  NetworkProviderEvent,
  NetworkProviderSubscriber,
} from '../core/network/INetworkProvider';
import { LocalServerManager } from '../core/server/LocalServerManager';
import { EventCode } from '@ante/common';

interface ProviderMockBundle {
  provider: INetworkProvider;
  emit: (event: NetworkProviderEvent) => void;
  publish: ReturnType<typeof vi.fn>;
}

function createProviderMock(master: boolean): ProviderMockBundle {
  const subscribers = new Set<NetworkProviderSubscriber>();
  const publish = vi.fn();

  const provider: INetworkProvider = {
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn(),
    leaveRoom: vi.fn(),
    createRoom: vi.fn().mockResolvedValue(true),
    joinRoom: vi.fn().mockResolvedValue(true),
    getRoomList: vi.fn().mockResolvedValue([]),
    publish,
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
    publish,
  };
}

describe('NetworkManager request routing', () => {
  it('routes request events to master only for non-master clients', () => {
    const { provider, publish } = createProviderMock(false);
    const manager = new NetworkManager(new LocalServerManager(), provider);

    manager.fire({ weaponId: 'Pistol' });

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith({
      kind: 'request',
      code: EventCode.FIRE,
      data: { weaponId: 'Pistol' },
      reliable: true,
    });
  });

  it('loops request events locally when client is master', () => {
    const { provider, publish } = createProviderMock(true);
    const manager = new NetworkManager(new LocalServerManager(), provider);
    const observer = vi.fn();
    manager.onEvent.add(observer);

    manager.reload('Pistol');

    expect(publish).not.toHaveBeenCalled();
    expect(observer).toHaveBeenCalledTimes(1);
    expect(observer.mock.calls[0][0]).toMatchObject({
      code: EventCode.RELOAD,
      senderId: '1',
    });
  });

  it('does not dispatch request events when master receives them from provider', () => {
    const { provider, emit } = createProviderMock(true);
    const manager = new NetworkManager(new LocalServerManager(), provider);
    const rawObserver = vi.fn();
    const reloadObserver = vi.fn();
    manager.onEvent.add(rawObserver);
    manager.onPlayerReloaded.add(reloadObserver);

    emit({
      type: 'transport',
      event: {
        kind: 'request',
        code: EventCode.RELOAD,
        data: {
          playerId: '2',
          weaponId: 'Rifle',
        },
        senderId: '2',
      },
    });

    expect(rawObserver).toHaveBeenCalledTimes(1);
    expect(reloadObserver).not.toHaveBeenCalled();
  });

  it('dispatches non-request events when master receives them from provider', () => {
    const { provider, emit } = createProviderMock(true);
    const manager = new NetworkManager(new LocalServerManager(), provider);
    const hitObserver = vi.fn();
    manager.onPlayerHit.add(hitObserver);

    emit({
      type: 'transport',
      event: {
        kind: 'authority',
        code: EventCode.HIT,
        data: {
          targetId: '2',
          attackerId: '1',
          damage: 25,
          newHealth: 75,
        },
        senderId: '1',
      },
    });

    expect(hitObserver).toHaveBeenCalledTimes(1);
    expect(hitObserver.mock.calls[0][0]).toMatchObject({
      targetId: '2',
      attackerId: '1',
      damage: 25,
      newHealth: 75,
    });
  });

  it('uses payload playerId for authoritative fire broadcasts', () => {
    const { provider, emit } = createProviderMock(false);
    const manager = new NetworkManager(new LocalServerManager(), provider);
    const firedObserver = vi.fn();
    manager.onPlayerFired.add(firedObserver);

    emit({
      type: 'transport',
      event: {
        kind: 'request',
        code: EventCode.FIRE,
        data: {
          playerId: '7',
          weaponId: 'Rifle',
        },
        senderId: '1',
      },
    });

    expect(firedObserver).toHaveBeenCalledTimes(1);
    expect(firedObserver.mock.calls[0][0]).toMatchObject({
      playerId: '7',
      weaponId: 'Rifle',
    });
  });

  it('falls back to senderId when fire payload has no playerId', () => {
    const { provider, emit } = createProviderMock(false);
    const manager = new NetworkManager(new LocalServerManager(), provider);
    const firedObserver = vi.fn();
    manager.onPlayerFired.add(firedObserver);

    emit({
      type: 'transport',
      event: {
        kind: 'request',
        code: EventCode.FIRE,
        data: {
          weaponId: 'Pistol',
        },
        senderId: '1',
      },
    });

    expect(firedObserver).toHaveBeenCalledTimes(1);
    expect(firedObserver.mock.calls[0][0]).toMatchObject({
      playerId: '1',
      weaponId: 'Pistol',
    });
  });

  it('dispatches authoritative non-request events locally for master broadcasts', () => {
    const { provider, publish } = createProviderMock(true);
    const manager = new NetworkManager(new LocalServerManager(), provider);
    const hitObserver = vi.fn();
    manager.onPlayerHit.add(hitObserver);

    manager.sendEvent(
      EventCode.HIT,
      {
        targetId: '2',
        attackerId: '1',
        damage: 15,
        newHealth: 85,
      },
      true
    );

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith({
      kind: 'authority',
      code: EventCode.HIT,
      data: {
        targetId: '2',
        attackerId: '1',
        damage: 15,
        newHealth: 85,
      },
      reliable: true,
    });
    expect(hitObserver).toHaveBeenCalledTimes(1);
    expect(hitObserver.mock.calls[0][0]).toMatchObject({
      targetId: '2',
      attackerId: '1',
      damage: 15,
      newHealth: 85,
    });
  });
});
