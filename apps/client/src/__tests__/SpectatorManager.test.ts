import { describe, expect, it, vi } from 'vitest';
import { Vector3 } from '@babylonjs/core';
import { SpectatorManager } from '../core/systems/session/SpectatorManager';
import type { PlayerController } from '../core/controllers/PlayerController';
import type { PlayerPawn } from '../core/PlayerPawn';
import type { HUD } from '../ui/HUD';
import type { MultiplayerSystem } from '../core/systems/MultiplayerSystem';

type Listener = (event: Event) => void;

function createWindowMock(): {
  windowRef: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  emit: (type: string, event: Event) => void;
} {
  const listeners = new Map<string, Set<Listener>>();

  const windowRef: Pick<Window, 'addEventListener' | 'removeEventListener'> = {
    addEventListener: ((type: string, listener: EventListenerOrEventListenerObject): void => {
      const callback =
        typeof listener === 'function'
          ? (listener as Listener)
          : ((e: Event): void => {
              listener.handleEvent(e);
            });
      const set = listeners.get(type) ?? new Set<Listener>();
      set.add(callback);
      listeners.set(type, set);
    }) as Window['addEventListener'],
    removeEventListener: ((type: string, listener: EventListenerOrEventListenerObject): void => {
      const set = listeners.get(type);
      if (!set) return;
      if (typeof listener === 'function') {
        set.delete(listener as Listener);
      }
    }) as Window['removeEventListener'],
  };

  const emit = (type: string, event: Event): void => {
    listeners.get(type)?.forEach((listener) => listener(event));
  };

  return { windowRef, emit };
}

describe('SpectatorManager', (): void => {
  it('enters spectator on death and exits on health recovery', (): void => {
    const showRespawnCountdown = vi.fn<(seconds: number) => void>();
    const hideRespawnMessage = vi.fn<() => void>();
    const setInputBlocked = vi.fn<(blocked: boolean) => void>();
    const emitPlayerDied = vi.fn<() => void>();

    const manager = new SpectatorManager({
      getMultiplayerSystem: (): MultiplayerSystem | null => null,
      getPlayerPawn: (): PlayerPawn | null => null,
      getPlayerController: (): PlayerController => ({ setInputBlocked } as unknown as PlayerController),
      getHud: (): HUD =>
        ({
          showRespawnCountdown,
          hideRespawnMessage,
        } as unknown as HUD),
      emitPlayerDied,
    });

    manager.onHealthChanged(0);
    expect(emitPlayerDied).toHaveBeenCalledTimes(1);
    expect(showRespawnCountdown).toHaveBeenCalledWith(3);

    manager.onHealthChanged(100);
    expect(hideRespawnMessage).toHaveBeenCalledTimes(1);
    expect(setInputBlocked).toHaveBeenCalledWith(false);
  });

  it('resets player on local respawn', (): void => {
    const fullReset = vi.fn<(position: Vector3) => void>();
    const hideRespawnMessage = vi.fn<() => void>();
    const setInputBlocked = vi.fn<(blocked: boolean) => void>();

    const manager = new SpectatorManager({
      getMultiplayerSystem: (): MultiplayerSystem | null => null,
      getPlayerPawn: (): PlayerPawn =>
        ({
          fullReset,
        } as unknown as PlayerPawn),
      getPlayerController: (): PlayerController => ({ setInputBlocked } as unknown as PlayerController),
      getHud: (): HUD =>
        ({
          hideRespawnMessage,
        } as unknown as HUD),
    });

    manager.onLocalRespawn({ x: 1, y: 2, z: 3 });

    expect(fullReset).toHaveBeenCalledTimes(1);
    expect(fullReset.mock.calls[0][0]).toMatchObject({ x: 1, y: 2, z: 3 });
    expect(hideRespawnMessage).toHaveBeenCalledTimes(1);
    expect(setInputBlocked).toHaveBeenCalledWith(false);
  });

  it('follows remote target in spectator follow mode', (): void => {
    const { windowRef, emit } = createWindowMock();

    const copyFrom = vi.fn<(position: Vector3) => void>();
    const setTarget = vi.fn<(position: Vector3) => void>();
    const remotePosition = new Vector3(10, 1, 4);

    const manager = new SpectatorManager(
      {
        getMultiplayerSystem: (): MultiplayerSystem =>
          ({
            getRemotePlayers: (): Array<{ mesh: { position: Vector3 } }> =>
              [
                {
                  mesh: {
                    position: remotePosition,
                  },
                },
              ],
          } as unknown as MultiplayerSystem),
        getPlayerPawn: (): PlayerPawn =>
          ({
            mesh: { position: { copyFrom } },
            camera: { setTarget },
          } as unknown as PlayerPawn),
        getPlayerController: (): PlayerController | null => null,
        getHud: (): HUD | null => null,
        isPointerLocked: (): boolean => true,
        emitPlayerDied: (): void => undefined,
      },
      windowRef
    );

    manager.initializeInput();
    manager.onHealthChanged(0);
    emit('keydown', { code: 'Space', repeat: false } as KeyboardEvent as unknown as Event);
    manager.update();

    expect(copyFrom).toHaveBeenCalledTimes(1);
    expect(setTarget).toHaveBeenCalledTimes(1);
    expect(copyFrom.mock.calls[0][0]).toMatchObject({ x: 10, y: 3, z: 1 });
    expect(setTarget.mock.calls[0][0]).toBe(remotePosition);
  });
});
