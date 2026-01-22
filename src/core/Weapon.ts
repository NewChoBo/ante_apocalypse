import * as THREE from 'three';

export class Weapon {
  public mesh: THREE.Group;
  private camera: THREE.Camera;
  
  // 애니메이션 변수
  private targetPosition = new THREE.Vector3(0.5, -0.4, -0.8); // 화면 우측 하단 기본 위치
  
  private recoilOffset = new THREE.Vector3();
  private recoilRotation = 0;
  
  private bobbingAmount = 0;
  private bobbingSpeed = 0;

  constructor(camera: THREE.Camera) {
    this.camera = camera;
    this.mesh = this.createPlaceholderModel();
    
    // 카메라의 자식으로 추가하여 시점과 함께 움직이게 함
    this.camera.add(this.mesh);
    this.mesh.position.copy(this.targetPosition);
  }

  private createPlaceholderModel(): THREE.Group {
    const group = new THREE.Group();

    // 총 몸통
    const bodyGeo = new THREE.BoxGeometry(0.1, 0.15, 0.4);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // 총열
    const barrelGeo = new THREE.BoxGeometry(0.06, 0.06, 0.3);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.position.z = -0.25;
    group.add(barrel);

    // 손잡이
    const gripGeo = new THREE.BoxGeometry(0.08, 0.15, 0.08);
    const grip = new THREE.Mesh(gripGeo, bodyMat);
    grip.position.set(0, -0.12, 0.1);
    grip.rotation.x = Math.PI / 6;
    group.add(grip);

    // 머즐 소등기 (조명 효과용 위치 참조)
    const muzzle = new THREE.Object3D();
    muzzle.position.z = -0.4;
    muzzle.name = 'muzzle';
    group.add(muzzle);

    return group;
  }

  public update(delta: number, isMoving: boolean): void {
    // 반동 회복
    this.recoilOffset.lerp(new THREE.Vector3(0, 0, 0), delta * 10);
    this.recoilRotation *= (1 - delta * 15);

    // 발걸음 보빙 (흔들림)
    if (isMoving) {
      this.bobbingSpeed += delta * 10;
      this.bobbingAmount = Math.sin(this.bobbingSpeed) * 0.015;
    } else {
      this.bobbingAmount *= (1 - delta * 5);
    }

    // 최종 위치 적용
    this.mesh.position.set(
      this.targetPosition.x + this.recoilOffset.x,
      this.targetPosition.y + this.recoilOffset.y + this.bobbingAmount,
      this.targetPosition.z + this.recoilOffset.z
    );
    
    this.mesh.rotation.x = this.recoilRotation;
  }

  public shoot(): void {
    // 반동 적용
    this.recoilOffset.z = 0.1; // 뒤로 튀기
    this.recoilRotation = -0.15; // 위로 들리기
  }

  public reload(): void {
    // 재장전 애니메이션 (간단하게 아래로 내렸다가 올리기)
    const originalPos = this.targetPosition.clone();
    this.targetPosition.y = -1.0;
    
    setTimeout(() => {
      this.targetPosition.y = originalPos.y;
    }, 1000);
  }
}
