import { ILoadingScreen } from '@babylonjs/core';

export class CustomLoadingScreen implements ILoadingScreen {
  public loadingUIBackgroundColor: string = '#000000';
  public loadingUIText: string = 'Loading...';

  private _loadingDiv: HTMLElement | null = null;
  private _style: HTMLStyleElement | null = null;

  constructor(public loadingUITextColor: string = '#FFFFFF') {}

  public displayLoadingUI(): void {
    if (this._loadingDiv) {
      return; // 이미 표시 중
    }

    this._createStyle();

    this._loadingDiv = document.createElement('div');
    this._loadingDiv.id = 'customLoadingScreen';
    this._loadingDiv.innerHTML = `
      <div class="loader-content">
        <div class="spinner"></div>
        <div class="loading-text">${this.loadingUIText}</div>
      </div>
    `;

    document.body.appendChild(this._loadingDiv);
  }

  public hideLoadingUI(): void {
    if (this._loadingDiv) {
      document.body.removeChild(this._loadingDiv);
      this._loadingDiv = null;
    }
  }

  private _createStyle(): void {
    if (document.getElementById('customLoadingStyle')) return;

    const css = `
      #customLoadingScreen {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: ${this.loadingUIBackgroundColor};
        color: ${this.loadingUITextColor};
        z-index: 9999;
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: 'Courier New', Courier, monospace;
      }
      .loader-content {
        text-align: center;
      }
      .spinner {
        width: 50px;
        height: 50px;
        border: 5px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: #fff;
        animation: spin 1s ease-in-out infinite;
        margin: 0 auto 20px auto;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      .loading-text {
        font-size: 24px;
        letter-spacing: 2px;
        animation: blink 1.5s infinite;
      }
      @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;

    this._style = document.createElement('style');
    this._style.id = 'customLoadingStyle';
    this._style.innerHTML = css;
    document.head.appendChild(this._style);
  }
}
