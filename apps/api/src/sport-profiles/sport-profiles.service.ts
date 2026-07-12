import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AppErrorCode } from '@packplay/common';
import { CreateSportProfileDto, UpdateSportProfileDto } from './dto';

@Injectable()
export class SportProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSportProfileDto) {
    return this.prisma.sportProfile.create({
      data: {
        userId,
        name: dto.name,
        activityTypes: dto.activityTypes,
      },
    });
  }

  async listByUser(userId: string) {
    return this.prisma.sportProfile.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(profileId: string, userId: string) {
    const profile = await this.prisma.sportProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      throw new NotFoundException({
        code: AppErrorCode.SPORT_PROFILE_NOT_FOUND,
        message: 'Sport profile not found',
      });
    }

    if (profile.userId !== userId) {
      throw new ForbiddenException({
        code: AppErrorCode.NOT_PROFILE_OWNER,
        message: 'You do not own this sport profile',
      });
    }

    return profile;
  }

  async update(profileId: string, userId: string, dto: UpdateSportProfileDto) {
    const profile = await this.getById(profileId, userId);

    return this.prisma.sportProfile.update({
      where: { id: profile.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.activityTypes !== undefined && { activityTypes: dto.activityTypes }),
      },
    });
  }

  async delete(profileId: string, userId: string) {
    await this.getById(profileId, userId);
    await this.prisma.sportProfile.delete({ where: { id: profileId } });
  }
}
