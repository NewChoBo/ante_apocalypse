import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionManager } from '../core/network/ConnectionManager';
import {
  INetworkProvider,
  NetworkProviderSubscriber,
} from '../core/network/INetworkProvider';
import { NetworkState } from '@ante/common';

function createProviderMock(): INetworkProvider {
  const subscribers = new Set<NetworkProviderSubscriber>();
  return {
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
    getLocalPlayerId: vi.fn().mockReturnValue('local-player'),
    getServerTime: vi.fn().mockReturnValue(0),
    isMasterClient: vi.fn().mockReturnValue(false),
    getActors: vi.fn().mockReturnValue(new Map()),
    getCurrentRoomProperty: vi.fn().mockReturnValue(null),
  };
}

describe('ConnectionManager', () => {
  beforeEach((): void => {
    vi.useFakeTimers();
  });

  afterEach((): void => {
    vi.useRealTimers();
  });

  it('reconnects with injected policy when disconnected', async () => {
    const provider = createProviderMock();
    const manager = new ConnectionManager(provider, {
      delayMs: 100,
      resolveUserId: (): string => 'ReconnectUser',
    });

    manager.handleStateChange(NetworkState.Disconnected);
    vi.advanceTimersByTime(100);
    await Promise.resolve();

    expect(provider.connect).toHaveBeenCalledTimes(1);
    expect(provider.connect).toHaveBeenCalledWith('ReconnectUser');
  });

  it('does not reconnect when policy is disabled', () => {
    const provider = createProviderMock();
    const manager = new ConnectionManager(provider, {
      enabled: false,
      delayMs: 100,
      resolveUserId: (): string => 'ReconnectUser',
    });

    manager.handleStateChange(NetworkState.Error);
    vi.advanceTimersByTime(100);

    expect(provider.connect).not.toHaveBeenCalled();
  });
});
