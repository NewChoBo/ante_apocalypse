import {
  Container,
  StackPanel,
  Rectangle,
  TextBlock,
  ScrollViewer,
  Control,
  Button,
  InputText,
} from '@babylonjs/gui';
import { NetworkManager } from '../core/network/NetworkManager';

import { RoomData } from '../core/network/NetworkProtocol';
import { GameModeType } from '../types/GameMode';

export class LobbyUI {
  private container: Container;
  private roomListPanel: StackPanel;
  private networkManager: NetworkManager;

  // Filter Input

  private filterText: string = '';

  // Modal
  private modalContainer: Container | null = null;
  private modalRoomNameInput: InputText | null = null;
  private modalSelectedMode: GameModeType = 'survival';
  private modalSelectedMap: string = 'training_ground';

  // Visual Constants from UIManager (for consistency)
  private readonly PRIMARY_COLOR = '#ffc400';
  private readonly BG_COLOR = 'rgba(5, 5, 10, 0.95)';
  private readonly FONT_TACTICAL = 'Rajdhani, sans-serif';
  private readonly FONT_MONO = 'Roboto Mono, monospace';

  constructor() {
    this.networkManager = NetworkManager.getInstance();
    this.container = this.createContainer();

    // Find controls
    this.roomListPanel = this.container
      .getDescendants()
      .find((d) => d.name === 'room-list') as StackPanel;

    this.setupListeners();
    this.createRoomCreationModal(); // Create hidden modal
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

    // 1. Refresh Button (Left)
    const refreshBtn = this.createButton('REFRESH_UI', '150px');
    refreshBtn.width = '150px';
    refreshBtn.fontSize = 14;
    refreshBtn.onPointerUpObservable.add(() => {
      console.log('[Lobby] Refreshing UI...');
      this.networkManager.refreshRoomList();
    });
    bottomControls.addControl(refreshBtn);

    const spacer1 = new Rectangle();
    spacer1.width = '20px';
    spacer1.thickness = 0;
    bottomControls.addControl(spacer1);

    // 2. Filter Input (Center-Left)
    const input = new InputText();
    input.width = '250px';
    input.height = '40px';
    input.text = '';
    input.color = 'white';
    input.background = 'rgba(0, 0, 0, 0.5)';
    input.focusedBackground = 'rgba(0, 0, 0, 0.8)';
    input.thickness = 1;
    input.fontFamily = this.FONT_MONO;
    input.fontSize = 14;
    input.placeholderText = 'SEARCH CHANNEL...';
    input.placeholderColor = 'gray';
    input.onTextChangedObservable.add((input) => {
      this.filterText = input.text.trim().toUpperCase();
      this.updateRoomList(this.networkManager.getRoomList());
    });

    bottomControls.addControl(input);

    const spacer2 = new Rectangle();
    spacer2.width = '20px';
    spacer2.thickness = 0;
    bottomControls.addControl(spacer2);

    // 3. Create Button (Right)
    const createBtn = this.createButton('CREATE_SESSION', '200px');
    createBtn.onPointerUpObservable.add(() => this.showCreateModal());
    bottomControls.addControl(createBtn);

    return container;
  }

