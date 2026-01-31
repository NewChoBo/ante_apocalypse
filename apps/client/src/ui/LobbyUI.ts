import {
  Container,
  StackPanel,
  Rectangle,
  TextBlock,
  ScrollViewer,
  Control,
  Button,
  Checkbox,
  InputText,
} from '@babylonjs/gui';
import { Observer } from '@babylonjs/core';
import { NetworkManager } from '../core/systems/NetworkManager';
import { UIManager, UIScreen } from './UIManager';
import { RoomInfo } from '@ante/common';
import { LocalServerManager } from '../core/server/LocalServerManager';
import { Logger } from '@ante/common';

const logger = new Logger('LobbyUI');

export class LobbyUI {
  private container: Container;
  private roomListPanel: StackPanel;
  private networkManager: NetworkManager;
  private uiManager: UIManager;
  private observers: Observer<any>[] = [];

  // Visual Constants from UIManager (for consistency)
  private readonly PRIMARY_COLOR = '#ffc400';
  private readonly BG_COLOR = 'rgba(5, 5, 10, 0.95)';
  private readonly FONT_TACTICAL = 'Rajdhani, sans-serif';
  private readonly FONT_MONO = 'Roboto Mono, monospace';

  constructor(uiManager: UIManager) {
    this.uiManager = uiManager;
    this.networkManager = NetworkManager.getInstance();
    this.container = this.createContainer();
    this.roomListPanel = this.container
      .getDescendants()
      .find((d) => d.name === 'room-list') as StackPanel;

    this.setupListeners();
  }

  public dispose(): void {
    this.observers.forEach((obs) => {
      this.networkManager.onRoomListUpdated.remove(obs);
      this.networkManager.onStateChanged.remove(obs);
    });
    this.observers = [];
    this.container.dispose();
  }

  public getContainer(): Container {
    return this.container;
  }

  private createContainer(): Container {
    const container = new Rectangle('lobby-container-inner');
    container.width = '100%';
    container.height = '100%';
    container.background = this.BG_COLOR;
    container.thickness = 0;

    const content = new Rectangle();
    content.width = '800px';
    content.height = '90%';
    content.thickness = 0;
    container.addControl(content);

    const header = new TextBlock();
    header.text = 'JOINT_OPERATIONS_CENTER';
    header.color = this.PRIMARY_COLOR;
    header.fontSize = 32;
    header.fontFamily = this.FONT_TACTICAL;
    header.fontWeight = '700';
    header.height = '60px';
    header.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    header.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    header.top = '20px';
    content.addControl(header);

    const subHeader = new TextBlock();
    subHeader.text = 'AVAILABLE_SQUAD_CHANNELS';
    subHeader.color = 'rgba(255, 255, 255, 0.4)';
    subHeader.fontSize = 12;
    subHeader.fontFamily = this.FONT_MONO;
    subHeader.height = '20px';
    subHeader.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    subHeader.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    subHeader.top = '80px';
    content.addControl(subHeader);

    // Scroll Viewer for Room List
    const viewer = new ScrollViewer('room-viewer');
    viewer.width = '100%';
    viewer.height = '60%';
    viewer.top = '120px';
    viewer.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    viewer.thickness = 1;
    viewer.color = 'rgba(255, 255, 255, 0.1)';
    content.addControl(viewer);

    const roomList = new StackPanel('room-list');
    roomList.width = '100%';
    roomList.spacing = 10;
    viewer.addControl(roomList);

    // Controls at the bottom
    const bottomControls = new StackPanel('lobby-controls');
    bottomControls.isVertical = false;
    bottomControls.height = '60px';
    bottomControls.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    bottomControls.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    bottomControls.top = '-40px';
    content.addControl(bottomControls);

    // Create Refresh Button
    const refreshBtn = this.createButton('REFRESH_UI', '150px');
    refreshBtn.paddingLeft = '20px';
    refreshBtn.onPointerUpObservable.add(() => {
      this.networkManager.refreshRoomList();
      // Also update from cache immediately if available (in case refresh doesn't trigger event)
      this.updateRoomList(this.networkManager.getRoomList());
    });

    bottomControls.addControl(refreshBtn);

    // Create Room Button
    const createBtn = this.createButton('CREATE_SQUAD', '150px');
    createBtn.paddingLeft = '20px';
    createBtn.onPointerUpObservable.add(() => {
      this.showCreateRoomModal();
    });
    bottomControls.addControl(createBtn);

    // Return button
    const backBtn = this.createButton('RETURN_TO_BASE', '200px');
    backBtn.color = '#ff4d4d';
    backBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    backBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    backBtn.top = '-40px';
    backBtn.onPointerUpObservable.add(() => {
      LocalServerManager.getInstance().stopSession(); // Ensure local server stops if we leave lobby
      this.uiManager.showScreen(UIScreen.MAIN_MENU);
    });
    content.addControl(backBtn);

    return container;
  }

