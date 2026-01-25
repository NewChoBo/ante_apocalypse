import {
  Engine,
  Scene,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator,
  Color3,
  CubeTexture,
  Color4,
} from '@babylonjs/core';
import studioEnvUrl from '../../assets/environments/studio.env?url';

export class SceneManager {
  private engine: Engine;
  private scene: Scene | null = null;
  private shadowGenerator: ShadowGenerator | null = null;

  constructor(engine: Engine) {
    this.engine = engine;
  }

  public async createMenuScene(): Promise<{ scene: Scene; shadowGenerator: ShadowGenerator }> {
    this.disposeCurrentScene();

    const scene = new Scene(this.engine);
    scene.clearColor = new Color4(0.1, 0.1, 0.15, 1);

    // PBR 환경 맵 로드
    const envTexture = CubeTexture.CreateFromPrefilteredData(studioEnvUrl, scene);
    scene.environmentTexture = envTexture;
    scene.environmentIntensity = 1.0;

    const ambient = new HemisphericLight('light', new Vector3(0, 1, 0), scene);
    ambient.intensity = 0.5;
    ambient.groundColor = new Color3(0.2, 0.2, 0.25);

    const sun = this.createSun(scene);
    this.shadowGenerator = this.createShadowGenerator(sun);

    this.scene = scene;
    return { scene, shadowGenerator: this.shadowGenerator };
  }

  public async createGameScene(): Promise<{ scene: Scene; shadowGenerator: ShadowGenerator }> {
    this.disposeCurrentScene();

    const scene = new Scene(this.engine);
    scene.clearColor = new Color4(0.1, 0.1, 0.15, 1);

    const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
    ambient.intensity = 0.4;
    ambient.groundColor = new Color3(0.2, 0.2, 0.25);

    const sun = this.createSun(scene);
    this.shadowGenerator = this.createShadowGenerator(sun);

    this.scene = scene;
    return { scene, shadowGenerator: this.shadowGenerator };
  }

  private createSun(scene: Scene): DirectionalLight {
    const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.5), scene);
    sun.position = new Vector3(20, 40, 20);
    sun.intensity = 0.8;
    return sun;
  }

  private createShadowGenerator(light: DirectionalLight): ShadowGenerator {
    const sg = new ShadowGenerator(2048, light);
    sg.useBlurExponentialShadowMap = true;
    sg.blurKernel = 32;
    return sg;
  }

  public disposeCurrentScene(): void {
    if (this.scene) {
      this.scene.dispose();
      this.scene = null;
      this.shadowGenerator = null;
    }
  }

  public getScene(): Scene | null {
    return this.scene;
  }

  public getShadowGenerator(): ShadowGenerator | null {
    return this.shadowGenerator;
  }
}