  private createRoomCreationModal(): void {
    const modal = new Rectangle('modal-overlay');
    modal.width = '100%';
    modal.height = '100%';
    modal.background = 'rgba(0, 0, 0, 0.8)';
    modal.thickness = 0;
    modal.isVisible = false;
    modal.zIndex = 100; // Lay on top
    this.container.addControl(modal); // Add to lobby container
    this.modalContainer = modal;

    const panel = new Rectangle('modal-panel');
    panel.width = '600px';
    panel.height = '500px';
    panel.background = 'rgba(10, 10, 15, 0.95)';
    panel.thickness = 1;
    panel.color = this.PRIMARY_COLOR;
    modal.addControl(panel);

    const stack = new StackPanel();
    stack.width = '550px';
    panel.addControl(stack);

    // Title
    const title = new TextBlock();
    title.text = 'INITIALIZE OPERATION';
    title.color = this.PRIMARY_COLOR;
    title.fontSize = 24;
    title.fontFamily = this.FONT_TACTICAL;
    title.fontWeight = '700';
    title.height = '60px';
    stack.addControl(title);

    // 1. Room Name
    const nameLabel = this.createLabel('OPERATION NAME:');
    stack.addControl(nameLabel);

    const nameInput = new InputText();
    nameInput.width = '100%';
    nameInput.height = '40px';
    nameInput.text = 'OPER_ZONE_' + Math.floor(Math.random() * 1000);
    nameInput.color = 'white';
    nameInput.background = 'rgba(255, 255, 255, 0.05)';
    nameInput.focusedBackground = 'rgba(255, 255, 255, 0.1)';
    nameInput.thickness = 1;
    nameInput.color = this.PRIMARY_COLOR;
    nameInput.fontFamily = this.FONT_MONO;
    nameInput.onTextChangedObservable.add((i) => {
      i.text = i.text.toUpperCase().replace(/[^A-Z0-9_]/g, '');
    });
    this.modalRoomNameInput = nameInput;
    stack.addControl(nameInput);

    // 2. Game Mode
    const modeLabel = this.createLabel('ENGAGEMENT RULES:');
    modeLabel.paddingTop = '20px';
    stack.addControl(modeLabel);

    const modePanel = new StackPanel();
    modePanel.isVertical = false;
    modePanel.height = '40px';
    stack.addControl(modePanel);

    const createModeBtn = (id: GameModeType, label: string): Button => {
      const btn = Button.CreateSimpleButton('modal-mode-' + id, label);
      btn.width = '150px';
      btn.height = '35px';
      btn.color = 'white';
      btn.background = 'transparent';
      btn.thickness = 1;
      btn.fontFamily = this.FONT_MONO;
      btn.fontSize = 12;
      btn.paddingRight = '10px';

      btn.onPointerUpObservable.add(() => {
        this.modalSelectedMode = id;
        this.updateModalStyles();
      });
      return btn;
    };

    const survivalBtn = createModeBtn('survival', 'SURVIVAL');
    const timeAttackBtn = createModeBtn('time_attack', 'TIME ATTACK');
    modePanel.addControl(survivalBtn);
    modePanel.addControl(timeAttackBtn);

    // 3. Map
    const mapLabel = this.createLabel('DEPLOYMENT ZONE:');
    mapLabel.paddingTop = '20px';
    stack.addControl(mapLabel);

    const mapPanel = new StackPanel();
    mapPanel.isVertical = false;
    mapPanel.height = '40px';
    stack.addControl(mapPanel);

    const createMapBtn = (id: string, label: string): Button => {
      const btn = Button.CreateSimpleButton('modal-map-' + id, label);
      btn.width = '150px';
      btn.height = '35px';
      btn.color = 'white';
      btn.background = 'transparent';
      btn.thickness = 1;
      btn.fontFamily = this.FONT_MONO;
      btn.fontSize = 12;
      btn.paddingRight = '10px';

      btn.onPointerUpObservable.add(() => {
        this.modalSelectedMap = id;
        this.updateModalStyles();
      });
      return btn;
    };

    const tgBtn = createMapBtn('training_ground', 'TRAINING_GD');
    const czBtn = createMapBtn('combat_zone', 'COMBAT_ZONE');
    mapPanel.addControl(tgBtn);
    mapPanel.addControl(czBtn);

    // Spacer
    const spacer = new Rectangle();
    spacer.height = '40px';
    spacer.thickness = 0;
    stack.addControl(spacer);

    // Actions
    const actionPanel = new StackPanel();
    actionPanel.isVertical = false;
    actionPanel.height = '50px';
    actionPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    stack.addControl(actionPanel);

    const confirmBtn = this.createButton('CONFIRM', '180px');
    confirmBtn.onPointerUpObservable.add(() => this.onCreateRoomConfirm());
    actionPanel.addControl(confirmBtn);

    const cancelBtn = this.createButton('CANCEL', '180px');
    cancelBtn.color = '#ff4d4d'; // Red
    cancelBtn.paddingLeft = '20px';
    cancelBtn.onPointerUpObservable.add(() => this.hideCreateModal());
    actionPanel.addControl(cancelBtn);

    // Store references for style updating (hacky but works for now)
    this.modalContainer.metadata = { survivalBtn, timeAttackBtn, tgBtn, czBtn };
  }

