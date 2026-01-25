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
import { NetworkManager } from '../core/systems/NetworkManager';
import { UIManager, UIScreen } from './UIManager';
import { RoomInfo } from '../core/network/NetworkProtocol';

export class LobbyUI {
  private container: Container;
  private roomListPanel: StackPanel;
  private networkManager: NetworkManager;
  private uiManager: UIManager;
  private roomNameInput: InputText | null = null;

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

    const createBtn = this.createButton('CREATE_SESSION', '200px');
    createBtn.onPointerUpObservable.add(() => this.onCreateRoom());
    bottomControls.addControl(createBtn);

    // Room Name Input (Left of Create Button)
    const input = new InputText();
    input.width = '200px';
    input.height = '40px';
    input.text = 'OPER_ZONE_' + Math.floor(Math.random() * 1000);
    input.color = 'white';
    input.background = 'rgba(0, 0, 0, 0.5)';
    input.focusedBackground = 'rgba(0, 0, 0, 0.8)';
    input.thickness = 1;
    input.fontFamily = this.FONT_MONO;
    input.fontSize = 16;
    input.placeholderText = 'ENTER ROOM NAME';
    input.placeholderColor = 'gray';
    input.onTextChangedObservable.add((input) => {
      input.text = input.text.toUpperCase().replace(/[^A-Z0-9_]/g, '');
    });
    // Add before buttons? No, StackPanel order matters.
    // Let's allow creating it first or move controls around.
    // Ideally put it in bottomControls before buttons.

    // Create Refresh Button
    const refreshBtn = this.createButton('REFRESH_UI', '150px');
    refreshBtn.paddingLeft = '20px';
    refreshBtn.onPointerUpObservable.add(() => {
      console.log('[Lobby] Refreshing UI...');
      this.networkManager.refreshRoomList();
      // Also update from cache immediately if available (in case refresh doesn't trigger event)
      this.updateRoomList(this.networkManager.getRoomList());
    });

    // Re-ordering for layout: Input -> Create -> Refresh
    bottomControls.clearControls();
    bottomControls.addControl(input);

    // Add Margin
    const spacer = new Rectangle();
    spacer.width = '10px';
    spacer.thickness = 0;
    bottomControls.addControl(spacer);

    bottomControls.addControl(createBtn);
    bottomControls.addControl(refreshBtn);

    this.roomNameInput = input;

    // Return button
    const backBtn = this.createButton('RETURN_TO_BASE', '200px');
    backBtn.color = '#ff4d4d';
    backBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    backBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    backBtn.top = '-40px';
    backBtn.onPointerUpObservable.add(() => this.uiManager.showScreen(UIScreen.MAIN_MENU));
    content.addControl(backBtn);

    return container;
  }

  private setupListeners(): void {
    this.networkManager.onRoomListUpdated.add((rooms) => {
      this.updateRoomList(rooms);
    });

    // Initial fetch from cache
    this.updateRoomList(this.networkManager.getRoomList());
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
    const mapId = room.customProperties?.mapId || 'UNKNOWN_ZONE';
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

  private onCreateRoom(): void {
    const selectedMap = this.uiManager.getSelectedMap();
    let roomName = this.roomNameInput?.text || `OPER_ZONE_${Math.floor(Math.random() * 10000)}`;
    if (roomName.length === 0) roomName = `OPER_ZONE_${Math.floor(Math.random() * 10000)}`;

    this.networkManager.createRoom(roomName, { mapId: selectedMap });
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
}
