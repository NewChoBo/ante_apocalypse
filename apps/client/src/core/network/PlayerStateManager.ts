import { Observable, Vector3 } from '@babylonjs/core';
import { PlayerState } from '@ante/common';

/**
 * 플레이어 상태(위치, 회전, 무기 등) 관리를 담당하는 클래스
 */
export class PlayerStateManager {
  private players: Map<string, PlayerState> = new Map();

  public onPlayerJoined = new Observable<PlayerState>();
  public onPlayerUpdated = new Observable<PlayerState>();
  public onPlayerLeft = new Observable<string>();

  /**
   * 새 플레이어 등록 (로컬 플레이어 포함)
   */
  public registerPlayer(state: PlayerState): void {
    this.players.set(state.id, state);
    this.onPlayerJoined.notifyObservers(state);
  }

  /**
   * 플레이어 상태 업데이트
   */
  public updatePlayer(
    id: string,
    updates: Partial<Pick<PlayerState, 'position' | 'rotation' | 'weaponId' | 'health'>>
  ): void {
    const player = this.players.get(id);
    if (player) {
      if (updates.position) player.position = updates.position;
      if (updates.rotation) player.rotation = updates.rotation;
      if (updates.weaponId !== undefined) player.weaponId = updates.weaponId;
      if (updates.health !== undefined) player.health = updates.health;
      this.onPlayerUpdated.notifyObservers(player);
    }
  }

  /**
   * 플레이어 제거
   */
  public removePlayer(id: string): void {
    this.players.delete(id);
    this.onPlayerLeft.notifyObservers(id);
  }

  /**
   * 특정 플레이어 조회
   */
  public getPlayer(id: string): PlayerState | undefined {
    return this.players.get(id);
  }

  /**
   * 모든 플레이어 조회
   */
  public getAllPlayers(): PlayerState[] {
    return Array.from(this.players.values());
  }

  /**
   * 로컬 플레이어 상태 업데이트 (네트워크 전송용 데이터 생성)
   */
  public createMovePayload(
    localId: string,
    position: Vector3,
    rotation: Vector3
  ): {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
  } {
    const player = this.players.get(localId);
    if (player) {
      player.position = { x: position.x, y: position.y, z: position.z };
      player.rotation = { x: rotation.x, y: rotation.y, z: rotation.z };
    }

    return {
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z },
    };
  }

  /**
   * Observable 정리
   */
  public clearObservers(): void {
    this.onPlayerJoined.clear();
    this.onPlayerUpdated.clear();
    this.onPlayerLeft.clear();
  }

  /**
   * 리소스 정리
   */
  public dispose(): void {
    this.clearObservers();
    this.players.clear();
  }
}
