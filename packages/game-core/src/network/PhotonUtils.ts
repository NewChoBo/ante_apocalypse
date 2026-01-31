// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import Photon from 'photon-realtime';
import { NetworkState } from '@ante/common';

/**
 * Maps Photon internal state numbers to NetworkState enum.
 */
export function mapPhotonState(photonState: number): NetworkState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
export function mapRoomList(rooms: unknown[]): {
  id: string;
  name: string;
  playerCount: number;
  maxPlayers: number;
  isOpen: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customProperties: any;
}[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rooms.map((r: any) => ({
    id: (r as any).name,
    name: (r as any).name,
    playerCount: (r as any).playerCount,
    maxPlayers: (r as any).maxPlayers,
    isOpen: (r as any).isOpen,
    customProperties: (r as any).getCustomProperties ? (r as any).getCustomProperties() : {},
  }));
}
