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
import { NetworkManager } from '../core/systems/NetworkManager';
import { NetworkState } from '@ante/common';

type TacticalButton = Button & { _updateStyles?: () => void };

export enum UIScreen {
  LOGIN = 'LOGIN',
  MAIN_MENU = 'MAIN_MENU',
  LOBBY = 'LOBBY',
  PAUSE = 'PAUSE',
  NONE = 'NONE',
}

export class UIManager {
  private static instance: UIManager;
  public ui: AdvancedDynamicTexture;

  // UI Containers
  private screens: Map<UIScreen, Container> = new Map();
  public currentScreen: UIScreen = UIScreen.NONE;
  private lobbyUI: LobbyUI | null = null;

  // Visual Constants
  private readonly PRIMARY_COLOR = '#ffc400';
  private readonly BG_COLOR = 'rgba(5, 5, 10, 0.95)';
  private readonly FONT_TACTICAL = 'Rajdhani, sans-serif';
  private readonly FONT_MONO = 'Roboto Mono, monospace';

  // Observables for Menu Actions
  public onLogin = new Observable<string>();
  public onStartMultiplayer = new Observable<void>();
  public onLogout = new Observable<void>();
  public onResume = new Observable<void>();
  public onAbort = new Observable<void>();

  private selectedMap = 'training_ground';

  private constructor(scene: Scene) {
    this.ui = AdvancedDynamicTexture.CreateFullscreenUI('UI', true, scene);
    this.createScreens();
    this.setupNetworkListeners();
  }

