import { Scene, Vector3, ShadowGenerator, UniversalCamera, Observer } from '@babylonjs/core';
import { PlayerPawn } from '../PlayerPawn';
import { PlayerController } from '../controllers/PlayerController';
import { LevelData } from './LevelLoader';
import { CombatComponent } from '../components/CombatComponent';
import { HUD } from '../../ui/HUD';
import { InventoryUI } from '../../ui/inventory/InventoryUI';
import { InventoryManager } from '../inventory/InventoryManager';
import { GlobalInputManager } from './GlobalInputManager';
import { NetworkManager } from './NetworkManager';
import { MultiplayerSystem } from './MultiplayerSystem';
import { PickupManager } from './PickupManager';
import { TargetSpawnerComponent } from '../components/TargetSpawnerComponent';
import { EnemyManager } from './EnemyManager';
import { EventCode, InitialStatePayload, SpawnTargetPayload } from '@ante/common';
import { WorldSimulation, WaveSurvivalRule } from '@ante/game-core';
import { WorldEntityManager } from './WorldEntityManager';
import { GameObservables } from '../events/GameObservables';
import { AssetLoader } from '../AssetLoader';
import { playerHealthStore, inventoryStore } from '../store/GameStore';

export class SessionController {
  private scene: Scene;
  private canvas: HTMLCanvasElement;
  private shadowGenerator: ShadowGenerator;

  private playerPawn: PlayerPawn | null = null;
  private playerController: PlayerController | null = null;
  private multiplayerSystem: MultiplayerSystem | null = null;
  private hud: HUD | null = null;
  private inventoryUI: InventoryUI | null = null;
  private enemyManager: EnemyManager | null = null;
  private targetSpawner: TargetSpawnerComponent | null = null;
  private simulation: WorldSimulation | null = null;
  private healthUnsub: (() => void) | null = null;
  private _initialStateObserver: Observer<InitialStatePayload> | null = null;

  constructor(scene: Scene, canvas: HTMLCanvasElement, shadowGenerator: ShadowGenerator) {
    this.scene = scene;
    this.canvas = canvas;
    this.shadowGenerator = shadowGenerator;
  }

  public async initialize(levelData: LevelData, playerName: string = 'Anonymous'): Promise<void> {
    this.playerPawn = new PlayerPawn(this.scene);
    WorldEntityManager.getInstance().register(this.playerPawn);

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

    // Always setup multiplayer in dedicated server architecture
    this.setupMultiplayer(playerName);
  }

  private setupSystems(levelData: LevelData): void {
    this.targetSpawner = new TargetSpawnerComponent(this.scene, this.shadowGenerator);
    // Initial layout is now handled by the authority (server/simulation)

    if (levelData.enemySpawns && levelData.enemySpawns.length > 0) {
      this.enemyManager = new EnemyManager(this.scene, this.shadowGenerator);
      // Spawning is now handled by the authority
    }

    PickupManager.getInstance().initialize(this.scene, this.playerPawn!);

    GameObservables.itemCollection.add((): void => {
      const swipeSound = AssetLoader.getInstance().getSound('swipe');
      swipeSound?.play();
    });
  }

  private setupCombat(): void {
    const combatComp = new CombatComponent(this.playerPawn!, this.scene);
    this.playerPawn!.addComponent(combatComp);

    this.healthUnsub = playerHealthStore.subscribe((health: number): void => {
      if (health <= 0) {
        GameObservables.playerDied.notifyObservers(null);
      }
    });

    combatComp.onWeaponChanged((newWeapon: { name: string }): void => {
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

        if (weaponId) {
          const combat = this.playerPawn?.getComponent(CombatComponent);
          (combat as CombatComponent)?.equipWeapon(weaponId);
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

          // Dropping items should be handled by authority (server/simulation)
          // const dropPos = this.playerPawn.mesh.position.clone();
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

    // Initial State Sync Logic
    // Initial State Sync Logic
    // If Master Client (Host), we initialize the world locally (Authoritative)
    // If Guest, we request initial state.

    // Initialize WorldSimulation with Client managers
    if (this.enemyManager && this.targetSpawner) {
      this.simulation = new WorldSimulation(
        this.enemyManager,
        PickupManager.getInstance(),
        this.targetSpawner,
        network
      );
      this.simulation.setGameRule(new WaveSurvivalRule());
    }

    if (network.isMasterClient()) {
      if (this.simulation) {
        this.simulation.initializeRequest(); // Spawns enemies/targets
      }
    } else {
      network.sendEvent(EventCode.REQ_INITIAL_STATE, {}, true);
    }

    this._initialStateObserver = network.onInitialStateReceived.add(
      (data: InitialStatePayload): void => {
        if (this.enemyManager) {
          this.enemyManager.applyEnemyStates(data.enemies);
        }
        if (this.multiplayerSystem) {
          this.multiplayerSystem.applyPlayerStates(data.players);
        }
        if (data.targets && this.targetSpawner) {
          data.targets.forEach((t: SpawnTargetPayload): void => {
            this.targetSpawner!.spawnTarget(
              new Vector3(t.position.x, t.position.y, t.position.z),
              t.isMoving,
              t.id,
              t.type
            );
          });
        }
      }
    );

    // Request logic moved up
  }

  private syncInventoryStore(): void {
    if (!this.playerPawn) return;
    const combat = this.playerPawn.getComponent(CombatComponent);
    if (!combat) return;

    const weapons = (combat as CombatComponent).getWeapons();
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

  public update(deltaTime: number): void {
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
    this.playerPawn?.dispose();
    this.hud?.dispose();
    this.inventoryUI?.dispose();
    this.multiplayerSystem?.dispose();
    this.enemyManager?.dispose();
    if (this._initialStateObserver) {
      NetworkManager.getInstance().onInitialStateReceived.remove(this._initialStateObserver);
      this._initialStateObserver = null;
    }
    // Managers are singletons, cleared in Game.ts for now or we could add clear here
  }
}
