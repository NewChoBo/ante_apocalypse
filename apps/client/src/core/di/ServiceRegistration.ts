/**
 * DI Service Registration
 *
 * Registers Singleton instances and factories with the DI container.
 * This enables dependency injection throughout the application.
 */

import { DIContainer } from './DIContainer';
import { NetworkManager } from '../systems/NetworkManager';
import { WorldEntityManager } from '../systems/WorldEntityManager';
import { PickupManager } from '../systems/PickupManager';
import { TickManager } from '../TickManager';

/**
 * Register all Singleton services with the DI container
 */
export function registerServices(container: DIContainer): void {
  // NetworkManager - Singleton
  container.register('NetworkManager', NetworkManager.getInstance());
  container.register('IWorldEntityManager', WorldEntityManager.getInstance());
  container.register('IPickupManager', PickupManager.getInstance());
  container.register('ITickManager', TickManager.getInstance());
}

/**
 * Register factories for services that need new instances
 */
export function registerFactories(_container: DIContainer): void {
  // Example: PlayerLifecycleManager factory
  // _container.registerFactory('IPlayerLifecycleManager', () => {
  //   return new PlayerLifecycleManager(config);
  // });
}

/**
 * Initialize all services after registration
 */
export function initializeServices(container: DIContainer): void {
  // Services that require initialization after registration
  const tickManager = container.resolve<ITickManager>('ITickManager');
  tickManager.register(container.resolve('IWorldEntityManager'));
}

/**
 * Service interface for type safety
 */
export interface IWorldEntityManager {
  initialize(): void;
  register(entity: unknown): void;
  removeEntity(id: string): void;
  getEntitiesByType(...types: string[]): unknown[];
  processHit(targetId: string, damage: number, attackerId?: string): void;
}

export interface IPickupManager {
  initialize(scene: unknown, player: unknown): void;
  dispose(): void;
}

export interface ITickManager {
  register(tickable: unknown): void;
  unregister(id: string): void;
  tick(deltaTime: number): void;
  dispose(): void;
}
