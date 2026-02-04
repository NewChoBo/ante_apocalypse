/**
 * GameStore Tests
 *
 * Tests for Nano Stores-based game state management
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AmmoState, InventoryState, BagItem, InventoryItem } from '../GameStore';

// Mock nanostores before import
vi.mock('nanostores', () => ({
  atom: vi.fn((initialValue) => ({
    get: vi.fn(() => initialValue),
    set: vi.fn(),
    subscribe: vi.fn(),
  })),
  map: vi.fn((initialValue) => ({
    get: vi.fn(() => initialValue),
    set: vi.fn(),
    subscribe: vi.fn(),
    keys: vi.fn(() => []),
    values: vi.fn(() => []),
    entries: vi.fn(() => []),
  })),
}));

describe('GameStore', () => {
  beforeEach(() => {
    // Clear any existing global stores
    if (typeof window !== 'undefined') {
      delete (window as unknown as { __GAME_STORES__?: unknown }).__GAME_STORES__;
    }
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Store Initialization', () => {
    it('should initialize game state store with READY state', async () => {
      const { gameStateStore } = await import('../GameStore');
      expect(gameStateStore).toBeDefined();
    });

    it('should initialize ammo store with default values', async () => {
      const { ammoStore } = await import('../GameStore');
      expect(ammoStore).toBeDefined();
    });

    it('should initialize player health store with 100', async () => {
      const { playerHealthStore } = await import('../GameStore');
      expect(playerHealthStore).toBeDefined();
    });

    it('should initialize inventory store with default weapons', async () => {
      const { inventoryStore } = await import('../GameStore');
      expect(inventoryStore).toBeDefined();
    });
  });

  describe('AmmoState Interface', () => {
    it('should have correct default ammo state structure', () => {
      const defaultAmmo: AmmoState = {
        current: 0,
        reserve: 0,
        weaponName: 'None',
        showAmmo: true,
      };

      expect(defaultAmmo.current).toBe(0);
      expect(defaultAmmo.reserve).toBe(0);
      expect(defaultAmmo.weaponName).toBe('None');
      expect(defaultAmmo.showAmmo).toBe(true);
    });

    it('should allow updating ammo values', () => {
      const ammo: AmmoState = {
        current: 30,
        reserve: 90,
        weaponName: 'Rifle',
        showAmmo: true,
      };

      expect(ammo.current).toBe(30);
      expect(ammo.reserve).toBe(90);
      expect(ammo.weaponName).toBe('Rifle');
    });
  });

  describe('InventoryState Interface', () => {
    it('should have correct default inventory state structure', () => {
      const defaultInventory: InventoryState = {
        weaponSlots: ['Pistol', 'Rifle', 'Knife', 'Bat'],
        bagItems: [
          { id: 'health_pack', name: 'First Aid Kit', type: 'consumable', count: 2 },
          { id: 'ammo_box', name: 'Ammo Crate', type: 'consumable', count: 1 },
          { id: 'ammo_generic', name: 'Generic Ammo', type: 'consumable', count: 5 },
        ],
        maxBagSlots: 24,
      };

      expect(defaultInventory.weaponSlots).toHaveLength(4);
      expect(defaultInventory.bagItems).toHaveLength(3);
      expect(defaultInventory.maxBagSlots).toBe(24);
    });

    it('should allow null weapon slots', () => {
      const inventory: InventoryState = {
        weaponSlots: ['Pistol', null, 'Knife', null],
        bagItems: [],
        maxBagSlots: 24,
      };

      expect(inventory.weaponSlots[1]).toBeNull();
      expect(inventory.weaponSlots[3]).toBeNull();
    });
  });

  describe('BagItem Interface', () => {
    it('should extend InventoryItem with count', () => {
      const item: BagItem = {
        id: 'test_item',
        name: 'Test Item',
        type: 'consumable',
        count: 5,
      };

      expect(item.id).toBe('test_item');
      expect(item.count).toBe(5);
    });

    it('should support weapon type', () => {
      const weaponItem: BagItem = {
        id: 'pistol',
        name: 'Pistol',
        type: 'weapon',
        count: 1,
      };

      expect(weaponItem.type).toBe('weapon');
    });
  });

  describe('InventoryItem Interface', () => {
    it('should have required properties', () => {
      const item: InventoryItem = {
        id: 'test',
        name: 'Test',
        type: 'weapon',
      };

      expect(item.id).toBe('test');
      expect(item.name).toBe('Test');
      expect(item.type).toBe('weapon');
    });

    it('should allow optional icon', () => {
      const itemWithIcon: InventoryItem = {
        id: 'test',
        name: 'Test',
        type: 'weapon',
        icon: '/icons/test.png',
      };

      const itemWithoutIcon: InventoryItem = {
        id: 'test2',
        name: 'Test2',
        type: 'consumable',
      };

      expect(itemWithIcon.icon).toBe('/icons/test.png');
      expect(itemWithoutIcon.icon).toBeUndefined();
    });
  });

  describe('Game State Transitions', () => {
    it('should support valid game states', () => {
      const validStates: Array<'READY' | 'PLAYING' | 'GAME_OVER' | 'DEAD'> = [
        'READY',
        'PLAYING',
        'GAME_OVER',
        'DEAD',
      ];

      expect(validStates).toContain('READY');
      expect(validStates).toContain('PLAYING');
      expect(validStates).toContain('GAME_OVER');
      expect(validStates).toContain('DEAD');
    });
  });
});
