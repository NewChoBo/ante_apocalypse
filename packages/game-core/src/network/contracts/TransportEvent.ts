import {
  NetworkEventMap,
  REQUEST_EVENT_CODES,
  AUTHORITY_EVENT_CODES,
  SYSTEM_EVENT_CODES,
  RequestEventCode,
  AuthorityEventCode,
  SystemEventCode,
  TransportEventCode,
  TransportEventKind,
  getTransportEventKind,
  isTransportEventCode,
  isRequestEventCode,
} from '@ante/common';

export type RequestPayloadMap = Pick<NetworkEventMap, RequestEventCode>;
export type AuthorityPayloadMap = Pick<NetworkEventMap, AuthorityEventCode>;
export type SystemPayloadMap = Pick<NetworkEventMap, SystemEventCode>;
export type TransportPayloadMap = RequestPayloadMap & AuthorityPayloadMap & SystemPayloadMap;

export type TransportPayload<K extends TransportEventCode> = TransportPayloadMap[K];

export type RequestTransportEvent = {
  kind: 'request';
  code: RequestEventCode;
  data: RequestPayloadMap[RequestEventCode];
  reliable?: boolean;
  senderId?: string;
};

export type AuthorityTransportEvent = {
  kind: 'authority';
  code: AuthorityEventCode;
  data: AuthorityPayloadMap[AuthorityEventCode];
  reliable?: boolean;
  senderId?: string;
};

export type SystemTransportEvent = {
  kind: 'system';
  code: SystemEventCode;
  data: SystemPayloadMap[SystemEventCode];
  reliable?: boolean;
  senderId?: string;
};

export type TransportEvent = RequestTransportEvent | AuthorityTransportEvent | SystemTransportEvent;

export type OutboundTransportEvent = Omit<TransportEvent, 'senderId'>;
export type InboundTransportEvent = TransportEvent & { senderId: string };
export type {
  RequestEventCode,
  AuthorityEventCode,
  SystemEventCode,
  TransportEventCode,
  TransportEventKind,
};
export {
  REQUEST_EVENT_CODES,
  AUTHORITY_EVENT_CODES,
  SYSTEM_EVENT_CODES,
  getTransportEventKind,
  isTransportEventCode,
  isRequestEventCode,
};
