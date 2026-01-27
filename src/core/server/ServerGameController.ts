import { NetworkManager } from '../network/NetworkManager';
import {
  EventCode,
  ReqFirePayload,
  ReqHitPayload,
  ReqReloadPayload,
  OnAmmoSyncPayload,
} from '../network/NetworkProtocol';

interface ServerPlayerState {
  id: string;
  hp: number;
  ammo: Record<string, { current: number; reserve: number; magazineSize: number }>;
  isDead: boolean;
}

export class ServerGameController {
  private network: NetworkManager;
  private playerStates: Map<string, ServerPlayerState> = new Map();

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
    // Listen to Raw Events (Requests from Clients)
    this.network.onEvent.add((payload) => {
      const { code, data, senderId } = payload;
      this.handlePacket(code, data, senderId || '');
    });
  }

  private handlePacket(code: number, data: any, senderId: string) {
    if (!senderId) return;

    // Ensure player state exists
    if (!this.playerStates.has(senderId)) this.initializePlayer(senderId);

    const state = this.playerStates.get(senderId)!;
    if (state.isDead) return;

    switch (code) {
      case EventCode.REQ_FIRE:
        console.log(`[Server] Received REQ_FIRE from ${senderId}`);
        this.processFire(senderId, state, data as ReqFirePayload);
        break;
      case EventCode.REQ_HIT:
        console.log(`[Server] Received REQ_HIT from ${senderId}`);
        this.processHit(senderId, data as ReqHitPayload);
        break;
      case EventCode.REQ_RELOAD:
        console.log(`[Server] Received REQ_RELOAD from ${senderId}`);
        this.processReload(senderId, state, data as ReqReloadPayload);
        break;
    }
  }

  private initializePlayer(id: string) {
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
      hp: this.DEFAULT_HP,
      ammo,
      isDead: false,
    });
    console.log(`[Server] Initialized Player: ${id}`);
  }

  private processFire(shooterId: string, state: ServerPlayerState, data: ReqFirePayload) {
    const weaponId = data.weaponId || 'Rifle';
    const ammoData = state.ammo[weaponId];

    // 1. Validation
    if (!ammoData || ammoData.current <= 0) {
      console.warn(`[Server] ${shooterId} Out of Ammo with ${weaponId}!`);
      return;
    }

    // 2. Logic (Deduct Ammo)
    if (weaponId !== 'Bat' && weaponId !== 'Knife') {
      ammoData.current--;
    }

    // 3. Broadcast Result (ON_FIRED)
    this.network.sendEvent(EventCode.ON_FIRED, {
      shooterId,
      weaponId,
      muzzleData: (data as any).muzzleData, // Maintain existing structure for effects
      ammoRemaining: ammoData.current,
    });

    // 4. Sync Ammo to shooter (Reliable)
    const onAmmo = new OnAmmoSyncPayload(weaponId, ammoData.current, ammoData.reserve);
    this.network.sendEvent(EventCode.ON_AMMO_SYNC, onAmmo, true);
  }

  private processReload(senderId: string, state: ServerPlayerState, data: ReqReloadPayload) {
    const weaponId = data.weaponId;
    const ammoData = state.ammo[weaponId];

    if (ammoData && ammoData.reserve > 0 && ammoData.current < ammoData.magazineSize) {
      const needed = ammoData.magazineSize - ammoData.current;
      const amount = Math.min(needed, ammoData.reserve);

      ammoData.current += amount;
      ammoData.reserve -= amount;

      console.log(
        `[Server] User ${senderId} reloaded ${weaponId}. New Ammo: ${ammoData.current}/${ammoData.reserve}`
      );

      // Sync back to client
      const onAmmo = new OnAmmoSyncPayload(weaponId, ammoData.current, ammoData.reserve);
      this.network.sendEvent(EventCode.ON_AMMO_SYNC, onAmmo, true);
    }
  }

  private processHit(attackerId: string, data: ReqHitPayload) {
    const targetState = this.playerStates.get(data.targetId);

    // For unregistered targets (like dummy targets), create a temp state
    let effectiveTarget = targetState;
    if (!effectiveTarget) {
      effectiveTarget = {
        id: data.targetId,
        hp: 100,
        ammo: {},
        isDead: false,
      };
      this.playerStates.set(data.targetId, effectiveTarget);
    }

    if (effectiveTarget.isDead) return;

    // Apply Damage
    effectiveTarget.hp -= data.damage;
    console.log(`[Server] Target ${data.targetId} HP: ${effectiveTarget.hp}`);

    // Broadcast ON_HIT
    this.network.sendEvent(EventCode.ON_HIT, {
      targetId: data.targetId,
      damage: data.damage,
      remainingHealth: effectiveTarget.hp,
      shooterId: attackerId,
      hitPosition: data.hitPosition,
    });

    if (effectiveTarget.hp <= 0) {
      effectiveTarget.isDead = true;
      effectiveTarget.hp = 0;
      this.network.sendEvent(EventCode.ON_DIED, {
        victimId: data.targetId,
        killerId: attackerId,
        reason: 'Shot',
      });
    }
  }

  public dispose() {
    this.playerStates.clear();
    console.log('[Server] Logical Server Stopped 🔴');
  }
}
