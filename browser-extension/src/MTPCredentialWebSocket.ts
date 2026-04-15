import { Centrifuge, Subscription } from 'centrifuge';

interface MTPCredentialResponse {
  status: 'published' | 'pending' | 'failed';
  txId: string;
  claimId: string;
  offerAvailable: boolean;
  qrCodeLink?: string;
  message?: string;
}

const baseUrl = import.meta.env.VITE_WS_URL as string || import.meta.env.VITE_DCID_WS_URL as string || '';

export class MTPCredentialWebSocket {
  private centrifuge: Centrifuge | null = null;
  private subscription: Subscription | null = null;
  private waitingCredentials = new Map<string, {
    resolve: (value: MTPCredentialResponse) => void;
    reject: (reason: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();
  private jwtToken: string | null = null;

  private getWebSocketUrl(claimId: string, txId: string): string {
    return `${baseUrl}?claimId=${encodeURIComponent(claimId)}&txId=${encodeURIComponent(txId)}`;
  }

  private connect(claimId: string, txId: string) {
    if (this.centrifuge?.state === 'connected') return;

    const wsUrl = this.getWebSocketUrl(claimId, txId);

    console.log('[MTPWebSocket] Connecting with:', {
      hasToken: !!this.jwtToken,
      tokenPreview: this.jwtToken ? `${this.jwtToken.substring(0, 20)}...` : 'no token',
      url: wsUrl
    });

    this.centrifuge = new Centrifuge(wsUrl, {
      token: this.jwtToken as string
    });

    this.makeListeners();
    this.centrifuge.connect();
  }

  private makeListeners() {
    if (!this.centrifuge) return;

    this.centrifuge.on('connected', (ctx) => {
      console.log('[MTPWebSocket] Connected!', {
        client: ctx.client,
        transport: ctx.transport
      });
      this.subscribeToUpdates();
    });

    this.centrifuge.on('disconnected', (ctx) => {
      console.log('[MTPWebSocket] Disconnected!', {
        code: ctx.code,
        reason: ctx.reason
      });
    });

    this.centrifuge.on('error', (ctx) => {
      console.error('[MTPWebSocket] Error:', {
        type: ctx.type,
        error: ctx.error,
        message: ctx.error?.message
      });
    });

    this.centrifuge.on('connecting', (ctx) => {
      console.log('[MTPWebSocket] Connecting...', {
        code: ctx.code,
        reason: ctx.reason
      });
    });
  }

  private subscribeToUpdates() {
    if (!this.centrifuge) return;

    this.subscription = this.centrifuge.newSubscription('credential_updates');

    this.subscription.on('publication', (ctx) => {
      const data = ctx.data as MTPCredentialResponse;
      console.log('[MTPWebSocket] Received publication:', data);

      if (data.status === 'published' && data.offerAvailable) {
        const waiting = this.waitingCredentials.get(data.claimId);
        if (waiting) {
          console.log('[MTPWebSocket] ✅ Credential published and offer available!', { claimId: data.claimId });
          clearTimeout(waiting.timeout);
          waiting.resolve(data);
          this.waitingCredentials.delete(data.claimId);

          // Auto-disconnect when credential is published
          setTimeout(() => this.disconnect(), 1000);
        } else {
          console.warn('[MTPWebSocket] Received credential publication but no waiting promise found', { claimId: data.claimId });
        }
      } else {
        console.log('[MTPWebSocket] Received publication but credential not ready yet', {
          status: data.status,
          offerAvailable: data.offerAvailable
        });
      }
    });

    this.subscription.on('subscribed', () => {
      console.log('[MTPWebSocket] ✅ Subscribed to credential_updates channel');
    });

    this.subscription.on('error', (ctx) => {
      console.error('[MTPWebSocket] Subscription Error:', ctx.error);
    });

    this.subscription.subscribe();
  }

  setJWTToken(token: string | null) {
    this.jwtToken = token;
  }

  waitForCredential(claimId: string, txId: string): Promise<MTPCredentialResponse> {
    return new Promise((resolve, reject) => {
      // Auto-connect when needed
      if (!this.centrifuge || this.centrifuge.state !== 'connected') {
        this.connect(claimId, txId);

        // Wait for connection
        this.centrifuge?.on('connected', () => {
          this.sendWaitRequest(claimId, txId, resolve, reject);
        });
      } else {
        this.sendWaitRequest(claimId, txId, resolve, reject);
      }
    });
  }

  private sendWaitRequest(
    claimId: string,
    _txId: string,
    resolve: (value: MTPCredentialResponse) => void,
    reject: (reason: Error) => void
  ) {
    if (!this.centrifuge || this.centrifuge.state !== 'connected') {
      const error = new Error('Centrifuge not connected');
      console.error('[MTPWebSocket] Cannot wait for credential - not connected:', { claimId });
      reject(error);
      return;
    }

    console.log('[MTPWebSocket] Waiting for credential...', { claimId });

    // 2 minute timeout
    const timeout = setTimeout(() => {
      this.waitingCredentials.delete(claimId);
      console.warn('[MTPWebSocket] ⚠️ Credential timeout - not ready within 2 minutes', { claimId });
      reject(new Error('Credential not ready within 2 minutes'));

      // Auto-disconnect if no more waiting
      if (this.waitingCredentials.size === 0) {
        this.disconnect();
      }
    }, 120000);

    this.waitingCredentials.set(claimId, { resolve, reject, timeout });
  }

  disconnect() {
    this.waitingCredentials.forEach(({timeout, reject}) => {
      clearTimeout(timeout);
      reject(new Error('Centrifuge disconnected'));
    });
    this.waitingCredentials.clear();

    this.subscription?.unsubscribe();
    this.subscription = null;

    this.centrifuge?.disconnect();
    this.centrifuge = null;
  }
}
