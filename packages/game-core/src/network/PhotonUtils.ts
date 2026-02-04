import Photon from 'photon-realtime';
import { NetworkState } from '@ante/common';

/**
 * Maps Photon internal state numbers to NetworkState enum.
 */
export function mapPhotonState(photonState: number): NetworkState {
  // Access static property dynamically to avoid import issues
  const LoadBalancingClient = (
    Photon as unknown as { LoadBalancing: { LoadBalancingClient: { State: any } } }
  ).LoadBalancing.LoadBalancingClient;
  const States = LoadBalancingClient.State;
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
interface PhotonRoomInternal {
  name: string;
  playerCount: number;
  maxPlayers: number;
  isOpen: boolean;
  getCustomProperties?(): Record<string, unknown>;
}

export function mapRoomList(rooms: unknown[]): {
  id: string;
  name: string;
  playerCount: number;
  maxPlayers: number;
  isOpen: boolean;
  customProperties: Record<string, unknown>;
}[] {
  return (rooms as PhotonRoomInternal[]).map((r) => ({
    id: r.name,
    name: r.name,
    playerCount: r.playerCount,
    maxPlayers: r.maxPlayers,
    isOpen: r.isOpen,
    customProperties: typeof r.getCustomProperties === 'function' ? r.getCustomProperties() : {},
  }));
}
