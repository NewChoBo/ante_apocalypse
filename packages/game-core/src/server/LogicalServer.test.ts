import { MeshBuilder, Scene } from '@babylonjs/core';
import { EventCode, HitEventData, PlayerState, RequestHitData } from '@ante/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LogicalServer } from './LogicalServer.js';
import { IServerAssetLoader } from './IServerAssetLoader.js';
import { IServerNetworkAuthority } from './IServerNetworkAuthority.js';
import { HitRegistrationSystem } from '../systems/HitRegistrationSystem.js';
import { WaveSurvivalRule } from '../rules/WaveSurvivalRule.js';
import { LegacyWaveSurvivalRule } from '../rules/LegacyWaveSurvivalRule.js';
import { WorldSimulation } from '../simulation/WorldSimulation.js';

interface MockNetworkBundle {
  network: IServerNetworkAuthority;
  joinPlayer: (id: string, name: string) => void;
  broadcastHit: ReturnType<typeof vi.fn>;
  broadcastDeath: ReturnType<typeof vi.fn>;
  broadcastRespawn: ReturnType<typeof vi.fn>;
  sendEvent: ReturnType<typeof vi.fn>;
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

function createNetwork(roomProps: Record<string, unknown> = {}): MockNetworkBundle {
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
  const sendEvent = vi.fn<(code: number, data: unknown, reliable?: boolean) => void>();

  const network = {
    getSocketId: (): string => 'server',
    isMasterClient: (): boolean => true,
    createGameRoom: async (): Promise<void> => undefined,
    joinGameRoom: async (): Promise<void> => undefined,
    registerAllActors: (): void => undefined,
    sendRequest: (_code: number, _data: unknown, _reliable?: boolean): void => undefined,
    sendEvent: (code: number, eventData: unknown, reliable?: boolean): void => {
      sendEvent(code, eventData, reliable);
    },
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
    getCurrentRoomProperty: <T = unknown>(key: string): T | undefined => roomProps[key] as T | undefined,
    onPlayerJoin: undefined,
    onPlayerLeave: undefined,
    onPlayerMove: undefined,
    onFireRequest: undefined,
    onReloadRequest: undefined,
    onHitRequest: undefined,
    onSyncWeaponRequest: undefined,
    onUpgradePickRequest: undefined,
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
    sendEvent,
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
  it.each(['survival', 'deathmatch', 'shooting_range'] as const)(
    'broadcasts GAME_END when %s mode reports completion',
    (mode) => {
      const roomProps = mode === 'survival' ? { survivalRuleset: 'v2' } : {};
      const { network, sendEvent } = createNetwork(roomProps);
      const server = new LogicalServer(network, createAssetLoader(), { gameMode: mode });
      activeServers.push(server);

      const simulation = (server as unknown as { simulation: WorldSimulation }).simulation;
      const rule = simulation.gameRule;
      expect(rule).toBeTruthy();

      vi.spyOn(rule!, 'checkGameEnd').mockReturnValue({
        reason: `${mode} completed`,
      });

      (server as unknown as { checkAndBroadcastGameEnd: () => void }).checkAndBroadcastGameEnd();
      (server as unknown as { checkAndBroadcastGameEnd: () => void }).checkAndBroadcastGameEnd();

      expect(sendEvent).toHaveBeenCalledTimes(1);
      expect(sendEvent).toHaveBeenCalledWith(
        EventCode.GAME_END,
        expect.objectContaining({
          reason: `${mode} completed`,
          stats: expect.objectContaining({
            durationSeconds: expect.any(Number),
            kills: expect.any(Object),
            deaths: expect.any(Object),
            damageDealt: expect.any(Object),
          }),
        }),
        true
      );
    }
  );

  it('uses v2 survival ruleset only when room property is explicitly set', () => {
    const v2Server = new LogicalServer(
      createNetwork({ survivalRuleset: 'v2' }).network,
      createAssetLoader(),
      { gameMode: 'survival' }
    );
    activeServers.push(v2Server);

    const legacyServer = new LogicalServer(createNetwork().network, createAssetLoader(), {
      gameMode: 'survival',
    });
    activeServers.push(legacyServer);

    const v2Rule = (v2Server as unknown as { simulation: { gameRule: unknown } }).simulation.gameRule;
    const legacyRule = (legacyServer as unknown as { simulation: { gameRule: unknown } }).simulation
      .gameRule;

    expect(v2Rule).toBeInstanceOf(WaveSurvivalRule);
    expect(legacyRule).toBeInstanceOf(LegacyWaveSurvivalRule);
  });

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

  it('handles UPGRADE_PICK request and broadcasts UPGRADE_APPLY for v2 survival', () => {
    const { network, joinPlayer, sendEvent } = createNetwork({ survivalRuleset: 'v2' });
    const server = new LogicalServer(network, createAssetLoader(), { gameMode: 'survival' });
    activeServers.push(server);

    joinPlayer('1', 'Shooter');

    const simulation = (server as unknown as { simulation: WorldSimulation }).simulation;
    const rule = simulation.gameRule as WaveSurvivalRule;

    // Build an offer directly for deterministic request handling test.
    (rule as unknown as { createUpgradeOffers: () => void }).createUpgradeOffers();
    const offers = rule.consumeUpgradeOfferEvents();
    const offer = offers[0];
    expect(offer).toBeDefined();

    network.onUpgradePickRequest?.('1', {
      offerId: offer.offerId,
      upgradeId: offer.options[0].id,
    });

    (server as unknown as { processRuleSideEffects: () => void }).processRuleSideEffects();

    expect(sendEvent).toHaveBeenCalledWith(
      EventCode.UPGRADE_APPLY,
      expect.objectContaining({
        playerId: '1',
        offerId: offer.offerId,
        upgradeId: offer.options[0].id,
        stacks: 1,
      }),
      true
    );
  });

  it('broadcasts ENEMY_HIT and DESTROY_ENEMY when enemy dies', () => {
    const { network, joinPlayer, sendEvent } = createNetwork();
    const server = new LogicalServer(network, createAssetLoader(), { gameMode: 'survival' });
    activeServers.push(server);

    joinPlayer('1', 'Shooter');
    server.processSyncWeapon('1', 'Bat');

    const enemyManager = (
      server as unknown as {
        enemyManager: {
          requestSpawnEnemy: (id: string, position: { x: number; y: number; z: number }) => boolean;
        };
      }
    ).enemyManager;
    enemyManager.requestSpawnEnemy('enemy_test', { x: 0, y: 0, z: 5 });

    vi.spyOn(HitRegistrationSystem, 'validateHit').mockReturnValue({
      isValid: true,
      part: 'body',
      method: 'strict',
    });

    server.processHitRequest('1', createHitRequest('enemy_test'));

    expect(sendEvent).toHaveBeenCalledWith(EventCode.ENEMY_HIT, { id: 'enemy_test', damage: 100 }, undefined);
    expect(sendEvent).toHaveBeenCalledWith(EventCode.DESTROY_ENEMY, { id: 'enemy_test' }, undefined);
  });

  it('ignores target hits after target gameplay removal', () => {
    const { network, joinPlayer, sendEvent } = createNetwork();
    const server = new LogicalServer(network, createAssetLoader(), { gameMode: 'survival' });
    activeServers.push(server);

    joinPlayer('1', 'Shooter');
    server.processSyncWeapon('1', 'Bat');

    const targetSpawner = (
      server as unknown as {
        targetSpawner: {
          broadcastTargetSpawn: (
            id: string,
            type: string,
            position: { x: number; y: number; z: number },
            isMoving: boolean
          ) => void;
        };
      }
    ).targetSpawner;
    targetSpawner.broadcastTargetSpawn('target_test', 'static_target', { x: 0, y: 1, z: 7 }, false);

    vi.spyOn(HitRegistrationSystem, 'validateHit').mockReturnValue({
      isValid: true,
      part: 'body',
      method: 'strict',
    });

    server.processHitRequest('1', createHitRequest('target_test'));

    expect(sendEvent).not.toHaveBeenCalledWith(
      EventCode.TARGET_HIT,
      expect.anything(),
      expect.anything()
    );
    expect(sendEvent).not.toHaveBeenCalledWith(
      EventCode.TARGET_DESTROY,
      expect.anything(),
      expect.anything()
    );
  });
});
