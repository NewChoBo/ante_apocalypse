/**
 * 엔티티 생명주기 관리 인터페이스
 * 스스로 등록/해제 로직을 처리할 수 있는 엔티티가 구현합니다.
 */
export interface ILifecycleAware {
  activate(): void;
  deactivate(): void;
}
