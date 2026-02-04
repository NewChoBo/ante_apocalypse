/**
 * 간단한 의존성 주입 컨테이너
 *
 * Singleton 패턴의 대안으로, 테스트 가능한 의존성 관리 제공
 */
export class DIContainer {
  private static instance: DIContainer;
  private services: Map<string, unknown> = new Map();
  private factories: Map<string, () => unknown> = new Map();

  private constructor() {}

  /**
   * 싱글톤 인스턴스获取
   */
  public static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  /**
   * 서비스 등록 (인스턴스)
   */
  public register<T>(token: string, instance: T): void {
    this.services.set(token, instance);
  }

  /**
   * 팩토리 등록 (매번 새 인스턴스 생성)
   */
  public registerFactory<T>(token: string, factory: () => T): void {
    this.factories.set(token, factory as () => unknown);
  }

  /**
   * 서비스解决
   * 팩토리가 등록되어 있으면 팩토리 사용, 없으면 등록된 인스턴스 반환
   */
  public resolve<T>(token: string): T {
    const factory = this.factories.get(token);
    if (factory) {
      return factory() as T;
    }

    const instance = this.services.get(token);
    if (!instance) {
      throw new Error(`Service '${token}' not found in DI container`);
    }
    return instance as T;
  }

  /**
   * 서비스是否存在 확인
   */
  public has(token: string): boolean {
    return this.services.has(token) || this.factories.has(token);
  }

  /**
   * 서비스 제거
   */
  public unregister(token: string): void {
    this.services.delete(token);
    this.factories.delete(token);
  }

  /**
   * 모든 서비스清除
   */
  public clear(): void {
    this.services.clear();
    this.factories.clear();
  }

  /**
   * 디버그 정보 반환
   */
  public debugInfo(): { services: string[]; factories: string[] } {
    return {
      services: Array.from(this.services.keys()),
      factories: Array.from(this.factories.keys()),
    };
  }
}

/**
 * 의존성 토큰 상수
 */
export const DI_TOKENS = {
  NETWORK_MANAGER: 'NetworkManager',
  GLOBAL_INPUT_MANAGER: 'GlobalInputManager',
  TICK_MANAGER: 'TickManager',
  WORLD_ENTITY_MANAGER: 'WorldEntityManager',
  PICKUP_MANAGER: 'PickupManager',
  UI_MANAGER: 'UIManager',
  GAME_STORE: 'GameStore',
  SETTINGS_STORE: 'SettingsStore',
} as const;

export type DI_TOKEN = (typeof DI_TOKENS)[keyof typeof DI_TOKENS];
