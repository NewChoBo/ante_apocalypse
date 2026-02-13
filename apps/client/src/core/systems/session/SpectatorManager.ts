import { Vector3 } from '@babylonjs/core';
import { GameObservables } from '../../events/GameObservables';
import type { HUD } from '../../../ui/HUD';
import type { PlayerController } from '../../controllers/PlayerController';
import type { PlayerPawn } from '../../PlayerPawn';
import type { MultiplayerSystem } from '../MultiplayerSystem';

type SpectateMode = 'FREE' | 'FOLLOW';

interface SpectatorManagerDeps {
  getMultiplayerSystem: () => MultiplayerSystem | null;
  getPlayerPawn: () => PlayerPawn | null;
  getPlayerController: () => PlayerController | null;
  getHud: () => HUD | null;
  resetLocalPlayer?: (position: Vector3) => void;
  isPointerLocked?: () => boolean;
  emitPlayerDied?: () => void;
}

type WindowLike = Pick<Window, 'addEventListener' | 'removeEventListener'>;

export class SpectatorManager {
  private isSpectating = false;
  private spectateMode: SpectateMode = 'FREE';
  private spectateTargetIndex = -1;
  private cleanup: (() => void) | null = null;

  constructor(
    private readonly deps: SpectatorManagerDeps,
    private readonly windowRef: WindowLike = window
  ) {}

  public initializeInput(): void {
    if (this.cleanup) return;

    const isPointerLocked = this.deps.isPointerLocked ?? ((): boolean => Boolean(document.pointerLockElement));

    const onMouseDown = (e: MouseEvent): void => {
      if (!this.isSpectating || !isPointerLocked()) return;
      if (e.button === 0) {
        this.cycleSpectateTarget(1);
      } else if (e.button === 2) {
        this.cycleSpectateTarget(-1);
      }
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      if (!this.isSpectating) return;
      if (e.code !== 'Space' || e.repeat) return;

      this.spectateMode = this.spectateMode === 'FREE' ? 'FOLLOW' : 'FREE';
      if (this.spectateMode === 'FOLLOW') {
        this.cycleSpectateTarget(0);
      }
    };

    this.windowRef.addEventListener('mousedown', onMouseDown);
    this.windowRef.addEventListener('keydown', onKeyDown);

    this.cleanup = (): void => {
      this.windowRef.removeEventListener('mousedown', onMouseDown);
      this.windowRef.removeEventListener('keydown', onKeyDown);
    };
  }

  public onHealthChanged(health: number): void {
    if (health <= 0) {
      if (this.isSpectating) return;
      this.isSpectating = true;
      this.spectateMode = 'FREE';
      this.spectateTargetIndex = -1;
      const emitPlayerDied =
        this.deps.emitPlayerDied ??
        ((): void => {
          GameObservables.playerDied.notifyObservers(null);
        });
      emitPlayerDied();
      this.deps.getHud()?.showRespawnCountdown(3);
      return;
    }

    if (!this.isSpectating) return;

    this.isSpectating = false;
    this.spectateMode = 'FREE';
    this.spectateTargetIndex = -1;
    this.deps.getHud()?.hideRespawnMessage();
    this.deps.getPlayerController()?.setInputBlocked(false);
  }

  public onLocalRespawn(position?: { x: number; y: number; z: number }): void {
    this.isSpectating = false;
    this.spectateMode = 'FREE';
    this.spectateTargetIndex = -1;

    this.deps.getHud()?.hideRespawnMessage();
    const spawnPos = position ? new Vector3(position.x, position.y, position.z) : new Vector3(0, 2, 0);
    if (this.deps.resetLocalPlayer) {
      this.deps.resetLocalPlayer(spawnPos);
    } else {
      this.deps.getPlayerPawn()?.fullReset(spawnPos);
    }
    this.deps.getPlayerController()?.setInputBlocked(false);
  }

  public update(): void {
    if (!this.isSpectating || this.spectateMode !== 'FOLLOW') return;
    this.updateSpectatorFollow();
  }

  public dispose(): void {
    this.cleanup?.();
    this.cleanup = null;
    this.isSpectating = false;
    this.spectateMode = 'FREE';
    this.spectateTargetIndex = -1;
  }

  private updateSpectatorFollow(): void {
    const multiplayerSystem = this.deps.getMultiplayerSystem();
    const playerPawn = this.deps.getPlayerPawn();
    if (!multiplayerSystem || !playerPawn) return;

    const players = multiplayerSystem.getRemotePlayers();
    if (players.length === 0) {
      this.spectateMode = 'FREE';
      return;
    }

    if (this.spectateTargetIndex < 0 || this.spectateTargetIndex >= players.length) {
      this.spectateTargetIndex = 0;
    }

    const target = players[this.spectateTargetIndex];
    const targetPos = target.mesh.position;
    const followOffset = new Vector3(0, 2.0, -3.0);
    const desiredPos = targetPos.add(followOffset);
    playerPawn.mesh.position.copyFrom(desiredPos);
    playerPawn.camera.setTarget(targetPos);
  }

  private cycleSpectateTarget(dir: number): void {
    const multiplayerSystem = this.deps.getMultiplayerSystem();
    if (!multiplayerSystem) return;

    const players = multiplayerSystem.getRemotePlayers();
    if (players.length === 0) {
      this.spectateMode = 'FREE';
      return;
    }

    this.spectateMode = 'FOLLOW';
    this.spectateTargetIndex = (this.spectateTargetIndex + dir + players.length) % players.length;
  }
}
