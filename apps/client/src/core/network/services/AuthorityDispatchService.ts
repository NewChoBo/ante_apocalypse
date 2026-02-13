import { Logger } from '@ante/common';
import {
  AuthorityEventCode,
  RequestEventCode,
  SystemEventCode,
  getTransportEventKind,
  isRequestEventCode as isRequestTransportEventCode,
} from '@ante/game-core';
import { INetworkProvider } from '../INetworkProvider';

const logger = new Logger('AuthorityDispatchService');

interface AuthorityDispatchServiceDeps {
  provider: INetworkProvider;
  isMasterClient: () => boolean;
  getSocketId: () => string | undefined;
  dispatchLocalEvent: (code: number, data: unknown, senderId: string) => void;
  authorityLoopbackSenderId: string;
}

export class AuthorityDispatchService {
  constructor(private readonly deps: AuthorityDispatchServiceDeps) {}

  public sendRequest(code: number, data: unknown, reliable: boolean = true): void {
    if (!isRequestTransportEventCode(code)) {
      logger.warn(`sendRequest called with non-request code ${code}. Routing to sendEvent.`);
      this.sendEvent(code, data, reliable);
      return;
    }

    if (this.deps.isMasterClient()) {
      const myId = this.deps.getSocketId();
      if (myId) {
        this.deps.dispatchLocalEvent(code, data, myId);
      }
      return;
    }

    this.deps.provider.publish({
      kind: 'request',
      code: code as RequestEventCode,
      data: data as never,
      reliable,
    });
  }

  public broadcastAuthorityEvent(code: number, data: unknown, reliable: boolean = true): void {
    this.deps.provider.publish({
      kind: 'authority',
      code: code as AuthorityEventCode,
      data: data as never,
      reliable,
    });

    if (this.deps.isMasterClient()) {
      this.deps.dispatchLocalEvent(code, data, this.deps.authorityLoopbackSenderId);
    }
  }

  public sendEvent(code: number, data: unknown, reliable: boolean = true): void {
    const kind = getTransportEventKind(code);

    if (kind === 'request') {
      this.sendRequest(code, data, reliable);
      return;
    }

    if (kind === 'authority') {
      this.broadcastAuthorityEvent(code, data, reliable);
      return;
    }

    if (kind === 'system') {
      this.deps.provider.publish({
        kind: 'system',
        code: code as SystemEventCode,
        data: data as never,
        reliable,
      });
      return;
    }

    logger.warn(`Unknown transport event code ${code}. Falling back to authority publish.`);
    this.broadcastAuthorityEvent(code, data, reliable);
  }
}
