import { io, type Socket } from 'socket.io-client';

export const createSocket = (token: string): Socket => {
  return io('/packing', {
    auth: { token },
    transports: ['websocket'],
  });
};

class SocketManager {
  private socket: Socket | null = null;

  connect(token: string): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = createSocket(token);
    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

export const socketManager = new SocketManager();
