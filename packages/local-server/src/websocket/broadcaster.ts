import type { WebSocket } from 'ws';
import type { WsEvent } from '@codepilot/shared';

export class EventBroadcaster {
  private clients: Set<WebSocket> = new Set();

  public registerClient(socket: WebSocket) {
    this.clients.add(socket);
    socket.on('close', () => {
      this.clients.delete(socket);
    });
  }

  public broadcast(type: string, payload: unknown) {
    const event: WsEvent = {
      type,
      payload,
      timestamp: new Date().toISOString()
    };
    const message = JSON.stringify(event);

    for (const socket of this.clients) {
      if (socket.readyState === 1 /* OPEN */) {
        try {
          socket.send(message);
        } catch {
          this.clients.delete(socket);
        }
      }
    }
  }

  public getConnectedCount(): number {
    return this.clients.size;
  }
}
