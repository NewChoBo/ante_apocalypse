import { Vector3, Node } from '@babylonjs/core';

/**
 * 총구의 위치와 방향을 제공하는 인터페이스.
 */
export interface IMuzzleProvider {
  getMuzzleTransform(): {
    position: Vector3;
    direction: Vector3;
    transformNode?: Node;
  };
}

/**
 * 모든 무기(총기, 근접 무기 등)의 핵심 인터페이스.
 */
export interface IWeapon {
  /** 무기 이름 */
  name: string;

  /** 기본 데미지 */
  damage: number;

  /** 사거리 */
  range: number;

  /** 발사/공격 시도 */
  fire(): boolean;

  /** 공격 시작 (연사 혹은 휘두르기 시작) */
  startFire(): void;

  /** 공격 중지 */
  stopFire(): void;

  /** 매 프레임 업데이트 */
  update(deltaTime: number): void;

  /** 무기 스태츠 가져오기 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getStats(): Record<string, any>;

  /** 무기 모델 표시 */
  show(): void;

  /** 무기 모델 숨기기 */
  hide(): void;

  /** 무기 내리기 애니메이션 (교체 시) */
  lower(): Promise<void>;

  /** 무기 올리기 애니메이션 (교체 시) */
  raise(): void;

  /** 현재 상태에 따른 이동 속도 배수 반환 */
  getMovementSpeedMultiplier(): number;

  /** 현재 상태에 따른 원하는 FOV 반환 */
  getDesiredFOV(defaultFOV: number): number;

  /** 정조준 상태 설정 */
  setAiming(isAiming: boolean): void;

  /** 탄약 추가 */
  addAmmo(amount: number): void;

  /** 서버 데이터로 스태츠 업데이트 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateStats(stats: Partial<Record<string, any>>): void;

  /** 리소스 해제 */
  dispose(): void;
}

/**
 * 총기류 전용 인터페이스
 */
export interface MuzzleTransform {
  position: Vector3;
  direction: Vector3;
  transformNode?: Node;
  localMuzzlePosition?: Vector3;
}

export interface IFirearm extends IWeapon {
  currentAmmo: number;
  magazineSize: number;
  reserveAmmo: number;

  fireRate: number;
  reloadTime: number;
  firingMode: 'semi' | 'auto';
  recoilForce: number;

  startFire(): void;
  stopFire(): void;
  reload(): void;

  getMuzzleTransform(): MuzzleTransform;
}
