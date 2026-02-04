/**
 * 총기류 무기 설정
 */
export const FirearmConfig = {
  /** 조준 시 확산 계수 */
  AIM_SPREAD: 0.01,

  /** 일반 사격 확산 계수 */
  NORMAL_SPREAD: 0.05,

  /** 매거진 투척 애니메이션 생명주기 (프레임) */
  MAGAZINE_LIFETIME_FRAMES: 60,

  /** 탄약 투척 중력 계수 */
  MAGAZINE_GRAVITY: -0.01,

  /** 탄약 투척 초기 속도 */
  MAGAZINE_INITIAL_VELOCITY: -0.05,

  /** 매거진 회전 속도 X축 */
  MAGAZINE_ROTATION_X: 0.1,

  /** 매거진 회전 속도 Z축 */
  MAGAZINE_ROTATION_Z: 0.05,

  /** 매거진 투척 위치 오프셋 */
  MAGAZINE_OFFSET: { x: 0, y: -0.1, z: 0 },

  /** 매거진 크기 */
  MAGAZINE_SIZE: { width: 0.04, height: 0.08, depth: 0.04 },
} as const;

/**
 * 사격 관련 설정
 */
export const ShootingConfig = {
  /** 반동 적용 힘 (기본값) */
  DEFAULT_RECOIL_FORCE: 0.1,

  /** 관측자 생명주기 체크 간격 (프레임) */
  OBSERVER_LIFETIME_CHECK: 60,
} as const;

/**
 * 무기 이동 속도 설정
 */
export const WeaponMovementConfig = {
  /** 조준 시 이동 속도 배율 */
  AIMING_SPEED_MULTIPLIER: 0.4,

  /** 일반 이동 속도 배율 */
  NORMAL_SPEED_MULTIPLIER: 1.0,

  /** 근접 무기 이동 속도 배율 */
  MELEE_SPEED_MULTIPLIER: 1.0,
} as const;
