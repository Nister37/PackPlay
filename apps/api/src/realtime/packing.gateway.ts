import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';

@WebSocketGateway({
  cors: {
    origin: process.env['CORS_ORIGIN'] || 'http://localhost:4200',
    credentials: true,
  },
  namespace: '/packing',
})
export class PackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(PackingGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      if (!payload.sid) {
        client.disconnect();
        return;
      }
      const session = await this.prisma.session.findFirst({
        where: {
          id: payload.sid,
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });
      if (!session) {
        client.disconnect();
        return;
      }

      client.data.userId = payload.sub;
      this.logger.log(`Client connected: ${client.id} (user: ${payload.sub})`);
    } catch {
      this.logger.warn(`Client authentication failed: ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:activity')
  async handleJoinActivity(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { activityId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    // Verify group membership through activity with efficient query
    const membership = await this.prisma.groupMember.findFirst({
      where: {
        userId,
        group: { activities: { some: { id: data.activityId } } },
      },
      select: { id: true },
    });

    if (!membership) return;

    const room = `activity:${data.activityId}`;
    await client.join(room);
    this.logger.log(`User ${userId} joined room ${room}`);
  }

  @SubscribeMessage('join:group')
  async handleJoinGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    // Verify group membership
    const membership = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: data.groupId, userId } },
    });

    if (!membership) return;

    const room = `group:${data.groupId}`;
    await client.join(room);
    this.logger.log(`User ${userId} joined room ${room}`);
  }

  // ─── Server-side emission methods ─────────────────────────────────────

  emitToActivity(activityId: string, event: string, payload: Record<string, unknown>) {
    if (!this.server) return;
    this.server.to(`activity:${activityId}`).emit(event, payload);
  }

  emitToGroup(groupId: string, event: string, payload: Record<string, unknown>) {
    if (!this.server) return;
    this.server.to(`group:${groupId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: Record<string, unknown>) {
    if (!this.server) return;
    // Find connected sockets for the user
    const sockets = this.server.sockets;
    if (sockets) {
      for (const [, socket] of sockets.sockets) {
        if (socket.data.userId === userId) {
          socket.emit(event, payload);
        }
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    const token = client.handshake.auth?.token;
    return token ?? null;
  }
}
