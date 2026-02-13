import { describe, expect, it, vi } from 'vitest';
import { EventCode } from '@ante/common';
import {
  IPhotonClient,
  PhotonActor,
  RoomOptions,
  ReceiverGroup,
} from '@ante/game-core';
import { PhotonProvider } from '../core/network/providers/PhotonProvider';
import { NetworkProviderEvent } from '../core/network/INetworkProvider';

interface PhotonClientBundle {
  client: IPhotonClient;
  localActor: PhotonActor;
  remoteActor: PhotonActor;
}

function createActor(actorNr: number, name: string): PhotonActor {
  return {
    actorNr,
    name,
    setName: vi.fn<(nextName: string) => void>(),
  } as unknown as PhotonActor;
}

function createPhotonClientBundle(): PhotonClientBundle {
  const localActor = createActor(1, 'local');
  const remoteActor = createActor(2, 'remote');

  const room = {
    masterClientId: 1,
    name: 'room-alpha',
    actors: {
      1: localActor,
      2: remoteActor,
    },
    getCustomProperty: vi.fn<(key: string) => unknown>().mockReturnValue(null),
  } as unknown as import('photon-realtime').LoadBalancing.Room;

  const client: IPhotonClient = {
    onStateChange: (): void => undefined,
    onEvent: (): void => undefined,
    onActorJoin: (): void => undefined,
    onActorLeave: (): void => undefined,
    onRoomListUpdate: (): void => undefined,
    onError: (): void => undefined,
    raiseEvent: vi.fn<
      (
        code: number,
        data: unknown,
        options?: { receivers?: number; cache?: number; targetActors?: number[] }
      ) => void
    >(),
    connectToRegionMaster: vi.fn<(region: string) => void>(),
    disconnect: vi.fn<() => void>(),
    createRoom: vi.fn<(name: string, options?: RoomOptions) => void>(),
    joinRoom: vi.fn<(name: string, options?: RoomOptions) => void>(),
    leaveRoom: vi.fn<() => void>(),
    isConnectedToMaster: vi.fn<() => boolean>().mockReturnValue(true),
    isInLobby: vi.fn<() => boolean>().mockReturnValue(true),
    isJoinedToRoom: vi.fn<() => boolean>().mockReturnValue(true),
    myActor: vi.fn<() => import('photon-realtime').LoadBalancing.Actor>().mockReturnValue(localActor),
    myRoom: vi.fn<() => import('photon-realtime').LoadBalancing.Room>().mockReturnValue(room),
    loadBalancingPeer: {
      getServerTime: vi.fn<() => number>().mockReturnValue(123),
    },
    availableRooms: vi.fn<() => unknown[]>().mockReturnValue([]),
    setUserId: vi.fn<(userId: string) => void>(),
  };

  return { client, localActor, remoteActor };
}

function createProvider(client: IPhotonClient): PhotonProvider {
  return new PhotonProvider({
    client,
    appId: 'test-app',
    appVersion: '1.0.0-test',
    region: 'us',
    enableWebSocketImplSetup: false,
  });
}

describe('PhotonProvider', () => {
  it('publish routes request to master and authority to others', () => {
    const { client } = createPhotonClientBundle();
    const provider = createProvider(client);

    provider.publish({
      kind: 'request',
      code: EventCode.MOVE,
      data: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        weaponId: 'Pistol',
      },
      reliable: true,
    });

    provider.publish({
      kind: 'authority',
      code: EventCode.HIT,
      data: {
        targetId: '2',
        attackerId: '1',
        damage: 10,
        newHealth: 90,
      },
      reliable: false,
    });

    expect(client.raiseEvent).toHaveBeenNthCalledWith(1, EventCode.MOVE, expect.any(Object), {
      receivers: ReceiverGroup.MasterClient,
      cache: 1,
    });
    expect(client.raiseEvent).toHaveBeenNthCalledWith(2, EventCode.HIT, expect.any(Object), {
      receivers: ReceiverGroup.Others,
      cache: 0,
    });
  });

  it('subscribe receives transport events and unsubscribe stops notifications', () => {
    const { client } = createPhotonClientBundle();
    const provider = createProvider(client);
    const observer = vi.fn<(event: NetworkProviderEvent) => void>();

    const unsubscribe = provider.subscribe(observer);

    client.onEvent(
      EventCode.HIT,
      {
        targetId: '2',
        attackerId: '1',
        damage: 5,
        newHealth: 95,
      },
      2
    );

    expect(observer).toHaveBeenCalledTimes(1);
    expect(observer.mock.calls[0][0]).toMatchObject({
      type: 'transport',
      event: {
        kind: 'authority',
        code: EventCode.HIT,
        senderId: '2',
      },
    });

    unsubscribe();
    client.onEvent(EventCode.HIT, { targetId: '2', attackerId: '1', damage: 5, newHealth: 95 }, 2);

    expect(observer).toHaveBeenCalledTimes(1);
  });

  it('ignores unknown transport event code', () => {
    const { client } = createPhotonClientBundle();
    const provider = createProvider(client);
    const observer = vi.fn<(event: NetworkProviderEvent) => void>();
    provider.subscribe(observer);

    client.onEvent(999, { foo: 'bar' }, 2);

    expect(observer).not.toHaveBeenCalled();
  });

  it('emits masterClientSwitched when actor leaves and local client is master', () => {
    const { client, remoteActor } = createPhotonClientBundle();
    const provider = createProvider(client);
    const observer = vi.fn<(event: NetworkProviderEvent) => void>();
    provider.subscribe(observer);

    client.onActorLeave(remoteActor);

    expect(observer).toHaveBeenCalledWith({
      type: 'playerLeft',
      userId: '2',
    });
    expect(observer).toHaveBeenCalledWith({
      type: 'masterClientSwitched',
      newMasterId: '1',
    });
  });

  it('connect applies configured region and local actor naming', async () => {
    const { client, localActor } = createPhotonClientBundle();
    const provider = createProvider(client);

    const connected = await provider.connect('player-1');

    expect(connected).toBe(true);
    expect(client.setUserId).toHaveBeenCalledWith('player-1');
    expect(localActor.setName).toHaveBeenCalledWith('player-1');
    expect(client.connectToRegionMaster).toHaveBeenCalledWith('us');
  });
});
