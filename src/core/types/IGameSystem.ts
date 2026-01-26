import { IDisposable } from '@babylonjs/core';

/**
 * Standard interface for all core game systems.
 * Aligns with Babylon.js IDisposable for consistent cleanup.
 */
export interface IGameSystem extends IDisposable {
  /**
   * Initializes the system with required dependencies.
   */
  initialize(): Promise<void> | void;

  /**
   * Optional tick method for systems that require per-frame updates.
   * @param deltaTime Time elapsed since last frame in seconds.
   */
  tick?(deltaTime: number): void;
}
