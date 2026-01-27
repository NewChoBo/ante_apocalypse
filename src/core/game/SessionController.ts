import { Scene, Vector3, ShadowGenerator, UniversalCamera, AssetContainer } from '@babylonjs/core';
import { IGameSystem } from '../../types/IGameSystem';
import { NetworkMediator } from '../network/NetworkMediator';
import { PlayerPawn } from '../pawns/PlayerPawn';
import { playerHealthStore, inventoryStore } from '../store/GameStore';
import { PlayerController } from '../controllers/PlayerController';
import { LevelData } from '../loaders/LevelLoader';
import { CombatComponent } from '../components/combat/CombatComponent';
import { HUD } from '../../ui/HUD';
import { InventoryUI } from '../../ui/inventory/InventoryUI';
import { InventoryManager } from '../inventory/InventoryManager';
import { GlobalInputManager } from '../input/GlobalInputManager';
import { NetworkManager } from '../network/NetworkManager';
import { MultiplayerSystem } from '../network/MultiplayerSystem';
import { PickupManager } from '../entities/PickupManager';
import { PickupType } from '../entities/PickupActor';
import { TargetSpawnerComponent } from '../components/network/TargetSpawnerComponent';
import { WorldEntityManager } from '../entities/WorldEntityManager';
import { IWeapon } from '../../types/IWeapon';
import { EnemyManager } from '../entities/EnemyManager';
import { AssetLoader } from '../loaders/AssetLoader';
import { LifetimeManager } from './LifetimeManager';
import { GameObservables } from '../events/GameObservables';
import {
  EventCode,
  InitialStatePayload,
  PlayerData,
  TargetSpawnData,
  EnemyUpdateData,
} from '../../shared/protocol/NetworkProtocol';

export class SessionController implements IGameSystem {
  private scene: Scene;
  private canvas: HTMLCanvasElement;
  private shadowGenerator: ShadowGenerator;
  private assetContainer: AssetContainer;

  private playerPawn: PlayerPawn | null = null;
  private playerController: PlayerController | null = null;
  private multiplayerSystem: MultiplayerSystem | null = null;
  private hud: HUD | null = null;
  private inventoryUI: InventoryUI | null = null;
  private enemyManager: EnemyManager | null = null;
  private targetSpawner: TargetSpawnerComponent | null = null;
  private healthUnsub: (() => void) | null = null;

  constructor(scene: Scene, canvas: HTMLCanvasElement, shadowGenerator: ShadowGenerator) {
    this.scene = scene;
    this.canvas = canvas;
    this.shadowGenerator = shadowGenerator;
    this.assetContainer = new AssetContainer(this.scene);
    NetworkMediator.getInstance();
  }

  public async initialize(): Promise<void> {
    // 기본 초기화 ( Game.ts 에서 levelData 주입하여 호출되게 변경 예정 )
  }

  public async setup(levelData: LevelData, playerName: string = 'Anonymous'): Promise<void> {
    this.playerPawn = new PlayerPawn(this.scene);
    this.assetContainer.meshes.push(this.playerPawn.mesh);
    WorldEntityManager.getInstance().registerEntity(this.playerPawn);

    if (levelData.playerSpawn) {
      this.playerPawn.position = Vector3.FromArray(levelData.playerSpawn);
    } else {
      this.playerPawn.position = new Vector3(0, 1.75, -5);
    }

    this.playerController = new PlayerController('player1', this.canvas);
    this.playerController.possess(this.playerPawn);

    this.hud = new HUD();
    this.setupSystems(levelData);
    this.setupCombat();
    this.setupInventory();
    this.setupInput();
    this.setupMultiplayer(playerName);
  }