  private setupNetworkListeners(): void {
    const network = NetworkManager.getInstance();
    network.onStateChanged.add((state) => {
      if (state === NetworkState.Disconnected || state === NetworkState.Error) {
        this.showNotification('COMMUNICATION_LINK_LOST - ATTEMPTING_RECONNECT');
      } else if (state === NetworkState.ConnectedToMaster || state === NetworkState.InLobby) {
        this.showNotification('UPLINK_ESTABLISHED');
      }
    });
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
    this.screens.set(UIScreen.MAIN_MENU, this.createMainMenuScreen());
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

  private createMainMenuScreen(): Container {
    const container = new Rectangle('main-menu-container');
    container.width = '100%';
    container.height = '100%';
    container.background = this.BG_COLOR;
    container.thickness = 0;
    this.ui.addControl(container);

    const content = new Rectangle();
    content.width = '600px';
    content.height = '100%';
    content.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    content.left = '10%';
    content.thickness = 0;
    container.addControl(content);

    const stack = new StackPanel();
    stack.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    stack.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    content.addControl(stack);

    const logoSmall = new TextBlock();
    logoSmall.text = 'ANTE APOCALYPSE';
    logoSmall.color = 'rgba(255, 255, 255, 0.5)';
    logoSmall.fontSize = 32;
    logoSmall.fontFamily = this.FONT_TACTICAL;
    logoSmall.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    logoSmall.height = '100px';
    logoSmall.paddingBottom = '40px';
    stack.addControl(logoSmall);

    /* [REMOVED] Singleplayer Button */

    const multiBtn = this.createMenuButton('DEPLOY_OP.EXE', 'ESTABLISH_UPLINK');
    multiBtn.onPointerUpObservable.add(() => this.onStartMultiplayer.notifyObservers());
    stack.addControl(multiBtn);

    const mapLabel = new TextBlock();
    mapLabel.text = 'SELECT_DEPLOYMENT_ZONE:';
    mapLabel.color = this.PRIMARY_COLOR;
    mapLabel.fontSize = 12;
    mapLabel.fontFamily = this.FONT_MONO;
    mapLabel.height = '40px';
    mapLabel.paddingTop = '20px';
    mapLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(mapLabel);

    const mapGrid = new StackPanel('map-selector');
    mapGrid.isVertical = false;
    mapGrid.height = '60px';
    mapGrid.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    stack.addControl(mapGrid);

    const mapButtons: TacticalButton[] = [];

    const createMapBtn = (id: string, label: string) => {
      const btn = Button.CreateSimpleButton('map-btn-' + id, label);
      btn.width = '150px';
      btn.height = '40px';
      btn.fontFamily = this.FONT_MONO;
      btn.fontSize = 12;
      btn.thickness = 1;
      btn.paddingRight = '10px';

      const updateStyles = () => {
        const isSelected = this.selectedMap === id;
        btn.color = isSelected ? 'black' : 'white';
        btn.background = isSelected ? this.PRIMARY_COLOR : 'rgba(255,255,255,0.05)';
        btn.alpha = isSelected ? 1 : 0.6;
      };

      updateStyles();

      btn.onPointerUpObservable.add(() => {
        this.selectedMap = id;
        mapButtons.forEach((b) => b._updateStyles?.());
      });

      (btn as TacticalButton)._updateStyles = updateStyles;
      mapButtons.push(btn as TacticalButton);
      return btn;
    };

    mapGrid.addControl(createMapBtn('training_ground', 'TRAINING_GD'));
    mapGrid.addControl(createMapBtn('combat_zone', 'COMBAT_ZONE'));

    const spacer = new Rectangle();
    spacer.height = '40px';
    spacer.thickness = 0;
    stack.addControl(spacer);

    const logoutBtn = this.createTacticalButton('TERMINATE_SESSION', '250px', '40px');
    logoutBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    logoutBtn.onPointerUpObservable.add(() => this.onLogout.notifyObservers());
    stack.addControl(logoutBtn);

    return container;
  }

  private createLobbyScreen(): Container {
    this.lobbyUI = new LobbyUI(this);
    const container = this.lobbyUI.getContainer();
    this.ui.addControl(container);
    return container;
  }

  private createPauseScreen(): Container {
    const container = new Rectangle('pause-container');
    container.width = '100%';
    container.height = '100%';
    container.background = 'rgba(0, 0, 0, 0.7)';
    container.thickness = 0;
    this.ui.addControl(container);

    const stack = new StackPanel();
    stack.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    container.addControl(stack);

    const title = new TextBlock();
    title.text = 'PAUSED';
    title.color = 'white';
    title.fontSize = 48;
    title.fontFamily = this.FONT_TACTICAL;
    title.fontWeight = '800';
    title.height = '80px';
    stack.addControl(title);

    const resumeBtn = this.createTacticalButton('RESUME OPERATIONS', '300px', '50px');
    resumeBtn.onPointerUpObservable.add(() => this.onResume.notifyObservers());
    stack.addControl(resumeBtn);

    const spacer = new Rectangle();
    spacer.height = '20px';
    spacer.thickness = 0;
    stack.addControl(spacer);

    const abortBtn = this.createTacticalButton('ABORT MISSION', '300px', '50px');
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

  private createMenuButton(title: string, sub: string): Button {
    const btn = Button.CreateSimpleButton('menu-btn-' + title, '');
    btn.width = '450px';
    btn.height = '100px';
    btn.background = 'rgba(255, 255, 255, 0.03)';
    btn.thickness = 1;
    btn.color = 'rgba(255, 255, 255, 0.1)';
    btn.paddingBottom = '15px';
    btn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;

    const stack = new StackPanel();
    stack.isHitTestVisible = false;
    btn.addControl(stack);

    const titleText = new TextBlock();
    titleText.text = title;
    titleText.color = 'white';
    titleText.fontSize = 24;
    titleText.fontFamily = this.FONT_TACTICAL;
    titleText.fontWeight = '700';
    titleText.height = '40px';
    titleText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    titleText.paddingLeft = '30px';
    stack.addControl(titleText);

    const subText = new TextBlock();
    subText.text = sub;
    subText.color = 'rgba(255, 255, 255, 0.4)';
    subText.fontSize = 11;
    subText.fontFamily = this.FONT_MONO;
    subText.height = '20px';
    subText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    subText.paddingLeft = '30px';
    stack.addControl(subText);

    btn.onPointerEnterObservable.add(() => {
      btn.background = 'rgba(255, 255, 255, 0.08)';
      btn.color = this.PRIMARY_COLOR;
      btn.left = '10px';
    });
    btn.onPointerOutObservable.add(() => {
      btn.background = 'rgba(255, 255, 255, 0.03)';
      btn.color = 'rgba(255, 255, 255, 0.1)';
      btn.left = '0px';
    });

    return btn;
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

  public showNotification(message: string): void {
    const notification = new Rectangle('notification');
    notification.width = '400px';
    notification.height = '60px';
    notification.background = this.BG_COLOR;
    notification.color = this.PRIMARY_COLOR;
    notification.thickness = 2;
    notification.cornerRadius = 5;
    notification.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    notification.top = '40px';
    this.ui.addControl(notification);

    const text = new TextBlock();
    text.text = message;
    text.color = 'white';
    text.fontSize = 16;
    text.fontFamily = this.FONT_MONO;
    notification.addControl(text);

    // Fade out and remove
    let alpha = 1;
    const interval = setInterval(() => {
      alpha -= 0.05;
      if (alpha <= 0) {
        notification.dispose();
        clearInterval(interval);
      } else {
        notification.alpha = alpha;
      }
    }, 150);
  }

  public dispose(): void {
    this.ui.dispose();
  }
}