  private updateModalStyles(): void {
    if (!this.modalContainer || !this.modalContainer.metadata) return;
    const { survivalBtn, timeAttackBtn, tgBtn, czBtn } = this.modalContainer.metadata;

    const updateBtn = (btn: Button, selected: boolean): void => {
      btn.background = selected ? this.PRIMARY_COLOR : 'transparent';
      btn.color = selected ? 'black' : 'white';
    };

    updateBtn(survivalBtn, this.modalSelectedMode === 'survival');
    updateBtn(timeAttackBtn, this.modalSelectedMode === 'time_attack');
    updateBtn(tgBtn, this.modalSelectedMap === 'training_ground');
    updateBtn(czBtn, this.modalSelectedMap === 'combat_zone');
  }

  private showCreateModal(): void {
    if (this.modalContainer) {
      this.modalContainer.isVisible = true;
      this.modalSelectedMode = 'survival'; // Reset defaults or keep last? Resetting seems safer.
      // this.modalSelectedMap = 'training_ground'; // Keep map
      this.updateModalStyles();
    }
  }

  private hideCreateModal(): void {
    if (this.modalContainer) {
      this.modalContainer.isVisible = false;
    }
  }

  private onCreateRoomConfirm(): void {
    let roomName =
      this.modalRoomNameInput?.text || `OPER_ZONE_${Math.floor(Math.random() * 10000)}`;
    if (roomName.length === 0) roomName = `OPER_ZONE_${Math.floor(Math.random() * 10000)}`;

    console.log(
      `[Lobby] Creating Room: ${roomName}, Mode: ${this.modalSelectedMode}, Map: ${this.modalSelectedMap}`
    );
    this.networkManager.createRoom(roomName, {
      mapId: this.modalSelectedMap,
      gameMode: this.modalSelectedMode,
    });

    this.hideCreateModal();
  }

  private setupListeners(): void {
    this.networkManager.onRoomListUpdated.add((rooms) => {
      this.updateRoomList(rooms);
    });

    // Initial fetch from cache
    this.updateRoomList(this.networkManager.getRoomList());
  }

  private updateRoomList(rooms: RoomData[]): void {
    if (!this.roomListPanel) return;
    this.roomListPanel.clearControls();

    // Filter
    const filtered = rooms.filter(
      (r) =>
        r.name.toUpperCase().includes(this.filterText) ||
        (r.customProperties?.mapId as string)?.toUpperCase().includes(this.filterText)
    );

    if (filtered.length === 0) {
      const emptyMsg = new TextBlock();
      emptyMsg.text = 'NO_ACTIVE_SESSIONS_FOUND';
      emptyMsg.color = 'rgba(255, 255, 255, 0.2)';
      emptyMsg.fontSize = 14;
      emptyMsg.fontFamily = this.FONT_MONO;
      emptyMsg.height = '100px';
      this.roomListPanel.addControl(emptyMsg);
      return;
    }

    filtered.forEach((room) => {
      const row = this.createRoomRow(room);
      this.roomListPanel.addControl(row);
    });
  }

  private createRoomRow(room: RoomData): Container {
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
    map.width = '150px';
    stack.addControl(map);

    // Mode Info
    const modeId = (room.customProperties?.gameMode as string) || 'SURVIVAL';
    const mode = new TextBlock();
    mode.text = `${modeId.toUpperCase().replace('_', ' ')}`;
    mode.color = 'rgba(255, 255, 255, 0.8)';
    mode.fontSize = 12;
    mode.fontFamily = this.FONT_MONO;
    mode.width = '120px';
    stack.addControl(mode);

    // Player Count
    const count = new TextBlock();
    count.text = `${room.playerCount}/${room.maxPlayers}`;
    count.color = 'rgba(255, 255, 255, 0.6)';
    count.fontSize = 12;
    count.fontFamily = this.FONT_MONO;
    count.width = '80px';
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

  private createLabel(text: string): TextBlock {
    const label = new TextBlock();
    label.text = text;
    label.color = 'white';
    label.fontSize = 14;
    label.fontFamily = this.FONT_MONO;
    label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    label.height = '30px';
    return label;
  }
}
