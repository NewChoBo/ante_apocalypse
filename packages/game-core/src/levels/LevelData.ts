export interface LevelData {
  ground: {
    width: number;
    height: number;
    material: { diffuse: number[]; specular: number[] };
  };
  walls: Array<{
    name: string;
    position: number[];
    size: number[];
    material: { diffuse: number[] };
  }>;
  props: Array<{
    type: 'box' | 'cylinder';
    name: string;
    position: number[];
    size: number[]; // [width, height, depth] or [height, diameter]
    material: { diffuse: number[]; emissive?: number[] };
  }>;
  playerSpawn?: number[]; // [x, y, z]
  enemySpawns?: number[][]; // [[x,y,z], [x,y,z], ...]
}
