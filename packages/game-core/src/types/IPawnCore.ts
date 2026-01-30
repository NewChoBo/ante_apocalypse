import { IWorldEntity } from './IWorldEntity.js';

/**
 * 컴포넌트가 주인(Owner)에게 접근할 때 필요한 최소한의 인터페이스.
 */
export interface IPawnCore extends IWorldEntity {
  addComponent(component: any): void;
  getComponent<T>(type: any): T | undefined;
  die(): void;
}
