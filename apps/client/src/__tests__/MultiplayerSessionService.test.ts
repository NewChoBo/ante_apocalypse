import { describe, expect, it, vi } from 'vitest';
import { Observable } from '@babylonjs/core';
import { InitialStatePayload, RespawnEventData } from '@ante/common';
import { WorldSimulation } from '@ante/game-core';
import { MultiplayerSessionService } from '../core/systems/session/MultiplayerSessionService';
import type { INetworkManager } from '../core/interfaces/INetworkManager';
import type { EnemyManager } from '../core/systems/EnemyManager';
import type { TargetSpawnerComponent } from '../core/components/TargetSpawnerComponent';
import type { LocalServerManager } from '../core/server/LocalServerManager';
import type { MultiplayerSystem } from '../core/systems/MultiplayerSystem';
import type { PlayerPawn } from '../core/PlayerPawn';

interface NetworkManagerMockBundle {
  networkManager: INetworkManager;
  onInitialStateReceived: Observable<InitialStatePayload>;
  onPlayerRespawn: Observable<RespawnEventData>;
}

function createNetworkManagerMock(socketId: string = 'local'): NetworkManagerMockBundle {
  const onInitialStateReceived = new Observable<InitialStatePayload>();
  const onPlayerRespawn = new Observable<RespawnEventData>();

  const networkManager = {
    onInitialStateReceived,
    onPlayerRespawn,
    getSocketId: vi.fn((): string => socketId),
  } as unknown as INetworkManager;

  return { networkManager, onInitialStateReceived, onPlayerRespawn };
}

