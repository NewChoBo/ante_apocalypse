import { NetworkManager } from '../network/NetworkManager';
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
} from '../network/NetworkProtocol';

interface ServerPlayerState extends PlayerData {
  ammo: Record<string, { current: number; reserve: number; magazineSize: number }>;
  isDead: boolean;
}

export class ServerGameController {
  private network: NetworkManager;
  private playerStates: Map<string, ServerPlayerState> = new Map();
  private activePickups: Map<string, PickupSpawnData> = new Map();

  // Config
  private readonly DEFAULT_HP = 100;
  private readonly DEFAULT_WEAPON_DATA: Record<string, { magazineSize: number; reserve: number }> =
    {
      Rifle: { magazineSize: 30, reserve: 90 },
      Pistol: { magazineSize: 12, reserve: 60 },
      Bat: { magazineSize: 9999, reserve: 0 },
      Knife: { magazineSize: 9999, reserve: 0 },
    };

  constructor() {
    this.network = NetworkManager.getInstance();
    this.setupListeners();
    console.log('%c[Server] Logical Server Started 🟢', 'color: lightgreen; font-weight: bold;');
  }

  private setupListeners() {
    this.network.onEvent.add((payload) => {
      const { code, data, senderId } = payload;
      this.handlePacket(code, data, senderId || '');
    });

    this.network.onPlayerJoined.add((player) => {
      this.initializePlayer(player.id, player.name || 'Anonymous');
      this.sendWorldSnapshot(player.id);
    });

    this.network.onPlayerLeft.add((playerId) => {
      if (this.playerStates.has(playerId)) {
        this.playerStates.delete(playerId);
        console.log(`[Server] Player ${playerId} cleaned up.`);
      }
    });

    // Capture spawned pickups for authority
    this.network.onEvent.add((p) => {
      if (p.code === EventCode.SPAWN_PICKUP) {
        const data = p.data as PickupSpawnData;
        this.activePickups.set(data.id, data);
      } else if (p.code === EventCode.DESTROY_PICKUP) {
        const data = p.data as { id: string };
        this.activePickups.delete(data.id);
      }
    });
  }

  private handlePacket(code: number, data: any, senderId: string) {
    if (!senderId) return;

    if (!this.playerStates.has(senderId)) {
      this.initializePlayer(senderId);
    }

    const state = this.playerStates.get(senderId)!;

    switch (code) {
      case EventCode.MOVE: {
        const move = data as MovePayload;
        state.position = move.position;
        state.rotation = move.rotation;
        state.weaponId = move.weaponId;
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
      health: this.DEFAULT_HP,
      ammo,
      isDead: false,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
    });
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

    const snapshot = new OnStateSyncPayload(
      Date.now(),
      players,
      [], // enemies
      [], // targets
      Array.from(this.activePickups.values())
    );

    this.network.sendEvent(EventCode.ON_STATE_SYNC, snapshot, true, 'all');
  }

  private processFire(shooterId: string, state: ServerPlayerState, data: ReqFirePayload) {
    const weaponId = data.weaponId;
    const ammoData = state.ammo[weaponId];

    if (!ammoData || ammoData.current <= 0) return;

    if (weaponId !== 'Bat' && weaponId !== 'Knife') {
      ammoData.current--;
    }

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
    const target = this.playerStates.get(data.targetId);
    if (!target || target.isDead) return;

    target.health = (target.health || 100) - data.damage;

    this.network.sendEvent(EventCode.ON_HIT, {
      targetId: data.targetId,
      damage: data.damage,
      remainingHealth: target.health,
      shooterId: attackerId,
    });

    if (target.health <= 0) {
      target.isDead = true;
      target.health = 0;
      this.network.sendEvent(EventCode.ON_DIED, {
        victimId: data.targetId,
        killerId: attackerId,
        reason: 'Shot',
      });
    }
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

  public dispose() {
    this.playerStates.clear();
    this.activePickups.clear();
    console.log('[Server] Logical Server Stopped 🔴');
  }
}