  private setupListeners(): void {
    const roomListObserver = this.networkManager.onRoomListUpdated.add((rooms) => {
      this.updateRoomList(rooms);
    });
    if (roomListObserver) this.observers.push(roomListObserver);

    const stateObserver = this.networkManager.onStateChanged.add((state) => {
      this.handleStateChange(state);
    });
    if (stateObserver) this.observers.push(stateObserver);

    // Initial fetch from cache
    this.updateRoomList(this.networkManager.getRoomList());
    this.handleStateChange(this.networkManager.currentState); // Use current state
  }

  private handleStateChange(state: string): void {
    // Safety check: if UI is disposed or not attached, don't update
    if (!this.container || !this.container.host) return;

    const isDisconnected = state === 'Disconnected' || state === 'Error' || state === 'Connecting';

    // Find Join buttons and Create button to disable them
    this.container.getDescendants().forEach((control) => {
      if (control instanceof Button) {
        if (
          control.name?.startsWith('join-') ||
          control.name === 'btn-CREATE_SQUAD' ||
          control.name === 'btn-REFRESH_UI'
        ) {
          control.isEnabled = !isDisconnected;
          control.alpha = isDisconnected ? 0.3 : 1.0;
        }
      }
    });

    // Show reconnecting message if needed
    let messageBox = this.container
      .getDescendants()
      .find((d) => d.name === 'network-status-msg') as TextBlock;
    if (isDisconnected) {
      if (this.container && this.container.host) {
        if (!messageBox) {
          messageBox = new TextBlock('network-status-msg');
          messageBox.color = '#ff4d4d';
          messageBox.fontSize = 14;
          messageBox.fontFamily = this.FONT_MONO;
          messageBox.height = '30px';
          messageBox.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
          messageBox.top = '50px';
          this.container.addControl(messageBox);
        }
        messageBox.text =
          state === 'Connecting' ? 'ESTABLISHING_UPLINK...' : 'OFFLINE_MODE - ATTEMPTING_RECONNECT';
        messageBox.isVisible = true;
      }
    } else if (messageBox) {
      messageBox.isVisible = false;
    }
  }

  private updateRoomList(rooms: RoomInfo[]): void {
    this.roomListPanel.clearControls();

    if (rooms.length === 0) {
      const emptyMsg = new TextBlock();
      emptyMsg.text = 'NO_ACTIVE_SESSIONS_FOUND';
      emptyMsg.color = 'rgba(255, 255, 255, 0.2)';
      emptyMsg.fontSize = 14;
      emptyMsg.fontFamily = this.FONT_MONO;
      emptyMsg.height = '100px';
      this.roomListPanel.addControl(emptyMsg);
      return;
    }

    rooms.forEach((room) => {
      const row = this.createRoomRow(room);
      this.roomListPanel.addControl(row);
    });
  }

  private createRoomRow(room: RoomInfo): Container {
    const rect = new Rectangle();
    rect.width = '100%';
    rect.height = '60px';
    rect.background = 'rgba(255, 255, 255, 0.03)';
    rect.thickness = 1;
    rect.color = 'rgba(255, 255, 255, 0.1)';

    const stack = new StackPanel();
    stack.isVertical = false;
    rect.addControl(stack);

    // Room Name
    const name = new TextBlock();
    name.text = room.name;
    name.color = 'white';
    name.fontSize = 18;
    name.fontFamily = this.FONT_TACTICAL;
    name.width = '300px';
    name.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    name.paddingLeft = '20px';
    stack.addControl(name);

    // Map Info
    const mapId = (room.customProperties?.mapId as string) || 'UNKNOWN_ZONE';
    const map = new TextBlock();
    map.text = `ZONE: ${mapId.toUpperCase()}`;
    map.color = this.PRIMARY_COLOR;
    map.fontSize = 12;
    map.fontFamily = this.FONT_MONO;
    map.width = '200px';
    stack.addControl(map);

    // Player Count
    const count = new TextBlock();
    count.text = `${room.playerCount}/${room.maxPlayers} UNITS`;
    count.color = 'rgba(255, 255, 255, 0.6)';
    count.fontSize = 12;
    count.fontFamily = this.FONT_MONO;
    count.width = '150px';
    stack.addControl(count);

    // Join Button
    const joinBtn = Button.CreateSimpleButton('join-' + room.name, 'JOIN');
    joinBtn.width = '100px';
    joinBtn.height = '35px';
    joinBtn.color = this.PRIMARY_COLOR;
    joinBtn.background = 'transparent';
    joinBtn.thickness = 1;
    joinBtn.fontFamily = this.FONT_TACTICAL;
    joinBtn.onPointerUpObservable.add(() => {
      this.networkManager.joinRoom(room.name);
    });
    stack.addControl(joinBtn);

    return rect;
  }

