import { describe, expect, it, vi } from 'vitest';
import { Observable } from '@babylonjs/core';
import { ClientHostNetworkAdapter } from '../core/server/ClientHostNetworkAdapter';
import { TickManager, WorldEntityManager } from '@ante/game-core';
import { EventCode, PlayerState } from '@ante/common';
import { NetworkManager } from '../core/systems/NetworkManager';

interface NetworkManagerStubBundle {
  stub: {
    onPlayerJoined: Observable<PlayerState>;
    onPlayerLeft: Observable<string>;
    onEvent: Observable<{ code: number; data: unknown; senderId: string }>;
    getSocketId: ReturnType<typeof vi.fn>;
    isMasterClient: ReturnType<typeof vi.fn>;
    sendEvent: ReturnType<typeof vi.fn>;
    broadcastAuthorityEvent: ReturnType<typeof vi.fn>;
    getAllPlayerStates: ReturnType<typeof vi.fn>;
  };
  onPlayerJoined: Observable<PlayerState>;
  onPlayerLeft: Observable<string>;
  onEvent: Observable<{ code: number; data: unknown; senderId: string }>;
}

function createNetworkManagerStub(): NetworkManagerStubBundle {
  const onPlayerJoined = new Observable<PlayerState>();
  const onPlayerLeft = new Observable<string>();
  const onEvent = new Observable<{ code: number; data: unknown; senderId: string }>();

  const stub = {
    onPlayerJoined,
    onPlayerLeft,
    onEvent,
    getSocketId: vi.fn().mockReturnValue('1'),
    isMasterClient: vi.fn().mockReturnValue(true),
    sendEvent: vi.fn(),
    broadcastAuthorityEvent: vi.fn(),
    getAllPlayerStates: vi.fn().mockReturnValue([]),
  };

  return { stub, onPlayerJoined, onPlayerLeft, onEvent };
}

describe('ClientHostNetworkAdapter.dispose', () => {
  it('unsubscribes registered observers and stops loopback handling', () => {
    const { stub, onPlayerJoined, onEvent } = createNetworkManagerStub();
    const worldManager = new WorldEntityManager(new TickManager());
    const adapter = new ClientHostNetworkAdapter(stub as unknown as NetworkManager, worldManager);

    const onJoin = vi.fn();
    const onMove = vi.fn();
    adapter.onPlayerJoin = onJoin;
    adapter.onPlayerMove = onMove;

    onPlayerJoined.notifyObservers({
      id: '2',
      name: 'remote',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      weaponId: 'Pistol',
      health: 100,
    });

    onEvent.notifyObservers({
      code: EventCode.MOVE,
      data: {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0, y: 1, z: 0 },
        weaponId: 'Pistol',
      },
      senderId: '2',
    });

    expect(onJoin).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledTimes(1);

    adapter.dispose();

    onPlayerJoined.notifyObservers({
      id: '3',
      name: 'remote2',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      weaponId: 'Pistol',
      health: 100,
    });

    onEvent.notifyObservers({
      code: EventCode.MOVE,
      data: {
        position: { x: 4, y: 5, z: 6 },
        rotation: { x: 0, y: 1, z: 0 },
        weaponId: 'Pistol',
      },
      senderId: '3',
    });

    expect(onJoin).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('ignores authority loopback sender events', () => {
    const { stub, onEvent } = createNetworkManagerStub();
    const worldManager = new WorldEntityManager(new TickManager());
    const adapter = new ClientHostNetworkAdapter(stub as unknown as NetworkManager, worldManager);
    const onMove = vi.fn();
    adapter.onPlayerMove = onMove;

    onEvent.notifyObservers({
      code: EventCode.MOVE,
      data: {
        position: { x: 9, y: 9, z: 9 },
        rotation: { x: 0, y: 1, z: 0 },
        weaponId: 'Pistol',
      },
      senderId: NetworkManager.AUTHORITY_LOOPBACK_SENDER_ID,
    });

    expect(onMove).not.toHaveBeenCalled();
  });

  it('delegates outgoing authority events through network manager broadcast path', () => {
    const { stub } = createNetworkManagerStub();
    const worldManager = new WorldEntityManager(new TickManager());
    const adapter = new ClientHostNetworkAdapter(stub as unknown as NetworkManager, worldManager);

    adapter.sendEvent(
      EventCode.HIT,
      {
        targetId: '2',
        attackerId: '1',
        damage: 10,
        newHealth: 90,
      },
      true
    );

    expect(stub.broadcastAuthorityEvent).toHaveBeenCalledTimes(1);
    expect(stub.broadcastAuthorityEvent).toHaveBeenCalledWith(
      EventCode.HIT,
      {
        targetId: '2',
        attackerId: '1',
        damage: 10,
        newHealth: 90,
      },
      true
    );
  });
});
