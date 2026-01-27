export interface IGameSystem {
  initialize?(): void | Promise<void>;
  update?(deltaTime: number): void;
  dispose(): void;
}
