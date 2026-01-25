import { ITarget } from '../../types/ITarget';
import { NetworkManager } from './NetworkManager';
import { EventCode } from '../network/NetworkProtocol';

/**
 * 활성화된 모든 타겟을 중앙에서 관리하는 시스템.
 * 싱글톤으로 설계되어 어디서든 타겟을 조회하거나 피격 처리를 요청할 수 있습니다.
 */
export class TargetRegistry {
  private static instance: TargetRegistry;
  private targets: Map<string, ITarget> = new Map();
  private networkManager: NetworkManager;

  private constructor() {
    this.networkManager = NetworkManager.getInstance();
    this.setupNetworkListeners();
  }

  private setupNetworkListeners(): void {
    this.networkManager.onTargetHit.add((data) => {
      this.hitTarget(data.targetId, data.part, data.damage, false); // False = don't broadcast
    });

    this.networkManager.onTargetDestroy.add((data) => {
      const target = this.targets.get(data.targetId);
      if (target && target.isActive) {
        target.takeDamage(10000, 'head'); // Force destroy
      }
    });
  }

  public static getInstance(): TargetRegistry {
    if (!TargetRegistry.instance) {
      TargetRegistry.instance = new TargetRegistry();
    }
    return TargetRegistry.instance;
  }

  /** 새로운 타겟 등록 */
  public register(target: ITarget): void {
    this.targets.set(target.id, target);
  }

  /** 타겟 등록 해제 */
  public unregister(targetId: string): void {
    this.targets.delete(targetId);
  }

  /** 특정 ID의 타겟 조회 */
  public getTarget(targetId: string): ITarget | undefined {
    return this.targets.get(targetId);
  }

  /** 모든 활성 타겟 반환 */
  public getAllTargets(): ITarget[] {
    return Array.from(this.targets.values()).filter((t) => t.isActive);
  }

  /** 타겟 피격 처리 */
  public hitTarget(
    targetId: string,
    part: string,
    damage: number,
    broadcast: boolean = true
  ): boolean {
    const target = this.targets.get(targetId);
    if (!target || !target.isActive) return false;

    target.takeDamage(damage, part);

    if (broadcast && (this.networkManager.isMasterClient() || !this.networkManager.getSocketId())) {
      // Broadcast Hit (Note: NetworkManager.hit is for PlayerHit, we need custom event)
      this.networkManager.sendEvent(EventCode.TARGET_HIT, {
        targetId,
        part,
        damage,
      });
    }

    // Check destruction
    if (!target.isActive && broadcast) {
      // If it died from this hit, and we are authority (or allowed to claim kill), broadcast destroy
      // Actually typically Master tracks health. But for targets, maybe simplistic:
      // If damage kills it locally, tell everyone.
      this.networkManager.sendEvent(EventCode.TARGET_DESTROY, { targetId });
    }

    return !target.isActive;
  }

  /** 디버그용: 현재 관리 중인 타겟 수 */
  public get count(): number {
    return this.targets.size;
  }

  /** 모든 타겟 등록 해제 (게임 리셋용) */
  public clear(): void {
    this.targets.clear();
  }
}
