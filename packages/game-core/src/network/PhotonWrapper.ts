import PhotonModule from 'photon-realtime';

export const Photon = PhotonModule as any;

export const LoadBalancing = Photon.LoadBalancing;
export const ConnectionProtocol = Photon.ConnectionProtocol;

// 상수 등 필요한 부분 추가 export
export const ReceiverGroup = Photon.LoadBalancing.Constants.ReceiverGroup;
