# Network Transport Contracts Refactor

## Summary
- Introduced shared transport contracts in `packages/game-core/src/network/contracts/TransportEvent.ts`.
- Replaced `INetworkProvider` callback setters with `subscribe(handler)` and `publish(event)`.
- Split client network responsibilities:
  - `NetworkEventRouter`: transport dispatch + observable fanout.
  - `NetworkSessionService`: host/join/leave/takeover session flow.
  - `NetworkLifecycleService`: observer/provider/server cleanup order.

## Event Kind Mapping
- `request`: `MOVE`, `FIRE`, `SYNC_WEAPON`, `RELOAD`, `REQUEST_HIT`, `REQ_INITIAL_STATE`
- `authority`: state/gameplay events broadcast by authority (`HIT`, `INITIAL_STATE`, `RESPAWN`, etc.)
- `system`: lifecycle/system sync events (`JOIN`, `LEAVE`, `MAP_SYNC`, etc.)

## Provider Boundary
- Provider emits `NetworkProviderEvent` only.
- `NetworkManager` owns routing decisions:
  - master receives request events but does not double-dispatch provider-request payloads.
  - non-master request sends are normalized to `publish({ kind: 'request', ... })`.

## Lifecycle Order
- Dispose order is fixed:
  1. unsubscribe provider
  2. clear observers
  3. stop local server session
  4. dispose managers
  5. disconnect provider
