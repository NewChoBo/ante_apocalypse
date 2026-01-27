export class SimpleObserver<T> {
  constructor(
    public callback: (data: T) => void,
    public observable: SimpleObservable<T>
  ) {}
  public remove(): void {
    this.observable.remove(this);
  }
}

export class SimpleObservable<T> {
  private observers: SimpleObserver<T>[] = [];

  public add(callback: (data: T) => void): SimpleObserver<T> {
    const observer = new SimpleObserver(callback, this);
    this.observers.push(observer);
    return observer;
  }

  public remove(observer: SimpleObserver<T>): void {
    const index = this.observers.indexOf(observer);
    if (index !== -1) {
      this.observers.splice(index, 1);
    }
  }

  public notifyObservers(data: T): void {
    // Clone to prevent issues if observers are removed during notify
    const slice = this.observers.slice();
    for (const observer of slice) {
      observer.callback(data);
    }
  }

  public clear(): void {
    this.observers = [];
  }

  public hasObservers(): boolean {
    return this.observers.length > 0;
  }
}