describe('MultiplayerSessionService', (): void => {
  it('routes initial state and local respawn through injected dependencies', (): void => {
    const { networkManager, onInitialStateReceived, onPlayerRespawn } = createNetworkManagerMock();
    const enemyManager = { applyEnemyStates: vi.fn() } as unknown as EnemyManager;
    const spawnTarget = vi.fn();
    const targetSpawner = { spawnTarget } as unknown as TargetSpawnerComponent;
    const multiplayerSystem = {
      applyPlayerStates: vi.fn(),
      update: vi.fn(),
      dispose: vi.fn(),
    } as unknown as MultiplayerSystem;
    const createMultiplayerSystem = vi.fn((): MultiplayerSystem => multiplayerSystem);
    const createSimulation = vi.fn((): WorldSimulation => ({}) as WorldSimulation);
    const onLocalRespawn = vi.fn();

    const service = new MultiplayerSessionService({
      scene: {} as never,
      shadowGenerator: {} as never,
      networkManager,
      worldManager: {} as never,
      tickManager: {} as never,
      pickupManager: {} as never,
      localServerManager: { isServerRunning: vi.fn((): boolean => false) } as unknown as LocalServerManager,
      getEnemyManager: (): EnemyManager => enemyManager,
      getTargetSpawner: (): TargetSpawnerComponent => targetSpawner,
      onLocalRespawn,
      createMultiplayerSystem,
      createSimulation,
    });

    const playerPawn = {} as PlayerPawn;
    service.initialize(playerPawn, 'Commander');

    const payload: InitialStatePayload = {
      players: [
        {
          id: 'other',
          name: 'Other',
          position: { x: 1, y: 2, z: 3 },
          rotation: { x: 0, y: 1, z: 0 },
          weaponId: 'Rifle',
          health: 100,
        },
      ],
      enemies: [
        {
          id: 'enemy1',
          position: { x: 10, y: 0, z: 5 },
          rotation: { x: 0, y: 0, z: 0 },
          health: 80,
          isDead: false,
        },
      ],
      targets: [
        {
          id: 'target1',
          type: 'static',
          isMoving: false,
          position: { x: 3, y: 1, z: 2 },
        },
      ],
    };

    onInitialStateReceived.notifyObservers(payload);
    onPlayerRespawn.notifyObservers({
      playerId: 'local',
      position: { x: 0, y: 2, z: 0 },
    });
    onPlayerRespawn.notifyObservers({
      playerId: 'other',
      position: { x: 9, y: 2, z: 9 },
    });

    expect(createMultiplayerSystem).toHaveBeenCalledWith(playerPawn, 'Commander');
    expect(createSimulation).toHaveBeenCalledTimes(1);
    expect(enemyManager.applyEnemyStates).toHaveBeenCalledWith(payload.enemies);
    expect(multiplayerSystem.applyPlayerStates).toHaveBeenCalledWith(payload.players);
    expect(spawnTarget).toHaveBeenCalledTimes(1);
    expect(spawnTarget.mock.calls[0][0]).toMatchObject({ x: 3, y: 1, z: 2 });
    expect(onLocalRespawn).toHaveBeenCalledTimes(1);
    expect(onLocalRespawn).toHaveBeenCalledWith({ x: 0, y: 2, z: 0 });
  });

  it('does not create local simulation when local server is already running', (): void => {
    const { networkManager } = createNetworkManagerMock();
    const createSimulation = vi.fn((): WorldSimulation => ({}) as WorldSimulation);

    const service = new MultiplayerSessionService({
      scene: {} as never,
      shadowGenerator: {} as never,
      networkManager,
      worldManager: {} as never,
      tickManager: {} as never,
      pickupManager: {} as never,
      localServerManager: { isServerRunning: vi.fn((): boolean => true) } as unknown as LocalServerManager,
      getEnemyManager: (): EnemyManager => ({ applyEnemyStates: vi.fn() } as unknown as EnemyManager),
      getTargetSpawner: (): TargetSpawnerComponent =>
        ({ spawnTarget: vi.fn() } as unknown as TargetSpawnerComponent),
      onLocalRespawn: vi.fn(),
      createMultiplayerSystem: vi.fn(
        (): MultiplayerSystem =>
          ({
            applyPlayerStates: vi.fn(),
            update: vi.fn(),
            dispose: vi.fn(),
          } as unknown as MultiplayerSystem)
      ),
      createSimulation,
    });

    service.initialize({} as PlayerPawn, 'Commander');

    expect(createSimulation).not.toHaveBeenCalled();
    expect(service.getSimulation()).toBeNull();
  });

  it('cleans up observers and disposes multiplayer system', (): void => {
    const { networkManager, onInitialStateReceived, onPlayerRespawn } = createNetworkManagerMock();
    const multiplayerSystem = {
      applyPlayerStates: vi.fn(),
      update: vi.fn(),
      dispose: vi.fn(),
    } as unknown as MultiplayerSystem;
    const onLocalRespawn = vi.fn();

    const service = new MultiplayerSessionService({
      scene: {} as never,
      shadowGenerator: {} as never,
      networkManager,
      worldManager: {} as never,
      tickManager: {} as never,
      pickupManager: {} as never,
      localServerManager: { isServerRunning: vi.fn((): boolean => false) } as unknown as LocalServerManager,
      getEnemyManager: (): EnemyManager => ({ applyEnemyStates: vi.fn() } as unknown as EnemyManager),
      getTargetSpawner: (): TargetSpawnerComponent =>
        ({ spawnTarget: vi.fn() } as unknown as TargetSpawnerComponent),
      onLocalRespawn,
      createMultiplayerSystem: vi.fn((): MultiplayerSystem => multiplayerSystem),
      createSimulation: vi.fn((): WorldSimulation => ({}) as WorldSimulation),
    });

    service.initialize({} as PlayerPawn, 'Commander');
    service.dispose();

    onInitialStateReceived.notifyObservers({
      players: [],
      enemies: [],
      targets: [],
    });
    onPlayerRespawn.notifyObservers({
      playerId: 'local',
      position: { x: 0, y: 2, z: 0 },
    });

    expect(multiplayerSystem.dispose).toHaveBeenCalledTimes(1);
    expect(onLocalRespawn).not.toHaveBeenCalled();
  });
});
