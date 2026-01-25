import { Scene, Vector3, ShadowGenerator, UniversalCamera } from '@babylonjs/core';
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
import { TargetRegistry } from './TargetRegistry';
import { EnemyManager } from './EnemyManager';
import { EventCode } from '../network/NetworkProtocol';
import { GameObservables } from '../events/GameObservables';
import { AssetLoader } from '../AssetLoader';
import { playerHealthStore, inventoryStore } from '../store/GameStore';
import { GameMode } from '../../types/GameMode';

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
  private healthUnsub: (() => void) | null = null;

  constructor(scene: Scene, canvas: HTMLCanvasElement, shadowGenerator: ShadowGenerator) {
    this.scene = scene;
    this.canvas = canvas;
    this.shadowGenerator = shadowGenerator;
  }

  public async initialize(
    levelData: LevelData,
    mode: GameMode = 'single',
    playerName: string = 'Anonymous'
  ): Promise<void> {
    this.playerPawn = new PlayerPawn(this.scene);

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

    if (mode === 'multi') {
      this.setupMultiplayer(playerName);
    }
  }

  private setupSystems(levelData: LevelData): void {
    this.targetSpawner = new TargetSpawnerComponent(this.scene, this.shadowGenerator);
    this.targetSpawner.spawnInitialTargets();

    if (levelData.enemySpawns && levelData.enemySpawns.length > 0) {
      this.enemyManager = new EnemyManager(this.scene, this.shadowGenerator);
      this.enemyManager.spawnEnemies(levelData.enemySpawns, this.playerPawn!);
    }

    PickupManager.getInstance().initialize(this.scene, this.playerPawn!);

    GameObservables.itemCollection.add(() => {
      const swipeSound = AssetLoader.getInstance().getSound('swipe');
      swipeSound?.play();
    });
  }

  private setupCombat(): void {
    const combatComp = new CombatComponent(this.playerPawn!, this.scene);
    this.playerPawn!.addComponent(combatComp);

    this.healthUnsub = playerHealthStore.subscribe((health) => {
      if (health <= 0) {
        GameObservables.playerDied.notifyObservers(null);
        if (this.multiplayerSystem) {
          const nm = NetworkManager.getInstance();
          nm.sendEvent(EventCode.PLAYER_DEATH, {
            playerId: nm.getSocketId(),
            attackerId: 'unknown',
          });
        }
      }
    });

    combatComp.onWeaponChanged((newWeapon) => {
      this.syncInventoryStore();
      if (this.multiplayerSystem) {
        NetworkManager.getInstance().syncWeapon(newWeapon.name);
      }
    });
  }

  private setupInventory(): void {
    this.inventoryUI = new InventoryUI({
      onEquipWeapon: (slot, weaponId) => {
        const state = inventoryStore.get();
        const slots = [...state.weaponSlots];
        slots[slot] = weaponId;
        inventoryStore.setKey('weaponSlots', slots);

        if (weaponId) {
          const combat = this.playerPawn?.getComponent(CombatComponent);
          combat?.equipWeapon(weaponId);
        }
      },
      onUseItem: (itemId) => {
        if (this.playerPawn) {
          InventoryManager.useItem(itemId, this.playerPawn);
          this.syncInventoryStore();
        }
      },
      onDropItem: (itemId) => {
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
          PickupManager.getInstance().spawnPickup(dropPos, item.id as any);
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
    network.onInitialStateRequested.add(() => {
      if (network.isMasterClient()) {
        console.log('[Session] Providing initial state to new player');
        const enemyStates = this.enemyManager?.getEnemyStates() || [];
        // Extract player states from NetworkManager
        const playerStates = network.getAllPlayerStates();
        const targetStates = TargetRegistry.getInstance().getSerializedTargets();

        network.sendEvent(EventCode.INITIAL_STATE, {
          players: playerStates,
          enemies: enemyStates,
          targets: targetStates,
        });
      }
    });

    network.onInitialStateReceived.add((data) => {
      console.log('[Session] Received initial state sync');
      if (this.enemyManager) {
        this.enemyManager.applyEnemyStates(data.enemies);
      }
      if (this.multiplayerSystem) {
        this.multiplayerSystem.applyPlayerStates(data.players);
      }
      if (data.targets && this.targetSpawner) {
        data.targets.forEach((t: any) => {
          this.targetSpawner!.spawnTarget(
            new Vector3(t.position.x, t.position.y, t.position.z),
            t.isMoving,
            t.id,
            t.type
          );
        });
      }
    });

    if (!network.isMasterClient()) {
      console.log('[Session] Requesting initial state from Master Client...');
      network.sendEvent(EventCode.REQ_INITIAL_STATE, {}, true);
    }
  }

  private syncInventoryStore(): void {
    if (!this.playerPawn) return;
    const combat = this.playerPawn.getComponent(CombatComponent);
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
    // Managers are singletons, cleared in Game.ts for now or we could add clear here
  }
}
