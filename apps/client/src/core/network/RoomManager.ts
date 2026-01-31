import { Observable } from '@babylonjs/core';
import { INetworkProvider } from './INetworkProvider';
import { RoomInfo, NetworkState } from '@ante/common';

/**
 * 룸 생성, 참가, 목록 관리를 담당하는 클래스
 */
export class RoomManager {
  private lastRoomList: RoomInfo[] = [];

  public onRoomListUpdated = new Observable<RoomInfo[]>();

  constructor(
    private provider: INetworkProvider,
    private getCurrentState: () => NetworkState
  ) {}

  /**
   * 새 룸 생성
   */
  public async createRoom(name: string, mapId: string): Promise<boolean> {
    const state = this.getCurrentState();
    if (state !== NetworkState.InLobby && state !== NetworkState.ConnectedToMaster) {
      return false;
    }

    const options = {
      maxPlayers: 20,
      customGameProperties: { mapId },
      propsListedInLobby: ['mapId'],
    };

    return this.provider.createRoom(name, options);
  }

  /**
   * 기존 룸 참가
   */
  public async joinRoom(name: string): Promise<boolean> {
    const state = this.getCurrentState();
    if (state !== NetworkState.InLobby && state !== NetworkState.ConnectedToMaster) {
      return false;
    }

    return this.provider.joinRoom(name);
  }

  /**
   * 현재 룸 떠나기
   */
  public leaveRoom(): void {
    // Stop local server if running (host leaving room)
    void import('../server/LocalServerManager').then(({ LocalServerManager }) => {
      if (LocalServerManager.getInstance().isServerRunning()) {
        LocalServerManager.getInstance().stopSession();
      }
    });
    this.provider.disconnect();
  }

  /**
   * 룸 목록 새로고침
   */
  public refreshRoomList(): void {
    this.provider.refreshRoomList?.();
  }

  /**
   * 캐시된 룸 목록 반환
   */
  public getRoomList(): RoomInfo[] {
    return this.lastRoomList;
  }

  /**
   * 룸 목록 업데이트 처리
   */
  public handleRoomListUpdate(rooms: RoomInfo[]): void {
    this.lastRoomList = rooms;
    this.onRoomListUpdated.notifyObservers(rooms);
  }

  /**
   * 현재 룸의 맵 ID 조회
   */
  public getMapId(): string | null {
    const mapId = this.provider.getCurrentRoomProperty('mapId');
    return typeof mapId === 'string' ? mapId : null;
  }

  /**
   * 마스터 클라이언트 여부 확인
   */
  public isMasterClient(): boolean {
    return this.provider.isMasterClient();
  }

  /**
   * 현재 룸의 참가자 목록 조회
   */
  public getActors(): Map<string, { id: string; name: string }> {
    return this.provider.getActors();
  }

  /**
   * 리소스 정리
   */
  public dispose(): void {
    this.onRoomListUpdated.clear();
    this.lastRoomList = [];
  }
}