  private setupSystems(levelData: LevelData): void {
    this.targetSpawner = new TargetSpawnerComponent(
      this.playerPawn!,
      this.scene,
      this.shadowGenerator
    );
    this.targetSpawner.spawnInitialTargets();

    if (levelData.enemySpawns && levelData.enemySpawns.length > 0) {
      this.enemyManager = new EnemyManager(this.scene, this.shadowGenerator);
      this.enemyManager.initialize();
      // Server handles spawning implicitly via ServerGameController -> ServerEnemyController
      // We do NOT manual spawn here anymore.
    }

    PickupManager.getInstance().setup(this.scene, this.playerPawn!);

    const lm = LifetimeManager.getInstance();
    lm.trackObserver(
      GameObservables.itemCollection,
      GameObservables.itemCollection.add(() => {
        const swipeSound = AssetLoader.getInstance().getSound('swipe');
        swipeSound?.play();
      })
    );
  }

  private setupCombat(): void {
    const combatComp = new CombatComponent(this.playerPawn!, this.scene);
    this.playerPawn!.addComponent(combatComp);

    const lm = LifetimeManager.getInstance();
    lm.trackUnsub(
      playerHealthStore.subscribe((health: number) => {
        if (health <= 0) {
          // Local death logic (VFX, Game Over UI) is triggered by PlayerPawn.die()
          // which is called by updateHealth() or takeDamage()
          // We no longer broadcast PLAYER_DEATH from client.
          // Server sends ON_DIED (202).
        }
      })
    );

    combatComp.onWeaponChanged.add((newWeapon: IWeapon) => {
      this.syncInventoryStore();
      if (this.multiplayerSystem) {
        NetworkManager.getInstance().syncWeapon(newWeapon.name);
      }
    });
  }

  private setupInventory(): void {
    this.inventoryUI = new InventoryUI({
      onEquipWeapon: (slot: number, weaponId: string | null): void => {
        const state = inventoryStore.get();
        const slots = [...state.weaponSlots];
        slots[slot] = weaponId;
        inventoryStore.setKey('weaponSlots', slots);

        if (weaponId && this.playerPawn) {
          const combat = this.playerPawn.getComponent(CombatComponent) as CombatComponent;
          combat?.equipWeapon(weaponId);
        }
      },
      onUseItem: (itemId: string): void => {
        if (this.playerPawn) {
          InventoryManager.useItem(itemId, this.playerPawn);
          this.syncInventoryStore();
        }
      },
      onDropItem: (itemId: string): void => {
        if (!this.playerPawn) return;
        const state = inventoryStore.get();
        const bag = [...state.bagItems];
        const itemIndex = bag.findIndex((i) => i.id === itemId);

        if (itemIndex !== -1) {
          const item = bag[itemIndex];
          if (item.count > 1) {
            bag[itemIndex] = { ...item, count: item.count - 1 };
          } else {
            bag.splice(itemIndex, 1);
          }
          inventoryStore.setKey('bagItems', bag);

          const dropPos = this.playerPawn.mesh.position.clone();
          dropPos.y += 0.5;
          PickupManager.getInstance().spawnPickup(dropPos, item.id as PickupType);
        }
      },
    });
    this.syncInventoryStore();
  }

  private setupInput(): void {
    GlobalInputManager.getInstance().initialize(
      this.scene,
      this.canvas,
      this.playerPawn!,
      this.playerController!,
      this.inventoryUI!
    );
  }

