import { Vector3 } from '@babylonjs/core';
import { PlayerData } from '../../shared/protocol/NetworkProtocol';

export interface Snapshot {
  timestamp: number;
  players: Map<string, PlayerData>;
}

export class NetworkInterpolation {
  private static readonly INTERPOLATION_OFFSET = 40; // 40ms delay for snappier response at 128Hz
  private snapshots: Snapshot[] = [];

  public addSnapshot(timestamp: number, players: PlayerData[]): void {
    const playerMap = new Map<string, PlayerData>();
    players.forEach((p) => playerMap.set(p.id, p));

    this.snapshots.push({ timestamp, players: playerMap });

    // Keep buffer size reasonable (e.g., 1 second worth of snapshots)
    if (this.snapshots.length > 20) {
      this.snapshots.shift();
    }
  }

  public getInterpolatedState(now: number): Map<string, PlayerData> | null {
    // Render time is in the past
    const renderTime = now - NetworkInterpolation.INTERPOLATION_OFFSET;

    // 1. Find the two snapshots surrounding renderTime
    let from: Snapshot | null = null;
    let to: Snapshot | null = null;

    for (let i = this.snapshots.length - 1; i >= 0; i--) {
      if (this.snapshots[i].timestamp <= renderTime) {
        from = this.snapshots[i];
        to = this.snapshots[i + 1] || null; // The one immediately after 'from'
        break;
      }
    }

    // 2. Interpolate
    if (!from) {
      // Not enough history, or just started? Return latest if available, or null
      return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1].players : null;
    }

    if (!to) {
      // We are ahead of the latest snapshot (lagging network?), extrapolate or clamp to latest
      return from.players;
    }

    const alpha = (renderTime - from.timestamp) / (to.timestamp - from.timestamp);
    return this.interpolateSnapshots(from, to, alpha);
  }

  private interpolateSnapshots(
    from: Snapshot,
    to: Snapshot,
    alpha: number
  ): Map<string, PlayerData> {
    const result = new Map<string, PlayerData>();

    from.players.forEach((fromState, id) => {
      const toState = to.players.get(id);
      if (
        toState &&
        fromState.position &&
        toState.position &&
        fromState.rotation &&
        toState.rotation
      ) {
        // Interpolate
        const pos = Vector3.Lerp(
          new Vector3(fromState.position.x, fromState.position.y, fromState.position.z),
          new Vector3(toState.position.x, toState.position.y, toState.position.z),
          alpha
        );

        // Simple Euler Lerp
        const rX = fromState.rotation.x + (toState.rotation.x - fromState.rotation.x) * alpha;
        const rY = fromState.rotation.y + (toState.rotation.y - fromState.rotation.y) * alpha;
        const rZ = fromState.rotation.z + (toState.rotation.z - fromState.rotation.z) * alpha;

        result.set(id, {
          ...toState, // Copy other props (weapon, etc) from target
          position: { x: pos.x, y: pos.y, z: pos.z },
          rotation: { x: rX, y: rY, z: rZ },
        });
      } else if (toState) {
        // Missing pos/rot in one of them? Just snap to target
        result.set(id, toState);
      }
    });

    // Handle players present in 'to' but not 'from' (Spawned)
    to.players.forEach((toState, id) => {
      if (!from.players.has(id)) {
        result.set(id, toState); // Snap to new pos
      }
    });

    return result;
  }
}
