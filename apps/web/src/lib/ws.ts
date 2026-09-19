import {
  createClientEnvelope,
  EventEnvelopeSchema,
  ClientEventType,
  ServerEventType,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_PING_FRAME,
  HEARTBEAT_PONG_FRAME,
} from '@batalha/protocol';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private maxReconnectDelay = 30000;
  private _state: ConnectionState = 'disconnected';
  private _roomVersion = 0;
  private seenEventIds = new Set<string>();
  private handlers = new Map<string, Set<(payload: any, envelope: any) => void>>();
  private stateHandlers = new Set<(state: ConnectionState) => void>();
  private currentPin: string | null = null;
  private currentRole: string | null = null;
  private currentToken: string | undefined;

  constructor() {
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      // P0.1: Mobile foreground / visibility change
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.handleForegroundSync();
        }
      });
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      // P0.1: pageshow / focus
      window.addEventListener('pageshow', () => this.handleForegroundSync());
      window.addEventListener('focus', () => this.handleForegroundSync());

      // P0.2: Network online / offline
      window.addEventListener('online', () => this.handleNetworkOnline());
      window.addEventListener('offline', () => this.handleNetworkOffline());
    }
  }

  get state(): ConnectionState { return this._state; }
  get roomVersion(): number { return this._roomVersion; }

  private setState(newState: ConnectionState) {
    if (this._state !== newState) {
      this._state = newState;
      this.stateHandlers.forEach(handler => handler(newState));
    }
  }

  connect(pin: string, role: string, token?: string): void {
    if (this.ws) {
      if (
        this.currentPin === pin &&
        this.currentRole === role &&
        (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }
      try {
        this.ws.onopen = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
      this.stopHeartbeat();
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.seenEventIds.clear();
      this._roomVersion = 0;
    }

    const isDifferentPin = this.currentPin !== null && this.currentPin !== pin;
    if (isDifferentPin) {
      this.currentToken = undefined;
      this.seenEventIds.clear();
      this._roomVersion = 0;
    }

    this.currentPin = pin;
    this.currentRole = role;
    this.currentToken = token ?? (isDifferentPin ? undefined : this.currentToken) ?? (typeof localStorage !== 'undefined' ? localStorage.getItem(`batalha_session_${pin}`) || undefined : undefined);

    this.setState(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');

    const url = new URL(`/api/rooms/${pin}/ws`, window.location.origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('role', role);
    // P1.15: Never pass hostToken in WebSocket URL query param (HttpOnly cookie used)
    if (this.currentToken && role !== 'host') {
      url.searchParams.set('token', this.currentToken);
    }

    this.ws = new WebSocket(url.toString());

    this.ws.onopen = () => {
      this.setState('connected');
      this.reconnectAttempt = 0;
      this.startHeartbeat();

      if (this.currentPin) {
        if (this.currentRole === 'player') {
          const token = this.currentToken ?? (typeof localStorage !== 'undefined' ? localStorage.getItem(`batalha_session_${this.currentPin}`) || undefined : undefined);
          if (token) {
            this.currentToken = token;
            // P0.2: Automatically resume session when connecting with saved player token
            this.resumeSession(this.currentPin, token);
          }
        } else if (this.currentRole === 'host' || this.currentRole === 'screen') {
          // P0.1: Immediate snapshot request for host/screen
          this.requestSnapshot();
        }
      }
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.ws = null;
      if (this._state !== 'disconnected') {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onmessage = (event) => {
      if (event.data === HEARTBEAT_PONG_FRAME) return;

      try {
        const rawData = JSON.parse(event.data);
        const parsed = EventEnvelopeSchema.safeParse(rawData);
        
        if (!parsed.success) {
          console.error('Invalid message format received:', parsed.error);
          return;
        }

        const envelope = parsed.data;
        // Skip internal keep-alive responses
        if (envelope.type === 'PONG') return;

        // P0.3: Update reconnectToken when SESSION_ACCEPTED arrives
        if (envelope.type === ServerEventType.SESSION_ACCEPTED) {
          const payload = envelope.payload as any;
          if (payload?.reconnectToken) {
            this.currentToken = payload.reconnectToken;
            if (this.currentPin && typeof localStorage !== 'undefined') {
              localStorage.setItem(`batalha_session_${this.currentPin}`, payload.reconnectToken);
            }
          }
        }

        // P0.3: Deduplicate eventId
        if (envelope.eventId) {
          if (this.seenEventIds.has(envelope.eventId)) {
            return;
          }
          this.seenEventIds.add(envelope.eventId);
          if (this.seenEventIds.size > 500) {
            const oldest = this.seenEventIds.values().next().value;
            if (oldest) this.seenEventIds.delete(oldest);
          }
        }
        
        // P0.3 & P0.5: Protocol ordering, stale event discarding, and gap detection
        if ('roomVersion' in envelope && typeof envelope.roomVersion === 'number') {
          const incomingVersion = envelope.roomVersion;
          if (envelope.type === 'SNAPSHOT') {
            if (this._roomVersion > 0 && incomingVersion < this._roomVersion) {
              console.warn(`[ws] Discarding stale SNAPSHOT (current v${this._roomVersion}, incoming v${incomingVersion})`);
              return;
            }
            this._roomVersion = incomingVersion;
          } else if (this._roomVersion > 0) {
            if (incomingVersion < this._roomVersion) {
              // Discard outdated event
              console.warn(`[ws] Discarding outdated event ${envelope.type} (v${incomingVersion} < current v${this._roomVersion})`);
              return;
            }
            if (incomingVersion > this._roomVersion + 1) {
              // P0.5: Version gap detected: request snapshot and discard incremental event
              console.warn(`[ws] Version gap detected (current v${this._roomVersion}, incoming v${incomingVersion}). Requesting SNAPSHOT.`);
              this.requestSnapshot();
              return;
            } else {
              this._roomVersion = incomingVersion;
            }
          } else {
            this._roomVersion = incomingVersion;
          }
        }

        const typeHandlers = this.handlers.get(envelope.type);
        if (typeHandlers) {
          typeHandlers.forEach(handler => handler(envelope.payload, envelope));
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
  }

  handleForegroundSync(): void {
    if (!this.currentPin && typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/(?:play|join|host|screen)\/([A-Za-z0-9]+)/);
      if (match) {
        this.currentPin = match[1];
      }
    }
    if (!this.currentRole && typeof window !== 'undefined') {
      if (window.location.pathname.startsWith('/host')) this.currentRole = 'host';
      else if (window.location.pathname.startsWith('/screen')) this.currentRole = 'screen';
      else if (window.location.pathname.startsWith('/play') || window.location.pathname.startsWith('/join')) this.currentRole = 'player';
    }
    if (!this.currentPin || !this.currentRole) return;

    if (!this.currentToken && typeof localStorage !== 'undefined' && this.currentRole === 'player') {
      this.currentToken = localStorage.getItem(`batalha_session_${this.currentPin}`) || undefined;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      this.connect(this.currentPin, this.currentRole, this.currentToken);
    } else {
      this.requestSnapshot();
    }
  }

  handleNetworkOnline(): void {
    this.handleForegroundSync();
  }

  handleNetworkOffline(): void {
    this.setState('reconnecting');
  }

  disconnect(): void {
    this.setState('disconnected');
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.seenEventIds.clear();
    this._roomVersion = 0;
    this.currentPin = null;
    this.currentRole = null;
    this.currentToken = undefined;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(HEARTBEAT_PING_FRAME);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this._state === 'disconnected') return;
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), this.maxReconnectDelay);
    this.reconnectAttempt++;
    
    this.setState('reconnecting');
    this.reconnectTimer = setTimeout(() => {
      if (this.currentPin && this.currentRole) {
        this.connect(this.currentPin, this.currentRole, this.currentToken);
      }
    }, delay);
  }

  send(type: string, payload: unknown, correlationId?: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send message, WebSocket is not open');
      return;
    }

    const envelope = createClientEnvelope(type, payload, this._roomVersion, correlationId);
    this.ws.send(JSON.stringify(envelope));
  }

  // Action Helpers
  joinRoom(pin: string, nickname: string): void {
    this.send(ClientEventType.JOIN_ROOM, { pin, nickname });
  }

  resumeSession(pin: string, reconnectToken: string): void {
    this.send(ClientEventType.RESUME_SESSION, { pin, reconnectToken });
  }

  submitAnswer(questionId: string, questionVersion: number, optionId: string): void {
    this.send(ClientEventType.SUBMIT_ANSWER, { questionId, questionVersion, optionId });
  }

  sendHostCommand(command: string, expectedRoomVersion: number, data?: Record<string, unknown>): void {
    this.send(ClientEventType.HOST_COMMAND, { command, expectedRoomVersion, data });
  }

  requestSnapshot(): void {
    this.send(ClientEventType.REQUEST_SNAPSHOT, { lastRoomVersion: this._roomVersion });
  }

  onEvent(type: string, handler: (payload: any, envelope: any) => void): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    
    return () => {
      const typeHandlers = this.handlers.get(type);
      if (typeHandlers) {
        typeHandlers.delete(handler);
      }
    };
  }

  onStateChange(handler: (state: ConnectionState) => void): () => void {
    this.stateHandlers.add(handler);
    return () => {
      this.stateHandlers.delete(handler);
    };
  }

  // Testing & lifecycle simulation helper
  closeSocketForTest(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
    }
  }
}

// Singleton
export const wsManager = new WebSocketManager();

if (typeof window !== 'undefined') {
  (window as any).__wsManager = wsManager;
}
