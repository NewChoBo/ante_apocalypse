import { NetworkManager } from '../network/NetworkManager';
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
  OnPosCorrectionPayload,
  ReqUseItemPayload,
  OnStateDeltaPayload,
} from '../network/NetworkProtocol';

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
  private network: NetworkManager;
  private enemyController: ServerEnemyController;
  private playerStates: Map<string, ServerPlayerState> = new Map();
  // entityStates now only holds static targets or other non-enemy AI entities
  private entityStates: Map<string, ServerEntityState> = new Map();
  private activePickups: Map<string, PickupSpawnData> = new Map();

  // Match State
  private matchState: 'READY' | 'PLAYING' | 'GAME_OVER' = 'READY';
  private remainingSeconds: number = 60; // 1 minute default
  private matchTimer: ReturnType<typeof setInterval> | null = null;

  // Scoring
  private playerScores: Map<string, number> = new Map();
  private totalTeamScore: number = 0;
  private readonly TARGET_SCORE = 500;

  // Anti-Cheat / Validation
  private lastFireTimes: Map<string, Record<string, number>> = new Map();
  private lastInputTimes: Map<string, number> = new Map();
  private entityHistory: Map<
    string,
    { timestamp: number; position: { x: number; y: number; z: number } }[]
  > = new Map();

  // Delta Sync tracking
  private lastSentStates: Map<string, string> = new Map();
  private fullSyncCounter: number = 0;

  // Config
  private readonly HISTORY_DURATION_MS = 1000; // 1 second of history
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

  constructor() {
    this.network = NetworkManager.getInstance();
    this.enemyController = new ServerEnemyController();
    this.setupListeners();
    this.startMatchTimer();
    console.log('%c[Server] Logical Server Started 🟢', 'color: lightgreen; font-weight: bold;');
  }

  private startMatchTimer() {
    if (this.matchTimer) clearInterval(this.matchTimer);

    this.matchTimer = setInterval(() => {
      this.tick();
    }, 100); // 10Hz tick rate
  }

  private tick() {
    // 0. Update AI
    if (this.matchState === 'PLAYING') {
      const playerPositions = new Map<string, { x: number; y: number; z: number }>();
      this.playerStates.forEach((p) => {
        if (!p.isDead && p.position) {
          playerPositions.set(p.id, p.position);
        }
      });
      this.enemyController.tick(0.1, playerPositions);
    }

    // High-frequency tasks
    this.broadcastDeltaSync();

    // Low-frequency tasks (per second)
    this.fullSyncCounter++;
    if (this.fullSyncCounter >= 10) {
      this.fullSyncCounter = 0;

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
  }

  private broadcastMatchState() {
    const minutes = Math.floor(this.remainingSeconds / 60);
    const seconds = Math.floor(this.remainingSeconds % 60);
    const formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    const payload = new OnMatchStateSyncPayload(this.matchState, formatted, this.remainingSeconds);
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
    this.matchState = 'PLAYING';
    this.remainingSeconds = 60;
    this.totalTeamScore = 0;
    this.playerScores.clear();
    this.startMatchTimer(); // Ensure timer is running
    console.log('[Server] Match Started!');
  }

  private broadcastDeltaSync() {
    const changedPlayers: Partial<PlayerData>[] = [];
    const changedEnemies: Partial<EnemyUpdateData>[] = [];
    const changedTargets: Partial<TargetSpawnData>[] = [];

    // Check Players
    this.playerStates.forEach((s) => {
      const stateSummary = JSON.stringify({
        p: s.position,
        r: s.rotation,
        w: s.weaponId,
        h: s.health,
      });
      if (this.lastSentStates.get(s.id) !== stateSummary) {
        changedPlayers.push({
          id: s.id,
          position: s.position,
          rotation: s.rotation,
          weaponId: s.weaponId,
          health: s.health,
        });
        this.lastSentStates.set(s.id, stateSummary);
      }
    });

    // Check Enemies (From EnemyController)
    this.enemyController.getEnemyStates().forEach((e) => {
      const stateSummary = JSON.stringify({
        p: e.position,
        r: e.rotation,
        h: e.health,
        s: e.state,
      });

      if (this.lastSentStates.get(e.id) !== stateSummary) {
        changedEnemies.push({
          id: e.id,
          position: e.position,
          rotation: e.rotation,
          health: e.health,
          state: e.state,
          isMoving: e.isMoving,
        });
        this.lastSentStates.set(e.id, stateSummary);
      }
    });

    // Check Targets (From entityStates)
    this.entityStates.forEach((e) => {
      const stateSummary = JSON.stringify({
        p: e.position,
        r: e.rotation,
        h: e.health,
      });
      if (this.lastSentStates.get(e.id) !== stateSummary) {
        // Targets only
        changedTargets.push({
          id: e.id,
          position: e.position!,
          health: e.health,
        } as any);
        this.lastSentStates.set(e.id, stateSummary);
      }
    });

    if (changedPlayers.length > 0 || changedEnemies.length > 0 || changedTargets.length > 0) {
      const payload = new OnStateDeltaPayload(
        Date.now(),
        changedPlayers,
        changedEnemies,
        changedTargets
      );
      this.network.sendEvent(EventCode.ON_STATE_DELTA, payload, false, 'all');
    }
  }

  private setupListeners() {
    this.network.onEvent.add((payload) => {
      const { code, data, senderId } = payload;
      this.handlePacket(code, data, senderId || '');
    });

    this.network.onPlayerJoined.add((player) => {
      this.initializePlayer(player.id, player.name || 'Anonymous');
      this.sendWorldSnapshot(player.id);

      if (this.matchState === 'READY' && this.playerStates.size >= 1) {
        this.startMatch();
      }
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
    const now = Date.now();

    switch (code) {
      case EventCode.MOVE: {
        const move = data as MovePayload;
        const lastTime = this.lastInputTimes.get(senderId) || 0;
        const dt = (now - lastTime) / 1000;

        // basic speed hack check (skip first packet)
        if (lastTime > 0 && dt > 0.01) {
          const prevPos = state.position || { x: 0, y: 0, z: 0 };
          const dist = Math.sqrt(
            Math.pow(move.position.x - prevPos.x, 2) +
              Math.pow(move.position.y - prevPos.y, 2) +
              Math.pow(move.position.z - prevPos.z, 2)
          );
          const speed = dist / dt;

          if (speed > 25) {
            // Increased limit slightly for burst movement, then correct
            console.warn(
              `[Server] Speed hack detected! Player=${senderId}, Speed=${speed.toFixed(2)}m/s. Correcting position.`
            );

            // Correct position to previous known good position
            this.network.sendEvent(
              EventCode.ON_POS_CORRECTION,
              new OnPosCorrectionPayload(prevPos, state.rotation),
              true,
              senderId
            );
            this.lastInputTimes.set(senderId, now);
            return; // Skip state update this frame
          }
        }

        state.position = move.position;
        state.rotation = move.rotation;
        state.weaponId = move.weaponId;
        this.lastInputTimes.set(senderId, now);

        this.recordHistory(senderId, move.position, now);
        break;
      }
      case EventCode.REQ_FIRE:
        if (!state.isDead) this.processFire(senderId, state, data as ReqFirePayload);
        break;
      case EventCode.REQ_HIT:
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
    }
  }

  private recordHistory(
    id: string,
    position: { x: number; y: number; z: number },
    timestamp: number
  ) {
    let history = this.entityHistory.get(id);
    if (!history) {
      history = [];
      this.entityHistory.set(id, history);
    }

    history.push({ timestamp, position });

    // Trim old history
    const cutoff = timestamp - this.HISTORY_DURATION_MS;
    while (history.length > 0 && history[0].timestamp < cutoff) {
      history.shift();
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
    this.lastFireTimes.set(id, {});
    console.log(`[Server] Initialized Player State: ${id}`);
  }

  private sendWorldSnapshot(_targetId: string) {
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
      if (e.type.includes('target')) {
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
  }

  private processFire(shooterId: string, state: ServerPlayerState, data: ReqFirePayload) {
    const weaponId = data.weaponId;
    const config = this.DEFAULT_WEAPON_DATA[weaponId];
    if (!config) return;

    // Fire rate check
    const now = Date.now();
    const playerFires = this.lastFireTimes.get(shooterId) || {};
    const lastFire = playerFires[weaponId] || 0;
    if (now - lastFire < config.fireRate * 0.9) {
      // 10% tolerance for jitter
      console.warn(`[Server] Fire rate violation: ${shooterId} with ${weaponId}`);
      return;
    }

    const ammoData = state.ammo[weaponId];
    if (!ammoData || ammoData.current <= 0) return;

    if (weaponId !== 'Bat' && weaponId !== 'Knife') {
      ammoData.current--;
    }

    playerFires[weaponId] = now;
    this.lastFireTimes.set(shooterId, playerFires);

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
    let target: { health: number; isDead: boolean; id: string; type: string } | undefined;

    if (playerTarget) {
      target = {
        id: playerTarget.id,
        type: playerTarget.type,
        health: playerTarget.health || 0,
        isDead: playerTarget.isDead,
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
            isDead: false, // Enemy controller handles death state removal separately, keeping simple here
          };
        }
      }
    }

    if (!target || target.isDead) return;

    // 2. Lag Compensation: Basic validation
    if (!this.validateHitWithLagComp(target.id, data.hitPosition)) {
      console.warn(`[Server] Potential hit validation failure for ${attackerId} -> ${target.id}`);
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

      // Special handling for non-players
      if (target.type !== 'player') {
        if (target.type === 'enemy') {
          // Let EnemyController know? OR just broadcast Destroy
          // For now, simple destroy
          this.network.sendEvent(EventCode.ON_ENEMY_DESTROY, { id: data.targetId });
          this.enemyController.removeEnemy(data.targetId);
        } else if (target.type && target.type.includes('target')) {
          this.network.sendEvent(EventCode.TARGET_DESTROY, { id: data.targetId });
          // Note: entityStates removal happens in setupListeners when listening to TARGET_DESTROY
          // But Server is the authority, it should remove ITSELF
          this.entityStates.delete(data.targetId);
        }
      }
    }
  }

  private validateHitWithLagComp(
    targetId: string,
    hitPos: { x: number; y: number; z: number }
  ): boolean {
    const history = this.entityHistory.get(targetId);
    if (!history || history.length === 0) return true; // Default to true if no history (e.g. static)

    // Check if hitPosition is close to ANY point in our 1-second history
    // (A more advanced version would use attacker latency to find EXACT point)
    const thresholdSquared = 2.0 * 2.0; // 2 meter radius tolerance

    for (const entry of history) {
      const distSq =
        Math.pow(hitPos.x - entry.position.x, 2) +
        Math.pow(hitPos.y - entry.position.y, 2) +
        Math.pow(hitPos.z - entry.position.z, 2);

      if (distSq < thresholdSquared) return true;
    }

    return false;
  }

  private processPickupRequest(
    senderId: string,
    state: ServerPlayerState,
    data: ReqTryPickupPayload
  ) {
    const pickup = this.activePickups.get(data.id);
    if (!pickup) return;

    const dx = state.position!.x - pickup.position.x;
    const dz = state.position!.z - pickup.position.z;
    const distSq = dx * dx + dz * dz;

    if (distSq < 5 * 5) {
      this.activePickups.delete(data.id);
      this.network.sendEvent(EventCode.ON_ITEM_PICKED, {
        id: data.id,
        type: pickup.type,
        ownerId: senderId,
      });
      this.network.sendEvent(EventCode.DESTROY_PICKUP, { id: data.id });
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

  public dispose() {
    if (this.matchTimer) clearInterval(this.matchTimer);
    this.playerStates.clear();
    this.entityStates.clear();
    this.activePickups.clear();
    this.playerScores.clear();
    console.log('[Server] Logical Server Stopped 🔴');
  }
}
