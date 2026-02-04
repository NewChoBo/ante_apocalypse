import { describe, it, expect, beforeEach } from 'vitest';
import { DIContainer, DI_TOKENS } from '../DIContainer';

describe('DIContainer', () => {
  let container: DIContainer;

  beforeEach(() => {
    container = DIContainer.getInstance();
    container.clear();
  });

  describe('register', () => {
    it('should register a service', () => {
      const mockService = { name: 'TestService' };
      container.register('TestService', mockService);

      expect(container.has('TestService')).toBe(true);
    });

    it('should register multiple services', () => {
      container.register('Service1', { id: 1 });
      container.register('Service2', { id: 2 });

      expect(container.has('Service1')).toBe(true);
      expect(container.has('Service2')).toBe(true);
    });

    it('should override existing service', () => {
      container.register('Service', { version: 1 });
      container.register('Service', { version: 2 });

      const service = container.resolve<{ version: number }>('Service');
      expect(service.version).toBe(2);
    });
  });

  describe('registerFactory', () => {
    it('should register a factory', () => {
      let instanceCount = 0;
      container.registerFactory('FactoryService', () => {
        instanceCount++;
        return { id: instanceCount };
      });

      const instance1 = container.resolve<{ id: number }>('FactoryService');
      const instance2 = container.resolve<{ id: number }>('FactoryService');

      expect(instance1.id).not.toBe(instance2.id);
      expect(instance1.id).toBe(1);
      expect(instance2.id).toBe(2);
    });
  });

  describe('resolve', () => {
    it('should resolve registered service', () => {
      const mockService = { name: 'TestService', value: 42 };
      container.register('TestService', mockService);

      const resolved = container.resolve<typeof mockService>('TestService');

      expect(resolved.name).toBe('TestService');
      expect(resolved.value).toBe(42);
    });

    it('should throw error for unregistered service', () => {
      expect(() => container.resolve('Unregistered')).toThrow(
        "Service 'Unregistered' not found in DI container"
      );
    });

    it('should use factory when registered', () => {
      container.registerFactory('FactoryService', () => ({ created: true }));

      const resolved = container.resolve<{ created: boolean }>('FactoryService');

      expect(resolved.created).toBe(true);
    });
  });

  describe('has', () => {
    it('should return true for registered service', () => {
      container.register('Service', {});
      expect(container.has('Service')).toBe(true);
    });

    it('should return true for registered factory', () => {
      container.registerFactory('Factory', () => ({}));
      expect(container.has('Factory')).toBe(true);
    });

    it('should return false for unregistered service', () => {
      expect(container.has('Unregistered')).toBe(false);
    });
  });

  describe('unregister', () => {
    it('should unregister a service', () => {
      container.register('Service', {});
      container.unregister('Service');

      expect(container.has('Service')).toBe(false);
    });

    it('should throw error after unregistering', () => {
      container.register('Service', {});
      container.unregister('Service');

      expect(() => container.resolve('Service')).toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all services', () => {
      container.register('Service1', {});
      container.register('Service2', {});
      container.registerFactory('Factory', () => ({}));

      container.clear();

      expect(container.has('Service1')).toBe(false);
      expect(container.has('Service2')).toBe(false);
      expect(container.has('Factory')).toBe(false);
    });
  });

  describe('debugInfo', () => {
    it('should return debug information', () => {
      container.register('Service1', {});
      container.registerFactory('Factory1', () => ({}));

      const info = container.debugInfo();

      expect(info.services).toContain('Service1');
      expect(info.factories).toContain('Factory1');
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = DIContainer.getInstance();
      const instance2 = DIContainer.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});

describe('DI_TOKENS', () => {
  it('should have all required tokens', () => {
    expect(DI_TOKENS.NETWORK_MANAGER).toBe('NetworkManager');
    expect(DI_TOKENS.GLOBAL_INPUT_MANAGER).toBe('GlobalInputManager');
    expect(DI_TOKENS.TICK_MANAGER).toBe('TickManager');
    expect(DI_TOKENS.WORLD_ENTITY_MANAGER).toBe('WorldEntityManager');
    expect(DI_TOKENS.PICKUP_MANAGER).toBe('PickupManager');
    expect(DI_TOKENS.UI_MANAGER).toBe('UIManager');
    expect(DI_TOKENS.GAME_STORE).toBe('GameStore');
    expect(DI_TOKENS.SETTINGS_STORE).toBe('SettingsStore');
  });
});
