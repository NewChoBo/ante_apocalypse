/**
 * 캐릭터 이동 설정
 */
export const MovementConfig = {
  /** 걷기 속도 (m/s) */
  WALK_SPEED: 6,

  /** 달리기 속도 배율 */
  RUN_SPEED_MULTIPLIER: 1.6,

  /** 앉기 속도 배율 */
  CROUCH_MULTIPLIER: 0.5,

  /** 점프 힘 */
  JUMP_FORCE: 9,

  /** 유령 모드 이동 속도 배율 */
  GHOST_SPEED_MULTIPLIER: 2.0,

  /** 중력 가속도 */
  GRAVITY: -25,
} as const;

/**
 * 조준 관련 설정
 */
export const AimConfig = {
  /** 조준 시 확산 계수 */
  AIM_SPREAD: 0.01,

  /** 일반 사격 확산 계수 */
  NORMAL_SPREAD: 0.05,

  /** 조준 전환 속도 */
  AIM_TRANSITION_SPEED: 5.0,
} as const;

/**
 * 무기 관련 설정
 */
export const WeaponConfig = {
  /** 탄약 매거진 기본 지급 개수 배율 */
  DEFAULT_AMMO_MULTIPLIER: 5,
} as const;
