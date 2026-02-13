import { describe, expect, it, vi } from 'vitest';
import { LogicalServer } from '@ante/game-core';
import { RoomManager } from '../../../core/network/RoomManager';
import { NetworkSessionService } from '../../../core/network/services/NetworkSessionService';

function createServiceDeps(): {
  deps: {
    roomManager: RoomManager;
    setLocalServer: ReturnType<typeof vi.fn<(server: LogicalServer | null) => void>>;
    isMasterClient: ReturnType<typeof vi.fn<() => boolean>>;
    requestInitialState: ReturnType<typeof vi.fn<() => void>>;
    clearSessionObservers: ReturnType<typeof vi.fn<() => void>>;
    isLocalServerRunning: ReturnType<typeof vi.fn<() => boolean>>;
    startLocalSession: ReturnType<
      typeof vi.fn<(roomName: string, mapId: string, gameMode: string) => Promise<void>>
    >;
    takeoverLocalSession: ReturnType<typeof vi.fn<(roomName: string) => Promise<void>>>;
    stopLocalSession: ReturnType<typeof vi.fn<() => void>>;
    getLogicalServer: ReturnType<typeof vi.fn<() => LogicalServer | null>>;
  };
  logicalServer: LogicalServer;
} {
  const logicalServer = {} as LogicalServer;

  const roomManager = {
    createRoom: vi.fn<(name: string, mapId: string) => Promise<boolean>>().mockResolvedValue(true),
    joinRoom: vi.fn<(name: string) => Promise<boolean>>().mockResolvedValue(true),
    leaveRoom: vi.fn<() => void>(),
  } as unknown as RoomManager;

  const deps = {
    roomManager,
    setLocalServer: vi.fn<(server: LogicalServer | null) => void>(),
    isMasterClient: vi.fn<() => boolean>().mockReturnValue(false),
    requestInitialState: vi.fn<() => void>(),
    clearSessionObservers: vi.fn<() => void>(),
    isLocalServerRunning: vi.fn<() => boolean>().mockReturnValue(false),
    startLocalSession:
      vi
        .fn<(roomName: string, mapId: string, gameMode: string) => Promise<void>>()
        .mockResolvedValue(undefined),
    takeoverLocalSession: vi.fn<(roomName: string) => Promise<void>>().mockResolvedValue(undefined),
    stopLocalSession: vi.fn<() => void>(),
    getLogicalServer: vi.fn<() => LogicalServer | null>().mockReturnValue(logicalServer),
  };

  return { deps, logicalServer };
}

describe('NetworkSessionService', () => {
  it('hosts game by creating room and starting local session', async () => {
    const { deps, logicalServer } = createServiceDeps();
    const service = new NetworkSessionService(deps);

    const hosted = await service.hostGame('alpha', 'training_ground', 'deathmatch');

    expect(hosted).toBe(true);
    expect(deps.roomManager.createRoom).toHaveBeenCalledWith('alpha', 'training_ground');
    expect(deps.startLocalSession).toHaveBeenCalledWith('alpha', 'training_ground', 'deathmatch');
    expect(deps.setLocalServer).toHaveBeenCalledWith(logicalServer);
  });

  it('joins game and requests initial state', async () => {
    const { deps } = createServiceDeps();
    const service = new NetworkSessionService(deps);

    const joined = await service.joinGame('alpha');

    expect(joined).toBe(true);
    expect(deps.roomManager.joinRoom).toHaveBeenCalledWith('alpha');
    expect(deps.requestInitialState).toHaveBeenCalledTimes(1);
    expect(deps.takeoverLocalSession).not.toHaveBeenCalled();
  });

  it('handles takeover when joiner is master', async () => {
    const { deps, logicalServer } = createServiceDeps();
    deps.isMasterClient.mockReturnValue(true);
    const service = new NetworkSessionService(deps);

    const joined = await service.joinGame('alpha');

    expect(joined).toBe(true);
    expect(deps.takeoverLocalSession).toHaveBeenCalledWith('alpha');
    expect(deps.setLocalServer).toHaveBeenCalledWith(logicalServer);
  });

  it('leaves game by stopping local session, leaving room, and clearing observers', () => {
    const { deps } = createServiceDeps();
    deps.isLocalServerRunning.mockReturnValue(true);
    const service = new NetworkSessionService(deps);

    service.leaveGame();

    expect(deps.stopLocalSession).toHaveBeenCalledTimes(1);
    expect(deps.setLocalServer).toHaveBeenCalledWith(null);
    expect(deps.roomManager.leaveRoom).toHaveBeenCalledTimes(1);
    expect(deps.clearSessionObservers).toHaveBeenCalledTimes(1);
  });
});


