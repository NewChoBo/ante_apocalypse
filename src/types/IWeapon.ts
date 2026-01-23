/**
 * 무기 시스템의 핵심 인터페이스.
 * 모든 무기 클래스가 구현해야 하는 표준 계약입니다.
 */
export interface IWeapon {
  /** 무기 이름 */
  name: string;

  /** 현재 탄약 수 */
  currentAmmo: number;

  /** 전체 탄약 수 (탄창 크기) */
  magazineSize: number;

  /** 예비 탄약 수 */
  reserveAmmo: number;

  /** 기본 데미지 */
  damage: number;

  /** 발사 간격 (초) */
  fireRate: number;

  /** 사거리 */
  range: number;

  /** 재장전 시간 (초) */
  reloadTime: number;

  /** 발사 모드: 'semi' = 단발, 'auto' = 연발 */
  firingMode: 'semi' | 'auto';

  /** 발사 시도 (단발) */
  fire(): boolean;

  /** 연발 시작 (auto 모드 전용) */
  startFire(): void;

  /** 연발 중지 (auto 모드 전용) */
  stopFire(): void;

  /** 재장전 시도 */
  reload(): void;

  /** 매 프레임 업데이트 (반동 회복, 애니메이션 등) */
  update(deltaTime: number): void;

  /** 무기 스태츠 가져오기 */
  getStats(): any;

  /** 무기 모델 표시 */
  show(): void;

  /** 무기 모델 숨기기 */
  hide(): void;

  /** 자원 해제 */
  dispose(): void;
}
