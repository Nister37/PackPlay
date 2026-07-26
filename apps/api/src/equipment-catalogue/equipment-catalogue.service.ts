import { Injectable, NotFoundException } from '@nestjs/common';
import { AppErrorCode } from '@packplay/common';
import { PrismaService } from '../common/prisma.service';
import {
  CatalogueQueryDto,
  UpdateSuggestionPreferenceDto,
} from './dto';

interface RankedSuggestion {
  id: string;
  canonicalName: string;
  category: string;
  sports: unknown;
  roles: unknown;
  aliases: string[];
  score: number;
  approximate: boolean;
  matchedTerm: string;
  teamUseCount: number;
}

@Injectable()
export class EquipmentCatalogueService {
  constructor(private readonly prisma: PrismaService) {}

  async search(userId: string, query: CatalogueQueryDto) {
    const normalized = this.normalize(query.query);
    if (!normalized) return [];
    if (query.groupId) await this.assertMember(query.groupId, userId);

    const preference = await this.prisma.equipmentSuggestionPreference.findUnique({
      where: { userId },
    });
    const personalized = preference?.personalizedRanking ?? true;
    const candidates = await this.prisma.equipmentCatalogueItem.findMany({
      where: {
        active: true,
        OR: [
          { canonicalName: { contains: normalized, mode: 'insensitive' } },
          { aliases: { some: { alias: { contains: normalized, mode: 'insensitive' } } } },
        ],
      },
      include: {
        aliases: true,
        teamUsage:
          query.groupId && personalized
            ? { where: { groupId: query.groupId } }
            : false,
      },
      take: 100,
    });

    return candidates
      .map((item): RankedSuggestion | null => {
        const canonical = this.normalize(item.canonicalName);
        const aliases = item.aliases.map((alias) => alias.alias);
        const terms = [item.canonicalName, ...aliases];
        let bestScore = 0;
        let matchedTerm = item.canonicalName;
        let approximate = false;

        for (const term of terms) {
          const normalizedTerm = this.normalize(term);
          let score = 0;
          let fuzzy = false;
          if (normalizedTerm === normalized) {
            score = term === item.canonicalName ? 1000 : 950;
          } else if (normalizedTerm.startsWith(normalized)) {
            score = term === item.canonicalName ? 850 : 800;
          } else if (normalizedTerm.includes(normalized)) {
            score = term === item.canonicalName ? 650 : 600;
          } else {
            const distance = this.levenshtein(normalized, normalizedTerm);
            const threshold = normalized.length <= 4 ? 1 : 2;
            if (distance <= threshold) {
              score = 500 - distance * 50;
              fuzzy = true;
            }
          }
          if (score > bestScore) {
            bestScore = score;
            matchedTerm = term;
            approximate = fuzzy;
          }
        }
        if (bestScore === 0) return null;

        const sports = Array.isArray(item.sports)
          ? item.sports.map(String).map((value) => this.normalize(value))
          : [];
        const roles = Array.isArray(item.roles)
          ? item.roles.map(String).map((value) => this.normalize(value))
          : [];
        if (query.sport && sports.includes(this.normalize(query.sport))) bestScore += 100;
        if (query.role && roles.includes(this.normalize(query.role))) bestScore += 75;
        const teamUseCount =
          'teamUsage' in item && Array.isArray(item.teamUsage)
            ? (item.teamUsage[0]?.useCount ?? 0)
            : 0;
        if (personalized && teamUseCount > 0) {
          bestScore += Math.min(100, Math.round(Math.log2(teamUseCount + 1) * 20));
        }
        return {
          id: item.id,
          canonicalName: item.canonicalName,
          category: item.category,
          sports: item.sports,
          roles: item.roles,
          aliases,
          score: bestScore,
          approximate,
          matchedTerm,
          teamUseCount,
        };
      })
      .filter((item): item is RankedSuggestion => item !== null)
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.canonicalName.localeCompare(right.canonicalName),
      )
      .slice(0, query.limit ?? 15);
  }

  bootstrap() {
    return this.prisma.equipmentCatalogueItem.findMany({
      where: { active: true },
      include: { aliases: true },
      orderBy: [{ category: 'asc' }, { canonicalName: 'asc' }],
    });
  }

  getPreference(userId: string) {
    return this.prisma.equipmentSuggestionPreference
      .findUnique({ where: { userId } })
      .then((preference) => ({
        personalizedRanking: preference?.personalizedRanking ?? true,
      }));
  }

  updatePreference(userId: string, dto: UpdateSuggestionPreferenceDto) {
    return this.prisma.equipmentSuggestionPreference.upsert({
      where: { userId },
      create: { userId, personalizedRanking: dto.personalizedRanking },
      update: { personalizedRanking: dto.personalizedRanking },
    });
  }

  clearPersonalization(userId: string) {
    return this.prisma.equipmentSuggestionPreference.upsert({
      where: { userId },
      create: { userId, personalizedRanking: false },
      update: { personalizedRanking: false },
    });
  }

  recordTeamUsage(groupId: string, catalogueItemId: string) {
    return this.prisma.teamEquipmentUsage.upsert({
      where: { groupId_catalogueItemId: { groupId, catalogueItemId } },
      create: { groupId, catalogueItemId, useCount: 1 },
      update: { useCount: { increment: 1 }, lastUsedAt: new Date() },
    });
  }

  private async assertMember(groupId: string, userId: string) {
    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member) {
      throw new NotFoundException({
        code: AppErrorCode.NOT_FOUND,
        message: 'Group not found',
      });
    }
  }

  private normalize(value: string) {
    return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  }

  private levenshtein(left: string, right: string) {
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      const current = [leftIndex];
      for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
        current[rightIndex] = Math.min(
          current[rightIndex - 1] + 1,
          previous[rightIndex] + 1,
          previous[rightIndex - 1] +
            (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
        );
      }
      previous.splice(0, previous.length, ...current);
    }
    return previous[right.length];
  }
}
