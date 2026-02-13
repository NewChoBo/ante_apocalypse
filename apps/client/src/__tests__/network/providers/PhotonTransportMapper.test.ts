import { describe, expect, it } from 'vitest';
import { EventCode } from '@ante/common';
import { ReceiverGroup } from '@ante/game-core';
import {
  toInboundTransportEvent,
  toPhotonRaiseEventOptions,
} from '../../../core/network/providers/PhotonTransportMapper';

describe('PhotonTransportMapper', (): void => {
  it('maps transport event code to inbound transport event', (): void => {
    const event = toInboundTransportEvent(EventCode.FIRE, { weaponId: 'Pistol' }, 3);

    expect(event).toMatchObject({
      kind: 'request',
      code: EventCode.FIRE,
      data: { weaponId: 'Pistol' },
      senderId: '3',
    });
  });

  it('returns null for unknown transport event code', (): void => {
    const event = toInboundTransportEvent(999, { foo: 'bar' }, 1);
    expect(event).toBeNull();
  });

  it('maps outbound request to master receiver with reliable cache', (): void => {
    const options = toPhotonRaiseEventOptions({
      kind: 'request',
      code: EventCode.FIRE,
      data: { weaponId: 'Rifle' },
    });

    expect(options).toEqual({
      receivers: ReceiverGroup.MasterClient,
      cache: 1,
    });
  });

  it('maps outbound authority event to others receiver with unreliable cache', (): void => {
    const options = toPhotonRaiseEventOptions({
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

    expect(options).toEqual({
      receivers: ReceiverGroup.Others,
      cache: 0,
    });
  });
});


