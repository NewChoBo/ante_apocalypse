import { MeshBuilder, Scene } from '@babylonjs/core';
import { EventCode, HitEventData, PlayerState, RequestHitData } from '@ante/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LogicalServer } from './LogicalServer.js';
import { IServerAssetLoader } from './IServerAssetLoader.js';
import { IServerNetworkAuthority } from './IServerNetworkAuthority.js';
import { HitRegistrationSystem } from '../systems/HitRegistrationSystem.js';

interface MockNetworkBundle {
  network: IServerNetworkAuthority;
  joinPlayer: (id: string, name: string) => void;
  broadcastHit: ReturnType<typeof vi.fn>;
  broadcastDeath: ReturnType<typeof vi.fn>;
  broadcastRespawn: ReturnType<typeof vi.fn>;
}

const activeServers: LogicalServer[] = [];

function createAssetLoader(): IServerAssetLoader {
  return {
    loadModel: async (scene: Scene, _modelName: string) => ({
      meshes: [MeshBuilder.CreateBox('test_model_mesh', { size: 1 }, scene)],
      skeletons: [],
    }),
  };
}

function createHitRequest(targetId: string): RequestHitData {
  return {
    targetId,
    damage: 1,
    part: 'body',
    weaponId: 'Pistol',
    origin: { x: 0, y: 1.75, z: 0 },
    direction: { x: 0, y: 0, z: 1 },
  };
}

function createNetwork(): MockNetworkBundle {
  const states = new Map<string, PlayerState>();
  const broadcastHit = vi.fn<(hitData: HitEventData, code?: number) => void>();
  const broadcastDeath = vi.fn<
    (
      targetId: string,
      attackerId: string,
      respawnDelaySeconds?: number,
      canRespawn?: boolean,
      gameMode?: string
    ) => void
  >();
  const broadcastRespawn = vi.fn<(playerId: string, position: { x: number; y: number; z: number }) => void>();

  const network = {
    getSocketId: (): string => 'server',
    isMasterClient: (): boolean => true,
    createGameRoom: async (): Promise<void> => undefined,
    joinGameRoom: async (): Promise<void> => undefined,
    registerAllActors: (): void => undefined,
    sendRequest: (_code: number, _data: unknown, _reliable?: boolean): void => undefined,
    sendEvent: (_code: number, _data: unknown, _reliable?: boolean): void => undefined,
    broadcastState: (): void => undefined,
    broadcastHit: (hitData: HitEventData, code: number = EventCode.HIT): void => {
      broadcastHit(hitData, code);
    },
    broadcastDeath: (
      targetId: string,
      attackerId: string,
      respawnDelaySeconds?: number,
      canRespawn?: boolean,
      gameMode?: string
    ): void => {
      broadcastDeath(targetId, attackerId, respawnDelaySeconds, canRespawn, gameMode);
    },
    broadcastRespawn: (playerId: string, position: { x: number; y: number; z: number }): void => {
      const prev = states.get(playerId);
      states.set(playerId, {
        id: playerId,
        name: prev?.name ?? 'Unknown',
        position,
        rotation: prev?.rotation ?? { x: 0, y: 0, z: 0 },
        weaponId: prev?.weaponId ?? 'Pistol',
        health: 100,
      });
      broadcastRespawn(playerId, position);
    },
    broadcastReload: (_playerId: string, _weaponId: string): void => undefined,
    getPlayerState: (id: string): PlayerState | undefined => states.get(id),
    getCurrentRoomProperty: <T = unknown>(_key: string): T | undefined => undefined,
    onPlayerJoin: undefined,
    onPlayerLeave: undefined,
    onPlayerMove: undefined,
    onFireRequest: undefined,
    onReloadRequest: undefined,
    onHitRequest: undefined,
    onSyncWeaponRequest: undefined,
  } as IServerNetworkAuthority;

  const joinPlayer = (id: string, name: string): void => {
    states.set(id, {
      id,
      name,
      position: { x: 0, y: 1.75, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      weaponId: 'Pistol',
      health: 100,
    });
    network.onPlayerJoin?.(id, name);
  };

  return {
    network,
    joinPlayer,
    broadcastHit,
    broadcastDeath,
    broadcastRespawn,
  };
}

afterEach((): void => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  while (activeServers.length > 0) {
    const server = activeServers.pop();
    server?.stop();
  }
});

describe('LogicalServer.processHitRequest', () => {
  it('applies headshot multiplier and includes respawn metadata in death event', () => {
    const { network, joinPlayer, broadcastHit, broadcastDeath } = createNetwork();
    const server = new LogicalServer(network, createAssetLoader(), { gameMode: 'deathmatch' });
    activeServers.push(server);

    joinPlayer('1', 'Shooter');
    joinPlayer('2', 'Target');

    vi.spyOn(HitRegistrationSystem, 'validateHit').mockReturnValue({
      isValid: true,
      part: 'head',
      method: 'strict',
    });

    server.processHitRequest('1', createHitRequest('2'));

    expect(broadcastHit).toHaveBeenCalledTimes(1);
    const [hitPayload, eventCode] = broadcastHit.mock.calls[0] as [HitEventData, number];
    expect(eventCode).toBe(EventCode.HIT);
    expect(hitPayload).toMatchObject({
      targetId: '2',
      attackerId: '1',
      part: 'head',
      damage: 100,
      newHealth: 0,
    });

    expect(broadcastDeath).toHaveBeenCalledTimes(1);
    expect(broadcastDeath).toHaveBeenCalledWith('2', '1', 3, true, 'deathmatch');
  });

  it('respawns and resets death state so the same player can die again after delay', () => {
    vi.useFakeTimers();

    const { network, joinPlayer, broadcastDeath, broadcastRespawn } = createNetwork();
    const server = new LogicalServer(network, createAssetLoader(), { gameMode: 'deathmatch' });
    activeServers.push(server);

    joinPlayer('1', 'Shooter');
    joinPlayer('2', 'Target');
    server.processSyncWeapon('1', 'Bat');

    vi.spyOn(HitRegistrationSystem, 'validateHit').mockReturnValue({
      isValid: true,
      part: 'body',
      method: 'strict',
    });

    const hitRequest = createHitRequest('2');

    server.processHitRequest('1', hitRequest);
    server.processHitRequest('1', hitRequest);
    expect(broadcastDeath).toHaveBeenCalledTimes(1);
    expect(broadcastRespawn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(3000);
    expect(broadcastRespawn).toHaveBeenCalledTimes(1);

    server.processHitRequest('1', hitRequest);
    expect(broadcastDeath).toHaveBeenCalledTimes(2);
  });

  it('marks survival deaths as non-respawn and does not schedule respawn', () => {
    vi.useFakeTimers();

    const { network, joinPlayer, broadcastDeath, broadcastRespawn } = createNetwork();
    const server = new LogicalServer(network, createAssetLoader(), { gameMode: 'survival' });
    activeServers.push(server);

    joinPlayer('1', 'Shooter');
    joinPlayer('2', 'Target');
    server.processSyncWeapon('1', 'Bat');

    vi.spyOn(HitRegistrationSystem, 'validateHit').mockReturnValue({
      isValid: true,
      part: 'body',
      method: 'strict',
    });

    server.processHitRequest('1', createHitRequest('2'));

    expect(broadcastDeath).toHaveBeenCalledTimes(1);
    expect(broadcastDeath).toHaveBeenCalledWith('2', '1', 0, false, 'survival');

    vi.runAllTimers();
    expect(broadcastRespawn).not.toHaveBeenCalled();
  });
});
