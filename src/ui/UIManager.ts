import {
  AdvancedDynamicTexture,
  Control,
  Rectangle,
  StackPanel,
  TextBlock,
  Button,
  InputText,
  Container,
} from '@babylonjs/gui';
import { Scene, Observable } from '@babylonjs/core';
import { LobbyUI } from './LobbyUI';

export enum UIScreen {
  LOGIN = 'LOGIN',
  // MAIN_MENU removed
  LOBBY = 'LOBBY',
  PAUSE = 'PAUSE',
  NONE = 'NONE',
}

export class UIManager {
  private static instance: UIManager;
  public ui: AdvancedDynamicTexture;

  // UI Containers
  private screens: Map<UIScreen, Container> = new Map();
  private currentScreen: UIScreen = UIScreen.NONE;
  private lobbyUI: LobbyUI | null = null;

  // Visual Constants
  private readonly PRIMARY_COLOR = '#ffc400';
  private readonly BG_COLOR = 'rgba(5, 5, 10, 0.95)';
  private readonly FONT_TACTICAL = 'Rajdhani, sans-serif';
  private readonly FONT_MONO = 'Roboto Mono, monospace';

  // Observables for Menu Actions
  public onLogin = new Observable<string>();
  // onStartMultiplayer removed
  // onLogout removed
  public onResume = new Observable<void>();
  public onAbort = new Observable<void>();

  private selectedMap = 'training_ground';

  private constructor(scene: Scene) {
    this.ui = AdvancedDynamicTexture.CreateFullscreenUI('UI', true, scene);
    this.createScreens();
  }

  public static initialize(scene: Scene): UIManager {
    if (UIManager.instance) {
      UIManager.instance.dispose();
    }
    UIManager.instance = new UIManager(scene);
    return UIManager.instance;
  }

  public static getInstance(): UIManager {
    if (!UIManager.instance) {
      throw new Error('UIManager not initialized. Call initialize() first.');
    }
    return UIManager.instance;
  }

  /**
   * Returns the main UI texture for other systems (HUD, Inventory) to add controls.
   */
  public getTexture(): AdvancedDynamicTexture {
    return this.ui;
  }

  private createScreens(): void {
    this.screens.set(UIScreen.LOGIN, this.createLoginScreen());
    // MAIN_MENU removed
    this.screens.set(UIScreen.LOBBY, this.createLobbyScreen());
    this.screens.set(UIScreen.PAUSE, this.createPauseScreen());

    // Hide all initially
    this.screens.forEach((s) => (s.isVisible = false));
  }

  public showScreen(screen: UIScreen): void {
    // Hide current screen
    if (this.currentScreen !== UIScreen.NONE) {
      const prev = this.screens.get(this.currentScreen);
      if (prev) prev.isVisible = false;
    }

    this.currentScreen = screen;
    const next = this.screens.get(screen);

    if (next) {
      next.isVisible = true;
      this.exitPointerLock();
    } else if (screen === UIScreen.NONE) {
      // Game started or resumed
      this.requestPointerLock();
    }
  }

  public getSelectedMap(): string {
    return this.selectedMap;
  }

  private createLoginScreen(): Container {
    const container = new Rectangle('login-container');
    container.width = '100%';
    container.height = '100%';
    container.background = this.BG_COLOR;
    container.thickness = 0;
    this.ui.addControl(container);

    const stack = new StackPanel();
    stack.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    container.addControl(stack);

    // Logo
    const logo = new TextBlock();
    logo.text = 'ANTE APOCALYPSE';
    logo.color = 'white';
    logo.fontSize = 80;
    logo.fontFamily = this.FONT_TACTICAL;
    logo.fontWeight = '900';
    logo.height = '120px';
    stack.addControl(logo);

    const subtitle = new TextBlock();
    subtitle.text = 'ESTABLISHING_SECURE_UPLINK';
    subtitle.color = this.PRIMARY_COLOR;
    subtitle.fontSize = 14;
    subtitle.fontFamily = this.FONT_MONO;
    subtitle.height = '40px';
    subtitle.paddingBottom = '20px';
    stack.addControl(subtitle);

    // Input Group
    const input = new InputText();
    input.width = '300px';
    input.height = '45px';
    input.text = '';
    input.placeholderText = 'ENTER CALLSIGN';
    input.color = 'white';
    input.background = 'rgba(255, 255, 255, 0.05)';
    input.focusedBackground = 'rgba(255, 255, 255, 0.1)';
    input.thickness = 1;
    input.color = this.PRIMARY_COLOR;
    input.fontFamily = this.FONT_MONO;
    stack.addControl(input);

    const spacer = new Rectangle();
    spacer.height = '40px';
    spacer.thickness = 0;
    stack.addControl(spacer);

    // Button
    const btn = this.createTacticalButton('INITIALIZE', '200px', '50px');
    btn.onPointerUpObservable.add(() => {
      if (input.text) this.onLogin.notifyObservers(input.text);
    });
    stack.addControl(btn);

    return container;
  }

