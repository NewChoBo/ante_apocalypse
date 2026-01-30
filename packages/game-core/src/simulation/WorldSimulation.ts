import { BaseEnemyManager } from '../systems/BaseEnemyManager.js';
import { BasePickupManager } from '../systems/BasePickupManager.js';
import { BaseTargetSpawner } from '../systems/BaseTargetSpawner.js';
import { INetworkAuthority } from '../network/INetworkAuthority.js';
import { IGameRule } from '../rules/IGameRule.js';

/**
 * 전역 월드 시뮬레이션을 관리하는 컨테이너.
 * 서버 혹은 호스트 클라이언트에서 시뮬레이션 엔진으로 사용됨.
 */
export class WorldSimulation {
  constructor(
    public readonly enemies: BaseEnemyManager,
    public readonly pickups: BasePickupManager,
    public readonly targets: BaseTargetSpawner,
    private authority: INetworkAuthority
  ) {}

  private gameRule: IGameRule | null = null;

  public setGameRule(rule: IGameRule): void {
    this.gameRule = rule;
  }

  /**
   * 시뮬레이션 틱 업데이트 (서버 루프 등에서 호출)
   */
  public update(_deltaTime: number): void {
    if (!this.authority.isMasterClient()) return;

    // TODO: AI 업데이트, 물리 시뮬레이션 등 서버 전용 로직 통합
    // 현재는 각 매니저의 helper들을 호출하는 용도로 사용 가능

    if (this.gameRule) {
      this.gameRule.onUpdate(this, _deltaTime);
    }
  }

  public initializeRequest(): void {
    if (!this.authority.isMasterClient()) return;

    if (this.gameRule) {
      this.gameRule.onInitialize(this);
    }
  }
}
