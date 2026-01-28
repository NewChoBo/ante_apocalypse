import { IServerNetwork } from '../interfaces/IServerNetwork';
import { ServerEnemyController } from './ServerEnemyController';
import {
  EventCode,
  ReqFirePayload,
  ReqHitPayload,
  ReqReloadPayload,
  OnAmmoSyncPayload,
  PlayerData,
  MovePayload,
  OnStateSyncPayload,
  ReqTryPickupPayload,
  PickupSpawnData,
  TargetSpawnData,
  EnemyUpdateData,
  OnMatchStateSyncPayload,
  OnMatchEndPayload,
  OnScoreSyncPayload,
  ReqUseItemPayload,
  OnPlayerRespawnPayload,
  ReqSwitchWeaponPayload,
  SyncWeaponPayload,
} from '../../shared/protocol/NetworkProtocol';

interface ServerPlayerState extends PlayerData {
  type: string;
  ammo: Record<string, { current: number; reserve: number; magazineSize: number }>;
  isDead: boolean;
}

interface ServerEntityState {
  id: string;
  type: string;
  health: number;
  maxHealth: number;
  isDead: boolean;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number; w?: number };
  isMoving?: boolean;
}

export class ServerGameController {
  private network: IServerNetwork;
  private enemyController: ServerEnemyController;
  private playerStates: Map<string, ServerPlayerState> = new Map();
  // entityStates now only holds static targets or other non-enemy AI entities
  private entityStates: Map<string, ServerEntityState> = new Map();
  private activePickups: Map<string, PickupSpawnData> = new Map();
  // Drop Tables: 30% chance. Item types: 'ammo', 'health_pack'.
  private readonly DROP_CHANCE = 0.3;
  private readonly DROP_ITEMS = ['ammo_rifle', 'ammo_pistol', 'health_pack'];

  // Match State
  private matchState: 'READY' | 'COUNTDOWN' | 'PLAYING' | 'GAME_OVER' = 'READY';
  private remainingSeconds: number = 60; // 1 minute default
  private readonly RESPAWN_TIME_MS = 5000; // 5 seconds respawn

  // Scoring
  private playerScores: Map<string, number> = new Map();
  private totalTeamScore: number = 0;
  private readonly TARGET_SCORE = 500;

  // Sub-tick Hit Registration
  private hitboxHistory: { timestamp: number; players: Map<string, PlayerData> }[] = [];
  private readonly HISTORY_DURATION_MS = 1000; // Keep 1 second of history

  private readonly DEFAULT_HP = 100;
  private readonly DEFAULT_WEAPON_DATA: Record<
    string,
    { magazineSize: number; reserve: number; fireRate: number }
  > = {
    Rifle: { magazineSize: 30, reserve: 90, fireRate: 100 }, // 100ms between shots
    Pistol: { magazineSize: 12, reserve: 60, fireRate: 200 },
    Bat: { magazineSize: 9999, reserve: 0, fireRate: 500 },
    Knife: { magazineSize: 9999, reserve: 0, fireRate: 300 },
  };

  constructor(network: IServerNetwork) {
    this.network = network;
    this.enemyController = new ServerEnemyController(network); // Pass network to sub-controller
    this.setupListeners();
    this.startLoops();
    console.log('%c[Server] Logical Server Started 🟢', 'color: lightgreen; font-weight: bold;');
  }

  private aiInterval: ReturnType<typeof setInterval> | null = null;
  private matchInterval: ReturnType<typeof setInterval> | null = null;
  private networkInterval: ReturnType<typeof setInterval> | null = null;