  private createLobbyScreen(): Container {
    if (this.lobbyUI) {
      this.lobbyUI.dispose();
    }
    this.lobbyUI = new LobbyUI();
    const container = this.lobbyUI.getContainer();
    this.ui.addControl(container);
    return container;
  }

  private createPauseScreen(): Container {
    const container = new Rectangle('pause-container');
    container.width = '100%';
    container.height = '100%';
    container.background = 'rgba(0, 0, 0, 0.8)';
    container.thickness = 0;
    this.ui.addControl(container);

    const stack = new StackPanel();
    stack.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    container.addControl(stack);

    const title = new TextBlock('pause-title');
    title.text = 'PAUSED';
    title.color = 'white';
    title.fontSize = 60;
    title.fontFamily = this.FONT_TACTICAL;
    title.height = '100px';
    stack.addControl(title);

    const resumeBtn = this.createTacticalButton('RESUME', '250px', '55px');
    resumeBtn.name = 'resume-button';
    resumeBtn.onPointerUpObservable.add(() => this.onResume.notifyObservers());
    stack.addControl(resumeBtn);

    const abortBtn = this.createTacticalButton('QUIT TO MENU', '250px', '55px');
    abortBtn.color = '#ff4d4d';
    abortBtn.paddingTop = '20px';
    abortBtn.onPointerUpObservable.add(() => this.onAbort.notifyObservers());
    stack.addControl(abortBtn);

    return container;
  }

  // UI Helpers
  private createTacticalButton(text: string, width: string, height: string): Button {
    const btn = Button.CreateSimpleButton('btn-' + text, text);
    btn.width = width;
    btn.height = height;
    btn.color = this.PRIMARY_COLOR;
    btn.background = 'transparent';
    btn.thickness = 2;
    btn.fontFamily = this.FONT_TACTICAL;
    btn.fontSize = 18;
    btn.fontWeight = '700';

    btn.onPointerEnterObservable.add(() => {
      btn.background = this.PRIMARY_COLOR;
      btn.color = 'black';
    });
    btn.onPointerOutObservable.add(() => {
      btn.background = 'transparent';
      btn.color = this.PRIMARY_COLOR;
    });

    return btn;
  }

  public setGameOverUI(isGameOver: boolean, message: string = 'MISSION_FAILED'): void {
    const pauseContainer = this.screens.get(UIScreen.PAUSE);
    if (!pauseContainer) return;

    const title = pauseContainer
      .getDescendants()
      .find((d) => d.name === 'pause-title') as TextBlock;
    if (title) {
      if (isGameOver) {
        title.text = message;
        title.color = message === 'MISSION ACCOMPLISHED!' ? '#4caf50' : '#ff4d4d'; // Green or Red
      } else {
        title.text = 'PAUSED';
        title.color = 'white';
      }
    }

    const resumeBtn = pauseContainer
      .getDescendants()
      .find((d) => d.name === 'resume-button') as Control;
    if (resumeBtn) {
      resumeBtn.isVisible = !isGameOver;
    }
  }

  public requestPointerLock(): void {
    const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
    if (canvas) {
      // In modern browsers, requestPointerLock returns a promise
      try {
        const promise = canvas.requestPointerLock() as unknown as Promise<void>;
        if (promise && promise.catch) {
          promise.catch((e: Error) => {
            if (e.name !== 'SecurityError') {
              console.warn('PointerLock request failed:', e);
            }
          });
        }
      } catch (e) {
        console.warn('PointerLock request failed (sync):', e);
      }
    }
  }

  public exitPointerLock(): void {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  public dispose(): void {
    if (this.lobbyUI) {
      this.lobbyUI.dispose();
      this.lobbyUI = null;
    }
    this.ui.dispose();
  }
}