  private setupMultiplayer(playerName: string): void {
    const network = NetworkManager.getInstance();
    this.multiplayerSystem = new MultiplayerSystem(
      this.scene,
      this.playerPawn!,
      this.shadowGenerator,
      playerName
    );
    this.multiplayerSystem.initialize();

    const lm = LifetimeManager.getInstance();
    // Initial State Sync Logic
    lm.trackObserver(
      network.onInitialStateRequested,
      network.onInitialStateRequested.add(() => {
        if (network.isMasterClient()) {
          const enemyStates: EnemyUpdateData[] = this.enemyManager?.getEnemyStates() || [];

          // Get non-pawn entities (targets) from WorldEntityManager
          const targetStates: TargetSpawnData[] = WorldEntityManager.getInstance()
            .getEntitiesByType('static_target', 'moving_target', 'humanoid_target')
            .map((t) => {
              const target = t as unknown as { type: string; isMoving?: boolean };
              return new TargetSpawnData(
                t.id,
                target.type || 'static_target',
                { x: t.position.x, y: t.position.y, z: t.position.z },
                target.isMoving || false
              );
            });

          // Build Player States: Remote Players (from MultiplayerSystem) + Local Host
          const playerStates: PlayerData[] = [];

          if (this.multiplayerSystem) {
            playerStates.push(...this.multiplayerSystem.getRemotePlayerStates());
          }

          // IMPORTANT: Add self (Host) to the state!
          if (this.playerPawn) {
            const combat = this.playerPawn.getComponent(CombatComponent) as CombatComponent;
            const myWeapon = combat?.getCurrentWeapon()?.name || 'Pistol';

            playerStates.push({
              id: network.getSocketId() || 'host',
              name: localStorage.getItem('playerName') || 'Host',
              position: {
                x: this.playerPawn.mesh.position.x,
                y: this.playerPawn.mesh.position.y,
                z: this.playerPawn.mesh.position.z,
              },
              rotation: {
                x: this.playerPawn.camera.rotation.x,
                y: this.playerPawn.mesh.rotation.y, // Use mesh yaw
                z: 0,
              },
              weaponId: myWeapon,
              health: playerHealthStore.get(),
              isMaster: true,
            });
          }

          const initialState = new InitialStatePayload(playerStates, enemyStates, targetStates);
          network.sendEvent(EventCode.INITIAL_STATE, initialState);
        }
      })
    );

    lm.trackObserver(
      network.onInitialStateReceived,
      network.onInitialStateReceived.add((data) => {
        if (this.enemyManager) {
          const enemyStates = data.enemies.map((e) => ({
            id: e.id,
            position: e.position,
            rotation: e.rotation || { x: 0, y: 0, z: 0 },
            health: 100, // Default for initial sync
            isDead: false,
          }));
          this.enemyManager.applyEnemyStates(enemyStates);
        }
        if (this.multiplayerSystem) {
          this.multiplayerSystem.applyPlayerStates(data.players);
        }
        if (data.targets && this.targetSpawner) {
          data.targets.forEach(
            (t: {
              position: { x: number; y: number; z: number };
              isMoving: boolean;
              id: string;
              type: string;
            }) => {
              this.targetSpawner!.spawnTarget(
                new Vector3(t.position.x, t.position.y, t.position.z),
                !!t.isMoving,
                t.id,
                t.type
              );
            }
          );
        }
      })
    );

    if (!network.isMasterClient()) {
      network.sendEvent(EventCode.REQ_INITIAL_STATE, {}, true);
    }
  }

  private syncInventoryStore(): void {
    if (!this.playerPawn) return;
    const combat = this.playerPawn.getComponent(CombatComponent) as CombatComponent;
    if (!combat) return;

    const weapons = combat.getWeapons();
    const slots: (string | null)[] = [null, null, null, null];
    weapons.forEach((w, i) => {
      if (i < 4) slots[i] = w.name;
    });

    const weaponBagItems = weapons.map((w) => ({
      id: w.name,
      name: w.name,
      type: 'weapon' as const,
      count: 1,
    }));

    const currentState = inventoryStore.get();
    const consumables = currentState.bagItems.filter((i) => i.type === 'consumable');

    inventoryStore.set({
      ...currentState,
      weaponSlots: slots,
      bagItems: [...weaponBagItems, ...consumables],
    });
  }

  public getPlayerCamera(): UniversalCamera | null {
    return this.playerPawn?.camera || null;
  }

  public setInputBlocked(blocked: boolean): void {
    this.playerController?.setInputBlocked(blocked);
  }

  public tick(deltaTime: number): void {
    if (this.multiplayerSystem) {
      this.multiplayerSystem.update();
    }
    if (this.enemyManager) {
      this.enemyManager.update(deltaTime);
    }
  }

  public dispose(): void {
    this.healthUnsub?.();
    this.playerController?.dispose();
    this.hud?.dispose();
    this.inventoryUI?.dispose();
    this.multiplayerSystem?.dispose();
    this.enemyManager?.dispose();
    this.targetSpawner?.dispose();

    // Clean up all session-specific Babylon.js objects
    this.assetContainer.dispose();
  }
}
