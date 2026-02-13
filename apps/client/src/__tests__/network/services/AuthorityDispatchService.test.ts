import { describe, expect, it, vi } from 'vitest';
import { EventCode } from '@ante/common';
import { INetworkProvider } from '../../../core/network/INetworkProvider';
import { AuthorityDispatchService } from '../../../core/network/services/AuthorityDispatchService';

interface DispatchBundle {
  service: AuthorityDispatchService;
  publish: ReturnType<typeof vi.fn>;
  dispatchLocalEvent: ReturnType<typeof vi.fn>;
}

function createDispatchBundle(master: boolean): DispatchBundle {
  const publish = vi.fn();
  const dispatchLocalEvent = vi.fn();

  const provider: INetworkProvider = {
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn(),
    leaveRoom: vi.fn(),
    createRoom: vi.fn().mockResolvedValue(true),
    joinRoom: vi.fn().mockResolvedValue(true),
    getRoomList: vi.fn().mockResolvedValue([]),
    publish,
    subscribe: vi.fn(() => () => undefined),
    getLocalPlayerId: vi.fn().mockReturnValue(master ? '1' : '2'),
    getServerTime: vi.fn().mockReturnValue(0),
    isMasterClient: vi.fn().mockReturnValue(master),
    getActors: vi.fn().mockReturnValue(new Map()),
    getCurrentRoomProperty: vi.fn().mockReturnValue(null),
  };

  const service = new AuthorityDispatchService({
    provider,
    isMasterClient: (): boolean => master,
    getSocketId: (): string | undefined => (master ? '1' : '2'),
    dispatchLocalEvent,
    authorityLoopbackSenderId: '__authority__',
  });

  return { service, publish, dispatchLocalEvent };
}

describe('AuthorityDispatchService', (): void => {
  it('publishes request for non-master client', (): void => {
    const { service, publish, dispatchLocalEvent } = createDispatchBundle(false);

    service.sendRequest(EventCode.FIRE, { weaponId: 'Pistol' }, true);

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith({
      kind: 'request',
      code: EventCode.FIRE,
      data: { weaponId: 'Pistol' },
      reliable: true,
    });
    expect(dispatchLocalEvent).not.toHaveBeenCalled();
  });

  it('loops request locally for master client', (): void => {
    const { service, publish, dispatchLocalEvent } = createDispatchBundle(true);

    service.sendRequest(EventCode.RELOAD, { playerId: '1', weaponId: 'Rifle' }, true);

    expect(publish).not.toHaveBeenCalled();
    expect(dispatchLocalEvent).toHaveBeenCalledTimes(1);
    expect(dispatchLocalEvent).toHaveBeenCalledWith(
      EventCode.RELOAD,
      { playerId: '1', weaponId: 'Rifle' },
      '1'
    );
  });

  it('broadcasts authority event and loops locally for master client', (): void => {
    const { service, publish, dispatchLocalEvent } = createDispatchBundle(true);

    service.broadcastAuthorityEvent(
      EventCode.HIT,
      {
        targetId: '2',
        attackerId: '1',
        damage: 10,
        newHealth: 90,
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
        damage: 10,
        newHealth: 90,
      },
      reliable: true,
    });
    expect(dispatchLocalEvent).toHaveBeenCalledTimes(1);
    expect(dispatchLocalEvent).toHaveBeenCalledWith(
      EventCode.HIT,
      {
        targetId: '2',
        attackerId: '1',
        damage: 10,
        newHealth: 90,
      },
      '__authority__'
    );
  });

  it('routes system events via provider publish', (): void => {
    const { service, publish, dispatchLocalEvent } = createDispatchBundle(false);

    service.sendEvent(EventCode.MAP_SYNC, { mapId: 'training_ground' }, true);

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith({
      kind: 'system',
      code: EventCode.MAP_SYNC,
      data: { mapId: 'training_ground' },
      reliable: true,
    });
    expect(dispatchLocalEvent).not.toHaveBeenCalled();
  });
});


