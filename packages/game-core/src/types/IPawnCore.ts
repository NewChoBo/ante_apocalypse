import { IWorldEntity } from './IWorldEntity.js';
import { BaseComponent } from '../simulation/BaseComponent.js';

/**
 * 컴포넌트가 주인(Owner)에게 접근할 때 필요한 최소한의 인터페이스.
 */
export interface IPawnCore extends IWorldEntity {
  addComponent(component: any): void;
  getComponent<T extends BaseComponent>(type: new (...args: any[]) => T): T | undefined;
  die(): void;
}
