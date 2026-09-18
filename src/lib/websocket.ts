import { AgentEvent } from '../types/api';

export type AgentEventCallback = (event: AgentEvent) => void;

export class AgentWebSocket {
  private taskId: string;
  private ws: WebSocket | null = null;
  private callbacks: Set<AgentEventCallback> = new Set();
  private retryCount: number = 0;
  private maxRetries: number = 5;
  private reconnectTimer: any = null;
  private isExplicitlyClosed: boolean = false;
  private baseUrl: string;

  constructor(taskId: string, baseUrl: string = 'ws://localhost:8000/ws/agent') {
    this.taskId = taskId;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  public connect(): void {
    this.isExplicitlyClosed = false;
    this.clearReconnectTimer();

    const url = `${this.baseUrl}/${encodeURIComponent(this.taskId)}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.retryCount = 0;
        this.emitInternalEvent('WS_CONNECTED', 'WebSocket connection established');
      };

      this.ws.onmessage = (messageEvent: MessageEvent) => {
        try {
          const raw = typeof messageEvent.data === 'string'
            ? JSON.parse(messageEvent.data)
            : messageEvent.data;

          const event: AgentEvent = {
            type: raw.type || raw.event_type || 'AGENT_EVENT',
            timestamp: raw.timestamp || new Date().toISOString(),
            message: raw.message || (typeof raw === 'string' ? raw : JSON.stringify(raw)),
            data: raw.data || raw.data_json || raw,
            task_id: this.taskId
          };

          this.notifyCallbacks(event);
        } catch {
          this.notifyCallbacks({
            type: 'RAW_MESSAGE',
            timestamp: new Date().toISOString(),
            message: String(messageEvent.data),
            task_id: this.taskId
          });
        }
      };

      this.ws.onerror = (err) => {
        this.emitInternalEvent('WS_ERROR', 'WebSocket error encountered');
      };

      this.ws.onclose = (closeEvent: CloseEvent) => {
        this.ws = null;
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };
    } catch (err: any) {
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.clearReconnectTimer();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.retryCount = 0;
  }

  public reconnect(): void {
    this.disconnect();
    this.connect();
  }

  public onEvent(callback: AgentEventCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  public send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      this.ws.send(payload);
    }
  }

  private scheduleReconnect(): void {
    if (this.retryCount < this.maxRetries) {
      const delay = Math.pow(2, this.retryCount) * 1000;
      this.retryCount++;
      this.clearReconnectTimer();

      this.emitInternalEvent(
        'WS_RECONNECTING',
        `Reconnecting in ${delay / 1000}s (attempt ${this.retryCount}/${this.maxRetries})`
      );

      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      this.emitInternalEvent('WS_MAX_RETRIES', 'Maximum WebSocket reconnect attempts reached');
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private notifyCallbacks(event: AgentEvent): void {
    this.callbacks.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error('Error in AgentWebSocket callback:', err);
      }
    });
  }

  private emitInternalEvent(type: string, message: string): void {
    this.notifyCallbacks({
      type,
      timestamp: new Date().toISOString(),
      message,
      task_id: this.taskId
    });
  }
}