  private showCreateRoomModal(): void {
    const modalOverlay = new Rectangle('modal-overlay');
    modalOverlay.width = '100%';
    modalOverlay.height = '100%';
    modalOverlay.background = 'rgba(0, 0, 0, 0.8)';
    modalOverlay.thickness = 0;
    modalOverlay.isPointerBlocker = true;
    this.container.addControl(modalOverlay);

    const modal = new Rectangle('create-room-modal');
    modal.width = '600px';
    modal.height = '500px';
    modal.background = this.BG_COLOR;
    modal.color = this.PRIMARY_COLOR;
    modal.thickness = 2;
    modalOverlay.addControl(modal);

    const title = new TextBlock();
    title.text = 'CONFIGURE_SQUAD_CHANNEL';
    title.color = 'white';
    title.fontSize = 24;
    title.fontFamily = this.FONT_TACTICAL;
    title.fontWeight = '700';
    title.height = '60px'; // Increased height for padding
    title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    title.paddingTop = '20px';
    modal.addControl(title);

    // Scroll Viewer for settings content
    const scrollViewer = new ScrollViewer('modal-scroll-viewer');
    scrollViewer.width = '100%';
    scrollViewer.height = '320px'; // Fixed height for scrollable area
    scrollViewer.top = '70px';
    scrollViewer.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    scrollViewer.thickness = 0;
    scrollViewer.barSize = 5;
    scrollViewer.barColor = this.PRIMARY_COLOR;
    modal.addControl(scrollViewer);

    const stack = new StackPanel();
    stack.paddingTop = '10px';
    stack.spacing = 20;
    scrollViewer.addControl(stack);

    // Room Name
    const nameLabel = this.createModalLabel('CHANNEL_ID:');
    stack.addControl(nameLabel);

    const playerName = localStorage.getItem('playerName') || 'COMMANDER';
    const roomInput = new InputText();
    roomInput.width = '400px';
    roomInput.height = '40px';
    roomInput.text = `OPS_${playerName}_${Math.floor(Math.random() * 1000)}`;
    roomInput.color = 'white';
    roomInput.background = 'rgba(255, 255, 255, 0.05)';
    roomInput.fontFamily = this.FONT_MONO;
    stack.addControl(roomInput);

    // Map Selection
    const mapLabel = this.createModalLabel('DEPLOYMENT_ZONE:');
    stack.addControl(mapLabel);

    const mapGrid = new StackPanel();
    mapGrid.isVertical = false;
    mapGrid.height = '50px';
    stack.addControl(mapGrid);

    let selectedMap = 'training_ground';
    const mapBtns: Button[] = [];

    const createMapOption = (id: string, label: string): Button => {
      const btn = Button.CreateSimpleButton('modal-map-' + id, label);
      btn.width = '180px';
      btn.height = '35px';
      btn.fontFamily = this.FONT_MONO;
      btn.fontSize = 12;
      btn.thickness = 1;
      btn.paddingRight = '10px';

      const updateMapStyles = (): void => {
        const isSelected = selectedMap === id;
        btn.color = isSelected ? 'black' : 'white';
        btn.background = isSelected ? this.PRIMARY_COLOR : 'rgba(255,255,255,0.05)';
      };

      btn.onPointerUpObservable.add((): void => {
        selectedMap = id;
        mapBtns.forEach((b) => {
          const isSel = b.name === 'modal-map-' + id;
          b.color = isSel ? 'black' : 'white';
          b.background = isSel ? this.PRIMARY_COLOR : 'rgba(255,255,255,0.05)';
        });
      });

      updateMapStyles();
      mapBtns.push(btn);
      return btn;
    };

    mapGrid.addControl(createMapOption('training_ground', 'TRAINING_GD'));
    mapGrid.addControl(createMapOption('combat_zone', 'COMBAT_ZONE'));

    // Game Mode Selection
    const modeLabel = this.createModalLabel('OPERATION_MODE:');
    stack.addControl(modeLabel);

    const modeGrid = new StackPanel();
    modeGrid.isVertical = false;
    modeGrid.height = '50px';
    stack.addControl(modeGrid);

    let selectedMode = 'deathmatch';
    const modeBtns: Button[] = [];

    const createModeOption = (id: string, label: string): Button => {
      const btn = Button.CreateSimpleButton('modal-mode-' + id, label);
      btn.width = '130px';
      btn.height = '35px';
      btn.fontFamily = this.FONT_MONO;
      btn.fontSize = 11;
      btn.thickness = 1;
      btn.paddingRight = '10px';

      const updateModeStyles = (): void => {
        const isSelected = selectedMode === id;
        btn.color = isSelected ? 'black' : 'white';
        btn.background = isSelected ? this.PRIMARY_COLOR : 'rgba(255,255,255,0.05)';
      };

      btn.onPointerUpObservable.add((): void => {
        selectedMode = id;
        modeBtns.forEach((b) => {
          const isSel = b.name === 'modal-mode-' + id;
          b.color = isSel ? 'black' : 'white';
          b.background = isSel ? this.PRIMARY_COLOR : 'rgba(255,255,255,0.05)';
        });
      });

      updateModeStyles();
      modeBtns.push(btn);
      return btn;
    };

    modeGrid.addControl(createModeOption('shooting_range', 'TRAINING'));
    modeGrid.addControl(createModeOption('survival', 'SURVIVAL'));
    modeGrid.addControl(createModeOption('deathmatch', 'DEATHMATCH'));

    // Host Locally Toggle
    const hostTogglePanel = new StackPanel();
    hostTogglePanel.isVertical = false;
    hostTogglePanel.height = '40px';
    stack.addControl(hostTogglePanel);

    const checkbox = new Checkbox();
    checkbox.width = '20px';
    checkbox.height = '20px';
    checkbox.isChecked = true;
    checkbox.color = this.PRIMARY_COLOR;
    hostTogglePanel.addControl(checkbox);

    const checkboxLabel = new TextBlock();
    checkboxLabel.text = 'ESTABLISH_LOCAL_SERVER_AUTHORITY';
    checkboxLabel.color = 'white';
    checkboxLabel.fontSize = 12;
    checkboxLabel.fontFamily = this.FONT_MONO;
    checkboxLabel.paddingLeft = '10px';
    checkboxLabel.width = '350px';
    checkboxLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    hostTogglePanel.addControl(checkboxLabel);

    // Bottom Action Buttons (Sticky)
    const buttonPanel = new StackPanel();
    buttonPanel.isVertical = false;
    buttonPanel.height = '80px';
    buttonPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    buttonPanel.background = 'rgba(0,0,0,0.3)';
    modal.addControl(buttonPanel);

    const cancelBtn = this.createButton('ABORT', '150px');
    cancelBtn.color = '#ff4d4d';
    cancelBtn.onPointerUpObservable.add(() => {
      modalOverlay.dispose();
    });
    buttonPanel.addControl(cancelBtn);

    const initBtn = this.createButton('INITIATE', '200px');
    initBtn.paddingLeft = '20px';
    initBtn.onPointerUpObservable.add(async () => {
      // Set Loading State
      initBtn.isEnabled = false;
      initBtn.textBlock!.text = 'DEPLOYING...';
      initBtn.alpha = 0.5;

      const roomName = roomInput.text;
      const mapId = selectedMap;
      const gameMode = selectedMode;

      // Force minimal delay for UX
      await new Promise((resolve) => setTimeout(resolve, 500));

      try {
        let success = false;
        if (checkbox.isChecked) {
          logger.info('Creating Local Server Session...');
          await LocalServerManager.getInstance().startSession(roomName, mapId, gameMode);
          success = await this.networkManager.joinRoom(roomName);
        } else {
          success = await this.networkManager.createRoom(roomName, mapId);
        }

        if (success) {
          modalOverlay.dispose();
        } else {
          throw new Error('FAILED_TO_ESTABLISH_UPLINK');
        }
      } catch (e: any) {
        logger.error('Failed to create/join room:', e);
        if (checkbox.isChecked) {
          LocalServerManager.getInstance().stopSession();
        }
        initBtn.isEnabled = true;
        initBtn.textBlock!.text = 'INITIATE';
        initBtn.alpha = 1.0;
      }
    });

    buttonPanel.addControl(initBtn);
  }

  private createModalLabel(text: string): TextBlock {
    const label = new TextBlock();
    label.text = text;
    label.color = this.PRIMARY_COLOR;
    label.fontSize = 12;
    label.fontFamily = this.FONT_MONO;
    label.height = '20px';
    label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    label.paddingLeft = '100px';
    return label;
  }

  private createButton(text: string, width: string): Button {
    const btn = Button.CreateSimpleButton('btn-' + text, text);
    btn.width = width;
    btn.height = '40px';
    btn.color = this.PRIMARY_COLOR;
    btn.background = 'transparent';
    btn.thickness = 2;
    btn.fontFamily = this.FONT_TACTICAL;
    btn.fontSize = 16;
    btn.fontWeight = '700';

    btn.onPointerEnterObservable.add((): void => {
      btn.background = this.PRIMARY_COLOR;
      btn.color = 'black';
    });
    btn.onPointerOutObservable.add((): void => {
      btn.background = 'transparent';
      btn.color = this.PRIMARY_COLOR;
    });

    return btn;
  }
}
