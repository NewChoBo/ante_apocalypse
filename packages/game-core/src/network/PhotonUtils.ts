// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import Photon from 'photon-realtime';
import { NetworkState } from '@ante/common';

/**
 * Maps Photon internal state numbers to NetworkState enum.
 */
export function mapPhotonState(photonState: number): NetworkState {
  const States = (Photon as any).LoadBalancing.LoadBalancingClient.State;
  switch (photonState) {
    case States.Uninitialized:
    case States.Disconnected:
      return NetworkState.Disconnected;
    case States.ConnectingToNameServer:
    case States.ConnectingToMasterserver:
    case States.ConnectingToGameserver:
      return NetworkState.Connecting;
    case States.ConnectedToNameServer:
    case States.ConnectedToMaster:
      return NetworkState.ConnectedToMaster;
    case States.JoinedLobby:
      return NetworkState.InLobby;
    case States.Joined:
      return NetworkState.InRoom;
    case States.Error:
      return NetworkState.Error;
    default:
      return NetworkState.Connecting;
  }
}

/**
 * Converts a Photon room list to RoomInfo array.
 */
export function mapRoomList(
  rooms: any[]
): {
  id: string;
  name: string;
  playerCount: number;
  maxPlayers: number;
  isOpen: boolean;
  customProperties: any;
}[] {
  return rooms.map((r: any) => ({
    id: r.name,
    name: r.name,
    playerCount: r.playerCount,
    maxPlayers: r.maxPlayers,
    isOpen: r.isOpen,
    customProperties: r.getCustomProperties ? r.getCustomProperties() : {},
  }));
}
