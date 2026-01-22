import { Entity } from './BaseEntity';

export class EntityManager {
  private entities: Entity[] = [];

  public add(entity: Entity): void {
    this.entities.push(entity);
  }

  public update(delta: number): void {
    for (let i = this.entities.length - 1; i >= 0; i--) {
      this.entities[i].update(delta);
    }
  }

  public remove(entity: Entity): void {
    const index = this.entities.indexOf(entity);
    if (index !== -1) {
      this.entities[index].destroy();
      this.entities.splice(index, 1);
    }
  }

  public getAll(): Entity[] {
    return this.entities;
  }
}
