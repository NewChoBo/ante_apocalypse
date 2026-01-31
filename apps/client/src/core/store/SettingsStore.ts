import { map } from 'nanostores';
import { Logger } from '@ante/common';

const logger = new Logger('SettingsStore');

export interface SettingsState {
  masterVolume: number;
  mouseSensitivity: number;
}

const STORAGE_KEY = 'ante_apocalypse_settings';

// Default settings
const DEFAULT_SETTINGS: SettingsState = {
  masterVolume: 1.0,
  mouseSensitivity: 0.002,
};

function loadSettings(): SettingsState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    logger.warn('Failed to load settings from localStorage', e);
  }
  return DEFAULT_SETTINGS;
}

export const settingsStore = map<SettingsState>(loadSettings());

// Subscribe and persist
settingsStore.subscribe((state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    logger.warn('Failed to save settings to localStorage', e);
  }
});
