declare module 'xhr2' {
  class XMLHttpRequest {
    open(method: string, url: string, async?: boolean): void;
    send(data?: unknown): void;
    readyState: number;
    status: number;
    responseText: string;
    onreadystatechange: () => void;
    onerror: (err: unknown) => void;
    onload: () => void;
    setRequestHeader(header: string, value: string): void;
  }
  export default XMLHttpRequest;
}