  private startLoops() {
    this.stopLoops();

    // 1. AI Loop (Independent, e.g. 15Hz to save resources, or 30Hz for smooth)
    let lastTime = Date.now();
    this.aiInterval = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      this.updateAI(dt);
    }, 33);

    // 2. Match Timer Loop (1Hz)
    this.matchInterval = setInterval(() => {
      this.updateMatchTimer();
    }, 1000);

    // 3. Network Loop (128Hz - High Precision, approx 8ms)
    this.networkInterval = setInterval(() => {
      this.broadcastWorldSnapshot();
    }, 8);
  }

  private stopLoops() {
    if (this.aiInterval) clearInterval(this.aiInterval);
    if (this.matchInterval) clearInterval(this.matchInterval);
    if (this.networkInterval) clearInterval(this.networkInterval);
  }

  private broadcastWorldSnapshot() {
    // Optimization: Only send if match is active or at least one player is connected
    if (this.playerStates.size === 0) return;
    this.sendWorldSnapshot();
  }

  private updateAI(dt: number) {
    if (this.matchState === 'PLAYING') {
      const playerPositions = new Map<string, { x: number; y: number; z: number }>();
      this.playerStates.forEach((p) => {
        if (!p.isDead && p.position) {
          playerPositions.set(p.id, p.position);
        }
      });

      // Calculate AI logic and get changes
      const enemyUpdates = this.enemyController.tick(dt, playerPositions);

      // Broadcast Enemy Moves Immediately (Event Driven)
      enemyUpdates.forEach((update) => {
        this.network.sendEvent(EventCode.ENEMY_MOVE, update, false, 'all');
      });
    }
  }

  private updateMatchTimer() {
    // Low-frequency tasks (per second)
    if (this.matchState === 'PLAYING') {
      this.remainingSeconds--;

      if (this.remainingSeconds <= 0) {
        this.remainingSeconds = 0;
        this.endMatch(false); // Time out
      }

      if (this.totalTeamScore >= this.TARGET_SCORE) {
        this.endMatch(true); // Victory
      }
    }

    this.broadcastMatchState();
  }

  private broadcastMatchState() {
    const minutes = Math.floor(this.remainingSeconds / 60);
    const seconds = Math.floor(this.remainingSeconds % 60);
    const formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    const payload = new OnMatchStateSyncPayload(
      this.matchState as any,
      formatted,
      this.remainingSeconds
    );
    this.network.sendEvent(EventCode.ON_MATCH_STATE_SYNC, payload, true, 'all');

    // Also sync scores
    const scores: Record<string, number> = {};
    this.playerScores.forEach((s, id) => (scores[id] = s));
    const scorePayload = new OnScoreSyncPayload(scores, this.totalTeamScore);
    this.network.sendEvent(EventCode.ON_SCORE_SYNC, scorePayload, true, 'all');
  }

  private endMatch(isWin: boolean) {
    if (this.matchState === 'GAME_OVER') return;
    this.matchState = 'GAME_OVER';

    const scores: Record<string, number> = {};
    this.playerScores.forEach((s, id) => (scores[id] = s));

    const payload = new OnMatchEndPayload(isWin, undefined, scores);
    this.network.sendEvent(EventCode.ON_MATCH_END, payload, true, 'all');

    console.log(`[Server] Match Ended. Win=${isWin}, TotalScore=${this.totalTeamScore}`);
  }

  public startMatch() {
    this.matchState = 'COUNTDOWN';
    this.remainingSeconds = 5; // 5 seconds countdown

    // Reset Scores
    this.totalTeamScore = 0;
    this.playerScores.clear();

    // Spawn Targets
    this.spawnInitialTargets();

    // Reset Players (Respawn all)
    this.playerStates.forEach((p) => {
      this.respawnPlayer(p.id, true); // silent respawn
    });

    this.startLoops();
    console.log('[Server] Match Countdown Started!');

    // After 5 seconds, switch to PLAYING
    setTimeout(() => {
      if (this.matchState === 'COUNTDOWN') {
        this.matchState = 'PLAYING';
        this.remainingSeconds = 180; // 3 minutes match
        console.log('[Server] Match Started (PLAYING)!');
      }
    }, 5000);
  }

  private respawnPlayer(playerId: string, silent: boolean = false) {
    const state = this.playerStates.get(playerId);
    if (!state) return;

    state.isDead = false;
    state.health = this.DEFAULT_HP;
    state.position = { x: 0, y: 10, z: 0 }; // Default spawn height

    // Full Ammo Refill
    for (const [wId, config] of Object.entries(this.DEFAULT_WEAPON_DATA)) {
      state.ammo[wId] = {
        current: config.magazineSize,
        reserve: config.reserve,
        magazineSize: config.magazineSize,
      };
    }

    if (!silent) {
      this.network.sendEvent(
        EventCode.ON_PLAYER_RESPAWN,
        new OnPlayerRespawnPayload(playerId, state.position),
        true,
        'all'
      );
    }
  }

  private setupListeners() {
    this.network.onEvent.add((payload) => {
      const { code, data, senderId } = payload;
      this.handlePacket(code, data, senderId || '');
    });

    this.network.onPlayerJoined.add((player) => {
      this.initializePlayer(player.id, player.name || 'Anonymous');
      // WAIT for REQ_READY before sending snapshot
      // WAIT for REQ_READY before sending snapshot
      // this.sendWorldSnapshot(player.id); // Validated: Moved to REQ_READY handler
    });

    this.network.onPlayerLeft.add((playerId) => {
      if (this.playerStates.has(playerId)) {
        this.playerStates.delete(playerId);
        console.log(`[Server] Player ${playerId} cleaned up.`);
      }
    });

    // Capture spawned entities for authority
    this.network.onEvent.add((p) => {
      const { code, data } = p;
      if (code === EventCode.SPAWN_PICKUP) {
        const d = data as PickupSpawnData;
        this.activePickups.set(d.id, d);
      } else if (code === EventCode.DESTROY_PICKUP) {
        const d = data as { id: string };
        this.activePickups.delete(d.id);
      } else if (code === EventCode.SPAWN_TARGET) {
        const d = data as TargetSpawnData;
        this.entityStates.set(d.id, {
          id: d.id,
          type: d.type,
          health: 100, // Default target health
          maxHealth: 100,
          isDead: false,
          position: d.position,
          isMoving: d.isMoving,
        });
      } else if (code === EventCode.TARGET_DESTROY) {
        const d = data as { id: string };
        this.entityStates.delete(d.id);
      }
      // Note: ON_ENEMY_SPAWN is handled by ServerEnemyController internal logic + broadcast
      // Server doesn't need to listen to its own broadcast to update map,
      // but if we had distributed authority we might.
      // Here, enemyController IS the source.
    });
  }

  private handlePacket(code: number, data: any, senderId: string) {
    if (!senderId) return;

    if (!this.playerStates.has(senderId)) {
      this.initializePlayer(senderId);
    }

    const state = this.playerStates.get(senderId)!;
    // const now = Date.now(); // Unused if we trust client completely for movement

    switch (code) {
      case EventCode.MOVE: {
        const move = data as MovePayload;

        // [Smooth Gameplay] Trust Client Authority for Movement
        state.position = move.position;
        state.rotation = move.rotation;
        state.weaponId = move.weaponId;

        // [Real-time Relay] Send to others immediately
        // DISABLED for Interpolation Test
        // this.network.sendEvent(EventCode.MOVE, move, false, 'others');
        break;
      }
      case EventCode.REQ_READY:
        // [Handshake] Client is fully loaded. Send Snapshot & Check Match Start
        this.sendWorldSnapshot(senderId);
        if (this.matchState === 'READY' && this.playerStates.size >= 1) {
          this.startMatch();
        }
        break;
      case EventCode.REQ_FIRE:
        // Process immediately (Event Driven)
        if (!state.isDead) this.processFire(senderId, state, data as ReqFirePayload);
        break;
      case EventCode.REQ_HIT:
        // Process immediately (Event Driven)
        this.processHit(senderId, data as ReqHitPayload);
        break;
      case EventCode.REQ_RELOAD:
        if (!state.isDead) this.processReload(senderId, state, data as ReqReloadPayload);
        break;
      case EventCode.REQ_TRY_PICKUP:
        this.processPickupRequest(senderId, state, data as ReqTryPickupPayload);
        break;
      case EventCode.REQ_USE_ITEM:
        this.processUseItem(senderId, state, data as ReqUseItemPayload);
        break;
      case EventCode.REQ_SWITCH_WEAPON:
        this.processSwitchWeapon(senderId, state, data as ReqSwitchWeaponPayload);
        break;
    }
  }

  private processSwitchWeapon(
    _senderId: string,
    state: ServerPlayerState,
    data: ReqSwitchWeaponPayload
  ) {
    const weaponId = data.weaponId;
    // Validation: Check if player has this weapon in inventory/ammo
    if (this.DEFAULT_WEAPON_DATA[weaponId]) {
      state.weaponId = weaponId;
      const payload = new SyncWeaponPayload(weaponId);
      // Broadcast to others (Sender already knows, but for consistency we can send to all or others)
      // Since client predicts, we send to others. Or all if we want confirmation.
      this.network.sendEvent(EventCode.SYNC_WEAPON, payload, true, 'all');
    }
  }

  private initializePlayer(id: string, name: string = 'Anonymous') {
    const ammo: Record<string, { current: number; reserve: number; magazineSize: number }> = {};
    for (const [wId, config] of Object.entries(this.DEFAULT_WEAPON_DATA)) {
      ammo[wId] = {
        current: config.magazineSize,
        reserve: config.reserve,
        magazineSize: config.magazineSize,
      };
    }

    this.playerStates.set(id, {
      id,
      name,
      type: 'player',
      health: this.DEFAULT_HP,
      ammo,
      isDead: false,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
    });
    this.playerScores.set(id, 0);

    console.log(`[Server] Initialized Player State: ${id}`);
  }

  private sendWorldSnapshot(_targetId?: string) {
    const players = Array.from(this.playerStates.values()).map((s) => ({
      id: s.id,
      name: s.name,
      position: s.position,
      rotation: s.rotation,
      health: s.health,
      weaponId: s.weaponId,
    }));

    const enemies: EnemyUpdateData[] = [];
    const targets: TargetSpawnData[] = [];

    // Enemies from Controller
    this.enemyController.getEnemyStates().forEach((e) => {
      enemies.push({
        id: e.id,
        position: e.position,
        rotation: e.rotation,
        state: e.state,
        isMoving: e.isMoving,
      });
    });

    // Targets from entityStates
    this.entityStates.forEach((e) => {
      if (typeof e.type === 'string' && e.type.includes('target')) {
        targets.push({
          id: e.id,
          type: e.type,
          position: e.position!,
          isMoving: !!e.isMoving,
        });
      }
    });

    const snapshot = new OnStateSyncPayload(
      Date.now(),
      players,
      enemies,
      targets,
      Array.from(this.activePickups.values())
    );

    this.network.sendEvent(EventCode.ON_STATE_SYNC, snapshot, true, 'all');

    // [Sub-tick] Record Snapshot for History
    // Clone players to avoid reference issues
    const historyPlayers = new Map<string, PlayerData>();
    this.playerStates.forEach((p) => {
      historyPlayers.set(p.id, { ...p }); // Shallow copy is enough for position/rotation
    });

    this.hitboxHistory.push({
      timestamp: snapshot.timestamp,
      players: historyPlayers,
    });

    // Prune old history
    const cutoff = Date.now() - this.HISTORY_DURATION_MS;
    while (this.hitboxHistory.length > 0 && this.hitboxHistory[0].timestamp < cutoff) {
      this.hitboxHistory.shift();
    }
  }

  private validateHitSubtick(
    targetId: string,
    shotTimestamp: number,
    hitPos: { x: number; y: number; z: number }
  ): boolean {
    if (this.hitboxHistory.length < 2) return true; // Not enough history, trust client (or fail)

    // 1. Find Snapshots
    let from: (typeof this.hitboxHistory)[0] | undefined;
    let to: (typeof this.hitboxHistory)[0] | undefined;

    for (let i = this.hitboxHistory.length - 1; i >= 0; i--) {
      if (this.hitboxHistory[i].timestamp <= shotTimestamp) {
        from = this.hitboxHistory[i];
        to = this.hitboxHistory[i + 1]; // Can be undefined if we are at the latest
        break;
      }
    }

    if (!from) {
      // Too old? Use oldest
      from = this.hitboxHistory[0];
      to = this.hitboxHistory[1]; // Might be undefined
    }

    let targetPos: { x: number; y: number; z: number } | undefined;

    // 2. Interpolate
    const fromPlayer = from.players.get(targetId);
    if (!fromPlayer || !fromPlayer.position) return true; // Player not found?

    if (!to) {
      // Use exact 'from' position (latest recorded or oldest recorded)
      targetPos = fromPlayer.position;
    } else {
      const toPlayer = to.players.get(targetId);
      if (!toPlayer || !toPlayer.position) {
        targetPos = fromPlayer.position;
      } else {
        const total = to.timestamp - from.timestamp;
        const elapsed = shotTimestamp - from.timestamp;
        const alpha = Math.max(0, Math.min(1, total > 0 ? elapsed / total : 0));

        targetPos = {
          x: fromPlayer.position.x + (toPlayer.position.x - fromPlayer.position.x) * alpha,
          y: fromPlayer.position.y + (toPlayer.position.y - fromPlayer.position.y) * alpha,
          z: fromPlayer.position.z + (toPlayer.position.z - fromPlayer.position.z) * alpha,
        };
      }
    }

    // 3. Distance Check
    const dx = hitPos.x - targetPos!.x;
    const dy = hitPos.y - targetPos!.y;
    const dz = hitPos.z - targetPos!.z;
    const distSq = dx * dx + dy * dy + dz * dz;

    // Hitbox radius approx 0.5m -> 1.0m diameter needed? + Error margin
    // Cylinder height ~2m.
    // Simple sphere check for now with generous margin (e.g., 1.0m radius = 1.0m error allowed)
    // 128Hz should be very accurate, but Latency jitter exists.
    const HIT_RADIUS = 1.5; // Generous margin for testing
    return distSq < HIT_RADIUS * HIT_RADIUS;
  }

  private processFire(shooterId: string, state: ServerPlayerState, data: ReqFirePayload) {
    const weaponId = data.weaponId;
    const config = this.DEFAULT_WEAPON_DATA[weaponId];
    if (!config) return;

    // Fire rate check REMOVED - Trust Client
    /*
    const now = Date.now();
    const playerFires = this.lastFireTimes.get(shooterId) || {};
    const lastFire = playerFires[weaponId] || 0;
    if (now - lastFire < config.fireRate * 0.7) {
      // 30% tolerance for jitter
      console.warn(`[Server] Fire rate violation: ${shooterId} with ${weaponId}`);
      return;
    }
    */

    const ammoData = state.ammo[weaponId];
    if (!ammoData || ammoData.current <= 0) return;

    if (weaponId !== 'Bat' && weaponId !== 'Knife') {
      ammoData.current--;
    }

    // this.lastFireTimes update removed

    this.network.sendEvent(EventCode.ON_FIRED, {
      shooterId,
      weaponId,
      muzzleData: data.muzzleData,
      ammoRemaining: ammoData.current,
    });

    const onAmmo = new OnAmmoSyncPayload(weaponId, ammoData.current, ammoData.reserve);
    this.network.sendEvent(EventCode.ON_AMMO_SYNC, onAmmo, true, 'all');
  }

  private processReload(_senderId: string, state: ServerPlayerState, data: ReqReloadPayload) {
    const weaponId = data.weaponId;
    const ammoData = state.ammo[weaponId];

    if (ammoData && ammoData.reserve > 0 && ammoData.current < ammoData.magazineSize) {
      const needed = ammoData.magazineSize - ammoData.current;
      const amount = Math.min(needed, ammoData.reserve);
      ammoData.current += amount;
      ammoData.reserve -= amount;

      const onAmmo = new OnAmmoSyncPayload(weaponId, ammoData.current, ammoData.reserve);
      this.network.sendEvent(EventCode.ON_AMMO_SYNC, onAmmo, true, 'all');
    }
  }

  private processHit(attackerId: string, data: ReqHitPayload) {
    // 1. Check if target is a player
    const playerTarget = this.playerStates.get(data.targetId);
    let target:
      | {
          health: number;
          isDead: boolean;
          id: string;
          type: string;
          position?: { x: number; y: number; z: number };
          isMoving?: boolean;
        }
      | undefined;

    if (playerTarget) {
      target = {
        id: playerTarget.id,
        type: playerTarget.type,
        health: playerTarget.health || 0,
        isDead: playerTarget.isDead,
        position: playerTarget.position,
      };
    } else {
      // Check Entity States (Targets)
      const entityTarget = this.entityStates.get(data.targetId);
      if (entityTarget) {
        target = entityTarget;
      } else {
        // Check Enemy Controller
        const enemy = this.enemyController.getEnemyStates().get(data.targetId);
        if (enemy) {
          target = {
            id: enemy.id,
            type: 'enemy',
            health: enemy.health,
            isDead: false,
            position: enemy.position,
            isMoving: enemy.isMoving || false,
          };
        }
      }
    }

    if (!target || target.isDead) return;

    // 2. Sub-tick Lag Compensation
    // Only valid for Players now (Enemies/Targets don't move or handled simply)
    if (playerTarget && data.timestamp) {
      const isValid = this.validateHitSubtick(target.id, data.timestamp, data.hitPosition);
      if (!isValid) {
        console.warn(`[Server] Sub-tick validation failed for ${attackerId} -> ${target.id}`);
        return;
      }
    }

    target.health -= data.damage;

    // Grant score for hitting
    const scoreGain = Math.round(data.damage);
    const currentScore = this.playerScores.get(attackerId) || 0;
    this.playerScores.set(attackerId, currentScore + scoreGain);
    this.totalTeamScore += scoreGain;

    // Apply back to source
    if (playerTarget) {
      playerTarget.health = target.health;
    } else if (target.type === 'enemy') {
      // Update Enemy Controller
      const enemy = this.enemyController.getEnemyStates().get(target.id);
      if (enemy) enemy.health = target.health;
    }

    this.network.sendEvent(EventCode.ON_HIT, {
      targetId: data.targetId,
      damage: data.damage,
      remainingHealth: target.health,
      shooterId: attackerId,
    });

    if (target.health <= 0) {
      target.isDead = true;
      target.health = 0;
      if (playerTarget) playerTarget.isDead = true;

      // Bonus score for kill
      const killBonus = 50;
      const ks = this.playerScores.get(attackerId) || 0;
      this.playerScores.set(attackerId, ks + killBonus);
      this.totalTeamScore += killBonus;

      // Broadcast death
      this.network.sendEvent(EventCode.ON_DIED, {
        victimId: data.targetId,
        killerId: attackerId,
        reason: 'Shot',
      });

      // Respawn Logic for Players
      if (target.type === 'player' && this.matchState === 'PLAYING') {
        setTimeout(() => {
          // Only respawn if match is still playing
          if (this.matchState === 'PLAYING') {
            this.respawnPlayer(data.targetId);
          }
        }, this.RESPAWN_TIME_MS);
      }

      // Special handling for non-players
      if (target.type !== 'player') {
        if (target.type === 'enemy') {
          // Let EnemyController know? OR just broadcast Destroy
          // For now, simple destroy
          this.network.sendEvent(EventCode.ON_ENEMY_DESTROY, { id: data.targetId });
          this.enemyController.removeEnemy(data.targetId);

          // Drop Table Logic
          if (Math.random() < this.DROP_CHANCE) {
            const itemType = this.DROP_ITEMS[Math.floor(Math.random() * this.DROP_ITEMS.length)];
            const pickupId = `pickup_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            const spawnPos = { ...target.position! }; // Clone position
            spawnPos.y += 0.5;

            const pickup = new PickupSpawnData(pickupId, itemType, spawnPos);
            this.activePickups.set(pickupId, pickup);

            this.network.sendEvent(EventCode.SPAWN_PICKUP, pickup, true, 'all');
          }
        } else if (target.type && target.type.includes('target')) {
          this.network.sendEvent(EventCode.TARGET_DESTROY, { id: data.targetId });
          // Note: entityStates removal happens in setupListeners when listening to TARGET_DESTROY
          // But Server is the authority, it should remove ITSELF
          this.entityStates.delete(data.targetId);
        }
      }
    }
  }

  private processPickupRequest(
    senderId: string,
    state: ServerPlayerState,
    data: ReqTryPickupPayload
  ) {
    const pickup = this.activePickups.get(data.id);
    if (!pickup) {
      console.warn(`[Server] Pickup request failed: Pickup ${data.id} not active.`);
      return;
    }

    const dx = state.position!.x - pickup.position.x;
    const dz = state.position!.z - pickup.position.z;
    const distSq = dx * dx + dz * dz;

    if (distSq < 5 * 5) {
      console.log(`[Server] Pickup validated: ${data.id} by ${senderId}`);
      this.activePickups.delete(data.id);
      this.network.sendEvent(
        EventCode.ON_ITEM_PICKED,
        {
          id: data.id,
          type: pickup.type,
          ownerId: senderId,
        },
        true,
        'all'
      );
      this.network.sendEvent(EventCode.DESTROY_PICKUP, { id: data.id }, true, 'all');
    } else {
      console.warn(`[Server] Pickup denied: Too far. DistSq=${distSq}`);
    }
  }

  private processUseItem(senderId: string, state: ServerPlayerState, data: ReqUseItemPayload) {
    if (state.isDead) return;

    if (data.itemType === 'health_pack') {
      // Apply healing
      const healAmount = 50;
      const currentHP = state.health !== undefined ? state.health : this.DEFAULT_HP;
      state.health = Math.min(this.DEFAULT_HP, currentHP + healAmount);

      console.log(`[Server] Player ${senderId} used health_pack. Health: ${state.health}`);

      this.network.sendEvent(EventCode.ON_HIT, {
        targetId: senderId,
        damage: -healAmount, // Negative damage = healing
        remainingHealth: state.health,
        shooterId: senderId,
      });
    }
  }

  /* Target Spawning Logic (Moved from Client) */
  private spawnInitialTargets() {
    console.log('[Server] Spawning Initial Targets...');
    // Clear existing
    this.entityStates.forEach((e) => {
      this.network.sendEvent(EventCode.TARGET_DESTROY, { id: e.id }, true, 'all');
    });
    this.entityStates.clear();

    const distances = [10, 15, 20];
    for (let lane = 0; lane < 5; lane++) {
      const x = (lane - 2) * 7;
      distances.forEach((z) => {
        const isMoving = Math.random() > 0.5;
        this.spawnTarget({ x, y: 1.0, z }, isMoving);
      });
    }
  }

  private spawnTarget(position: { x: number; y: number; z: number }, isMoving: boolean) {
    const id = `target_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const type = isMoving ? 'moving_target' : 'static_target'; // Simplified types

    const targetState: ServerEntityState = {
      id,
      type,
      health: 100,
      maxHealth: 100,
      isDead: false,
      position,
      isMoving,
    };

    this.entityStates.set(id, targetState);

    const payload = new TargetSpawnData(id, type, position, isMoving);
    this.network.sendEvent(EventCode.SPAWN_TARGET, payload, true, 'all');
  }

  public dispose() {
    this.stopLoops();
    this.playerStates.clear();
    this.entityStates.clear();
    this.activePickups.clear();
    this.playerScores.clear();
    console.log('[Server] Logical Server Stopped 🔴');
  }
}
