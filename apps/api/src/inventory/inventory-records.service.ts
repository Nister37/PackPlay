import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import * as QRCode from 'qrcode';
import { AppErrorCode } from '@packplay/common';
import { PrismaService } from '../common/prisma.service';
import { GenerateInventoryQrDto, InventoryHistoryQueryDto } from './dto';

@Injectable()
export class InventoryRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async history(groupId: string, query: InventoryHistoryQueryDto) {
    return this.prisma.inventoryMovement.findMany({
      where: {
        groupId,
        ...(query.batchId && { batchId: query.batchId }),
        ...(query.assetId && { assetId: query.assetId }),
        ...(query.activityId && { activityId: query.activityId }),
        ...(query.memberId && {
          OR: [
            { actorId: query.memberId },
            { fromHolderId: query.memberId },
            { toHolderId: query.memberId },
          ],
        }),
        ...(query.type && { type: query.type }),
        ...((query.from || query.to) && {
          createdAt: {
            ...(query.from && { gte: new Date(query.from) }),
            ...(query.to && { lte: new Date(query.to) }),
          },
        }),
      },
      include: {
        actor: { select: { id: true, name: true } },
        batch: { include: { inventoryItem: true } },
        asset: { include: { inventoryItem: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
  }

  async exportCsv(groupId: string, query: InventoryHistoryQueryDto) {
    const entries = await this.history(groupId, query);
    const escape = (value: unknown) => {
      const text =
        value instanceof Date
          ? value.toISOString()
          : value === null || value === undefined
            ? ''
            : String(value);
      return `"${text.replace(/"/g, '""')}"`;
    };
    const rows = entries.map((entry) => [
      entry.createdAt,
      entry.type,
      entry.batch?.inventoryItem.name ?? entry.asset?.inventoryItem.name,
      entry.batchId ?? entry.assetId,
      entry.quantity,
      entry.fromHolderId,
      entry.toHolderId,
      entry.activityId,
      entry.actor.name ?? entry.actor.id,
    ]);
    return [
      [
        'timestamp',
        'type',
        'item',
        'stock_id',
        'quantity',
        'from_member',
        'to_member',
        'event_id',
        'actor',
      ].map(escape),
      ...rows.map((row) => row.map(escape)),
    ]
      .map((row) => row.join(','))
      .join('\n');
  }

  async generateQr(groupId: string, dto: GenerateInventoryQrDto) {
    this.assertSingleTarget(dto);
    const stock = dto.batchId
      ? await this.prisma.inventoryBatch.findUnique({
          where: { id: dto.batchId },
          include: { inventoryItem: true },
        })
      : await this.prisma.inventoryAsset.findUnique({
          where: { id: dto.assetId },
          include: { inventoryItem: true },
        });
    if (!stock || stock.inventoryItem.groupId !== groupId) {
      throw new NotFoundException({
        code: AppErrorCode.NOT_FOUND,
        message: 'Inventory stock not found',
      });
    }
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hash(token);
    if (dto.batchId) {
      await this.prisma.inventoryBatch.update({
        where: { id: dto.batchId },
        data: { qrTokenHash: tokenHash },
      });
    } else {
      await this.prisma.inventoryAsset.update({
        where: { id: dto.assetId },
        data: { qrTokenHash: tokenHash },
      });
    }
    const baseUrl = this.config.get<string>(
      'APP_URL',
      'http://localhost:4200',
    );
    const url = `${baseUrl.replace(/\/$/, '')}/inventory/scan/${token}`;
    return {
      url,
      qrDataUrl: await QRCode.toDataURL(url, { width: 300 }),
    };
  }

  async resolveQr(token: string, userId: string) {
    const tokenHash = this.hash(token);
    const batch = await this.prisma.inventoryBatch.findUnique({
      where: { qrTokenHash: tokenHash },
      include: { inventoryItem: true, location: true, holder: true },
    });
    const asset = batch
      ? null
      : await this.prisma.inventoryAsset.findUnique({
          where: { qrTokenHash: tokenHash },
          include: { inventoryItem: true, location: true, holder: true },
        });
    const stock = batch ?? asset;
    if (!stock) {
      throw new NotFoundException({
        code: AppErrorCode.NOT_FOUND,
        message: 'Inventory QR code is invalid',
      });
    }
    const membership = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: stock.inventoryItem.groupId,
          userId,
        },
      },
    });
    if (!membership) {
      throw new NotFoundException({
        code: AppErrorCode.NOT_FOUND,
        message: 'Inventory QR code is invalid',
      });
    }
    return {
      kind: batch ? 'BATCH' : 'ASSET',
      stock,
      allowedActions: ['CHECKOUT', 'RETURN', 'DAMAGE_REPORT'],
    };
  }

  overdue(groupId: string) {
    return this.prisma.inventoryCustody.findMany({
      where: {
        returnedAt: null,
        dueAt: { lt: new Date() },
        OR: [
          { batch: { inventoryItem: { groupId } } },
          { asset: { inventoryItem: { groupId } } },
        ],
      },
      include: {
        holder: { select: { id: true, name: true, email: true } },
        batch: { include: { inventoryItem: true } },
        asset: { include: { inventoryItem: true } },
      },
      orderBy: { dueAt: 'asc' },
    });
  }

  private assertSingleTarget(dto: GenerateInventoryQrDto) {
    if (Boolean(dto.batchId) === Boolean(dto.assetId)) {
      throw new BadRequestException({
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'Exactly one batchId or assetId is required',
      });
    }
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
