import {
  AuthorityEventCode,
  InboundTransportEvent,
  OutboundTransportEvent,
  RequestEventCode,
  ReceiverGroup,
  SystemEventCode,
  getTransportEventKind,
} from '@ante/game-core';

export interface PhotonRaiseEventOptions {
  receivers: number;
  cache: number;
}

export function toInboundTransportEvent(
  code: number,
  data: unknown,
  actorNr: number
): InboundTransportEvent | null {
  const kind = getTransportEventKind(code);
  if (!kind) return null;

  if (kind === 'request') {
    return {
      kind: 'request',
      code: code as RequestEventCode,
      data: data as never,
      senderId: actorNr.toString(),
    };
  }
  if (kind === 'authority') {
    return {
      kind: 'authority',
      code: code as AuthorityEventCode,
      data: data as never,
      senderId: actorNr.toString(),
    };
  }
  return {
    kind: 'system',
    code: code as SystemEventCode,
    data: data as never,
    senderId: actorNr.toString(),
  };
}

export function toPhotonRaiseEventOptions(event: OutboundTransportEvent): PhotonRaiseEventOptions {
  const reliable = event.reliable ?? true;
  return {
    receivers: event.kind === 'request' ? ReceiverGroup.MasterClient : ReceiverGroup.Others,
    cache: reliable ? 1 : 0,
  };
}
