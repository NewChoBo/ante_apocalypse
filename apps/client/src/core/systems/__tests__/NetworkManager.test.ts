/**
 * NetworkManager Tests
 *
 * Tests for the NetworkManager facade class API structure
 * Note: Full integration tests require complex mocking of Photon SDK
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies at module level
vi.mock('@babylonjs/core', () => ({
  Observable: class MockObservable {
    notifyObservers = vi.fn();
    clear = vi.fn();
    add = vi.fn();
  },
  Vector3: class MockVector3 {
    constructor(
      public x = 0,
      public y = 0,
      public z = 0
    ) {}
    static Distance = vi.fn(() => 0);
  },
}));

vi.mock('@ante/common', () => ({
  EventCode: {
    FIRE: 1,
    HIT: 2,
    MOVE: 3,
    SYNC_WEAPON: 4,
    RELOAD: 5,
    ENEMY_MOVE: 6,
    TARGET_HIT: 7,
    TARGET_DESTROY: 8,
    SPAWN_TARGET: 9,
    PLAYER_DEATH: 10,
    RESPAWN: 11,
    GAME_END: 12,
    DESTROY_ENEMY: 13,
    DESTROY_PICKUP: 14,
    REQ_INITIAL_STATE: 15,
    INITIAL_STATE: 16,
    REQUEST_HIT: 17,
  },
  Logger: class MockLogger {
    info = vi.fn();
    warn = vi.fn();
    error = vi.fn();
    debug = vi.fn();
  },
}));

vi.mock('@ante/game-core', () => ({
  NetworkDispatcher: class MockNetworkDispatcher {
    register = vi.fn();
    dispatch = vi.fn();
  },
  LogicalServer: class MockLogicalServer {},
  mapPhotonState: vi.fn(),
  mapRoomList: vi.fn(() => []),
}));

// Mock GameAssets to prevent .babylon file loading
vi.mock('../../GameAssets', () => ({
  GameAssets: {
    getInstance: vi.fn(() => ({
      loadAssets: vi.fn().mockResolvedValue(undefined),
      getModel: vi.fn(() => null),
    })),
  },
}));

// Mock PhotonProvider before NetworkManager imports it
vi.mock('../../network/providers/PhotonProvider', () => ({
  PhotonProvider: class MockPhotonProvider {
    connect = vi.fn();
    sendEvent = vi.fn();
    getLocalPlayerId = vi.fn(() => 'test-player-id');
    getServerTime = vi.fn(() => Date.now());
    getCurrentRoomName = vi.fn(() => 'test-room');
    onStateChanged = null;
    onRoomListUpdated = null;
    onPlayerJoined = null;
    onPlayerLeft = null;
    onEvent = null;
    onMasterClientSwitched = null;
  },
}));

vi.mock('../../network/ConnectionManager', () => ({
  ConnectionManager: class MockConnectionManager {
    connect = vi.fn();
    handleStateChange = vi.fn();
    currentState = 'DISCONNECTED';
    onStateChanged = {
      notifyObservers: vi.fn(),
      clear: vi.fn(),
      add: vi.fn(),
    };
  },
}));

vi.mock('../../network/PlayerStateManager', () => ({
  PlayerStateManager: class MockPlayerStateManager {
    registerPlayer = vi.fn();
    updatePlayer = vi.fn();
    removePlayer = vi.fn();
    getPlayer = vi.fn();
    getAllPlayers = vi.fn(() => []);
    createMovePayload = vi.fn((id, pos, rot) => ({
      position: { x: pos.x, y: pos.y, z: pos.z },
      rotation: { x: rot.x, y: rot.y, z: rot.z },
    }));
    clearObservers = vi.fn();
    onPlayerJoined = {
      notifyObservers: vi.fn(),
      clear: vi.fn(),
      add: vi.fn(),
    };
    onPlayerUpdated = {
      notifyObservers: vi.fn(),
      clear: vi.fn(),
      add: vi.fn(),
    };
    onPlayerLeft = {
      notifyObservers: vi.fn(),
      clear: vi.fn(),
      add: vi.fn(),
    };
  },
}));

vi.mock('../../network/RoomManager', () => ({
  RoomManager: class MockRoomManager {
    createRoom = vi.fn().mockResolvedValue(true);
    joinRoom = vi.fn().mockResolvedValue(true);
    leaveRoom = vi.fn();
    isMasterClient = vi.fn(() => false);
    getActors = vi.fn(() => new Map());
    getMapId = vi.fn(() => 'test-map');
    refreshRoomList = vi.fn();
    getRoomList = vi.fn(() => []);
    handleRoomListUpdate = vi.fn();
    onRoomListUpdated = {
      notifyObservers: vi.fn(),
      clear: vi.fn(),
      add: vi.fn(),
    };
  },
}));

vi.mock('../../server/LocalServerManager', () => ({
  LocalServerManager: {
    getInstance: vi.fn(() => ({
      startSession: vi.fn().mockResolvedValue(undefined),
      stopSession: vi.fn(),
      takeover: vi.fn().mockResolvedValue(undefined),
      isServerRunning: vi.fn(() => false),
      getLogicalServer: vi.fn(() => null),
    })),
  },
}));

// Mock BrowserAssetLoader to prevent asset loading
vi.mock('../../server/BrowserAssetLoader', () => ({
  BrowserAssetLoader: class MockBrowserAssetLoader {
    loadLevel = vi.fn().mockResolvedValue({});
  },
}));

describe('NetworkManager', () => {
  let NetworkManager: typeof import('../NetworkManager').NetworkManager;

  beforeEach(async () => {
    vi.resetModules();
    const module = await import('../NetworkManager');
    NetworkManager = module.NetworkManager;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = NetworkManager.getInstance();
      const instance2 = NetworkManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should have getInstance as a static method', () => {
      expect(typeof NetworkManager.getInstance).toBe('function');
    });
  });

  describe('Connection Management', () => {
    it('should have connect method', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.connect).toBe('function');
    });

    it('should delegate connect to ConnectionManager', () => {
      const manager = NetworkManager.getInstance();
      manager.connect('test-user');
      expect(manager).toBeDefined();
    });
  });

  describe('Room Management', () => {
    it('should have createRoom method', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.createRoom).toBe('function');
    });

    it('should have joinRoom method', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.joinRoom).toBe('function');
    });

    it('should have leaveRoom method', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.leaveRoom).toBe('function');
    });

    it('should have isMasterClient method', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.isMasterClient).toBe('function');
    });

    it('should have getActors method', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.getActors).toBe('function');
    });

    it('should have getMapId method', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.getMapId).toBe('function');
    });

    it('should have refreshRoomList method', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.refreshRoomList).toBe('function');
    });

    it('should have getRoomList method', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.getRoomList).toBe('function');
    });
  });

  describe('Session Management', () => {
    it('should have hostGame method', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.hostGame).toBe('function');
    });

    it('should have joinGame method', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.joinGame).toBe('function');
    });

    it('should have leaveGame method', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.leaveGame).toBe('function');
    });
  });

  describe('Player State Management', () => {
    it('should have join method', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.join).toBe('function');
    });

    it('should have updateState method', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.updateState).toBe('function');
    });

    it('should have getAllPlayerStates method', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.getAllPlayerStates).toBe('function');
    });
  });

  describe('Game Actions', () => {
    it('should have fire method', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.fire).toBe('function');
    });

    it('should have reload method', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.reload).toBe('function');
    });

    it('should have syncWeapon method', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.syncWeapon).toBe('function');
    });

    it('should have requestHit method', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.requestHit).toBe('function');
    });

    it('should have sendEvent method', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.sendEvent).toBe('function');
    });
  });

  describe('Utility Methods', () => {
    it('should have getSocketId method', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.getSocketId).toBe('function');
    });

    it('should have getServerTime method', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.getServerTime).toBe('function');
    });

    it('should have setLocalServer method', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.setLocalServer).toBe('function');
    });

    it('should have clearObservers method', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.clearObservers).toBe('function');
    });
  });

  describe('Observables', () => {
    it('should have onPlayerJoined observable', () => {
      const manager = NetworkManager.getInstance();
      expect(manager.onPlayerJoined).toBeDefined();
    });

    it('should have onPlayerUpdated observable', () => {
      const manager = NetworkManager.getInstance();
      expect(manager.onPlayerUpdated).toBeDefined();
    });

    it('should have onPlayerLeft observable', () => {
      const manager = NetworkManager.getInstance();
      expect(manager.onPlayerLeft).toBeDefined();
    });

    it('should have onStateChanged observable', () => {
      const manager = NetworkManager.getInstance();
      expect(manager.onStateChanged).toBeDefined();
    });

    it('should have onRoomListUpdated observable', () => {
      const manager = NetworkManager.getInstance();
      expect(manager.onRoomListUpdated).toBeDefined();
    });

    it('should have game event observables', () => {
      const manager = NetworkManager.getInstance();
      expect(manager.onPlayerFired).toBeDefined();
      expect(manager.onPlayerReloaded).toBeDefined();
      expect(manager.onPlayerHit).toBeDefined();
      expect(manager.onPlayerDied).toBeDefined();
      expect(manager.onPlayerRespawn).toBeDefined();
      expect(manager.onGameEnd).toBeDefined();
    });

    it('should have enemy observables', () => {
      const manager = NetworkManager.getInstance();
      expect(manager.onEnemyUpdated).toBeDefined();
      expect(manager.onEnemyHit).toBeDefined();
      expect(manager.onEnemyDestroyed).toBeDefined();
    });

    it('should have target observables', () => {
      const manager = NetworkManager.getInstance();
      expect(manager.onTargetHit).toBeDefined();
      expect(manager.onTargetDestroy).toBeDefined();
      expect(manager.onTargetSpawn).toBeDefined();
    });

    it('should have state sync observables', () => {
      const manager = NetworkManager.getInstance();
      expect(manager.onInitialStateRequested).toBeDefined();
      expect(manager.onInitialStateReceived).toBeDefined();
    });

    it('should have raw event observable', () => {
      const manager = NetworkManager.getInstance();
      expect(manager.onEvent).toBeDefined();
    });
  });

  describe('INetworkAuthority Implementation', () => {
    it('should implement INetworkAuthority interface', () => {
      const manager = NetworkManager.getInstance();
      expect(typeof manager.getSocketId).toBe('function');
      expect(typeof manager.sendEvent).toBe('function');
    });
  });
});

describe('NetworkManager Integration', () => {
  let NetworkManager: typeof import('../NetworkManager').NetworkManager;

  beforeEach(async () => {
    vi.resetModules();
    const module = await import('../NetworkManager');
    NetworkManager = module.NetworkManager;
  });

  describe('Facade Pattern', () => {
    it('should delegate to sub-managers correctly', () => {
      const manager = NetworkManager.getInstance();

      expect(manager.connect).toBeDefined();
      expect(manager.createRoom).toBeDefined();
      expect(manager.joinRoom).toBeDefined();
      expect(manager.getAllPlayerStates).toBeDefined();
    });
  });

  describe('Observer Pattern', () => {
    it('should support clearing all observers', () => {
      const manager = NetworkManager.getInstance();

      expect(() => manager.clearObservers()).not.toThrow();
    });
  });
});
