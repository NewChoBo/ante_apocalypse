import { ITarget } from '../../types/ITarget';

/**
 * 활성화된 모든 타겟을 중앙에서 관리하는 시스템.
 * 싱글톤으로 설계되어 어디서든 타겟을 조회하거나 피격 처리를 요청할 수 있습니다.
 */
export class TargetRegistry {
  private static instance: TargetRegistry;
  private targets: Map<string, ITarget> = new Map();

  private constructor() {}

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
  public hitTarget(targetId: string, part: string, damage: number): boolean {
    const target = this.targets.get(targetId);
    if (!target || !target.isActive) return false;

    target.takeDamage(damage, part);

    // 타겟이 파괴되었는지 여부 반환
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
