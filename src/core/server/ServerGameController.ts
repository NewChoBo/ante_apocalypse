import { NetworkManager } from '../network/NetworkManager';
import {
  EventCode,
  ReqFirePayload,
  ReqHitPayload,
  ReqReloadPayload,
  OnFiredPayload,
  OnHitPayload,
  OnAmmoSyncPayload,
  OnDiedPayload,
} from '../network/NetworkProtocol';

interface UserState {
  ammo: Record<string, { current: number; reserve: number; magazineSize: number }>;
  health: number;
}

/**
 * Master Client에서만 실행되는 논리 서버 컨트롤러.
 * 뷰(Mesh, Sound)와 무관하게 데이터 검증 및 상태 관리만 담당합니다.
 */
export class ServerGameController {
  private networkManager: NetworkManager;
  private userStates: Map<string, UserState> = new Map();

  // 설정값 (추후 데이터 파일로 분리 가능)
  private readonly DEFAULT_HEALTH = 100;

  constructor() {
    this.networkManager = NetworkManager.getInstance();
    this.setupListeners();
    console.log('[ServerGameController] Initialized (Master Authority)');
  }

  public dispose(): void {
    // 리스너 해제 등 정리 로직이 필요하다면 구현
    console.log('[ServerGameController] Disposed');
  }

  private setupListeners(): void {
    // NetworkManager로부터 Raw Event 수신
    // 주의: NetworkManager.onEvent는 모~든 이벤트를 수신하므로 필터링 필요
    this.networkManager.onEvent.add((event) => {
      // 오직 Request만 처리
      switch (event.code) {
        case EventCode.REQ_FIRE:
          this.handleReqFire(event.data as ReqFirePayload, event.senderId || '');
          break;
        case EventCode.REQ_HIT:
          this.handleReqHit(event.data as ReqHitPayload, event.senderId || '');
          break;
        case EventCode.REQ_RELOAD:
          this.handleReqReload(event.data as ReqReloadPayload, event.senderId || '');
          break;
      }
    });

    // 플레이어 입장 시 초기 상태 생성
    this.networkManager.onPlayerJoined.add((player) => {
      if (!this.userStates.has(player.id)) {
        this.initializeUserState(player.id);
      }
    });
  }

  private initializeUserState(userId: string): void {
    this.userStates.set(userId, {
      ammo: {
        Rifle: { current: 30, reserve: 90, magazineSize: 30 },
        Pistol: { current: 12, reserve: 60, magazineSize: 12 },
      },
      health: this.DEFAULT_HEALTH,
    });
    console.log(`[Server] Initialized state for user ${userId}`);
  }

  private handleReqFire(payload: ReqFirePayload, senderId: string): void {
    // 1. 상태 가져오기
    let state = this.userStates.get(senderId);
    if (!state) {
      this.initializeUserState(senderId);
      state = this.userStates.get(senderId)!;
    }

    const weaponId = payload.weaponId || 'Rifle'; // Default fallback
    const ammoData = state.ammo[weaponId] || { current: 30, reserve: 90, magazineSize: 30 };

    // 2. 검증 (탄약 확인)
    if (ammoData.current > 0) {
      // 3. 로직 수행 (탄약 차감)
      ammoData.current--;
      state.ammo[weaponId] = ammoData;

      // 4. 통보 (Notification)
      // A. 발사 성공 (VFX 재생용 - Unreliable 권장이나 중요도에 따라 Reliable)
      const onFired = new OnFiredPayload(senderId, weaponId, payload.muzzleData);
      this.networkManager.sendEvent(EventCode.ON_FIRED, onFired, false);

      // B. 탄약 동기화 (UI용 - Reliable, 해당 유저에게만 보내면 좋지만 현재 구조상 Broadcast)
      const onAmmo = new OnAmmoSyncPayload(weaponId, ammoData.current, ammoData.reserve);
      this.networkManager.sendEvent(EventCode.ON_AMMO_SYNC, onAmmo, true);
    } else {
      console.warn(`[Server] User ${senderId} tried to fire ${weaponId} but has no ammo.`);
    }
  }

  private handleReqReload(payload: ReqReloadPayload, senderId: string): void {
    let state = this.userStates.get(senderId);
    if (!state) {
      this.initializeUserState(senderId);
      state = this.userStates.get(senderId)!;
    }

    const weaponId = payload.weaponId;
    const ammoData = state.ammo[weaponId];

    if (ammoData && ammoData.reserve > 0 && ammoData.current < ammoData.magazineSize) {
      const needed = ammoData.magazineSize - ammoData.current;
      const amount = Math.min(needed, ammoData.reserve);

      ammoData.current += amount;
      ammoData.reserve -= amount;
      state.ammo[weaponId] = ammoData;

      console.log(
        `[Server] User ${senderId} reloaded ${weaponId}. New Ammo: ${ammoData.current}/${ammoData.reserve}`
      );

      // Sync back to client
      const onAmmo = new OnAmmoSyncPayload(weaponId, ammoData.current, ammoData.reserve);
      this.networkManager.sendEvent(EventCode.ON_AMMO_SYNC, onAmmo, true);
    }
  }

  private handleReqHit(payload: ReqHitPayload, senderId: string): void {
    // 1. 타겟 상태 확인
    const targetId = payload.targetId;
    const targetState = this.userStates.get(targetId);

    if (targetState) {
      // 2. 데미지 적용
      if (targetState.health > 0) {
        targetState.health -= payload.damage;
        if (targetState.health < 0) targetState.health = 0;

        // 3. 결과 전송 (HP 갱신)
        const onHit = new OnHitPayload(
          targetId,
          payload.damage,
          targetState.health,
          senderId,
          payload.hitPosition,
          payload.hitNormal
        );
        this.networkManager.sendEvent(EventCode.ON_HIT, onHit, true);

        // 4. 사망 처리
        if (targetState.health <= 0) {
          const onDied = new OnDiedPayload(targetId, senderId, 'Shot');
          this.networkManager.sendEvent(EventCode.ON_DIED, onDied, true);
        }
      }
    } else {
      const onHit = new OnHitPayload(
        targetId,
        payload.damage,
        -1, // Unknown health
        senderId,
        payload.hitPosition,
        payload.hitNormal
      );
      this.networkManager.sendEvent(EventCode.ON_HIT, onHit, true);
    }
  }
}
