import {
  // Equipment Manifest
  type EquipmentCoverageStatus,
  EQUIPMENT_COVERAGE_STATUSES,
  EquipmentManifestCustodianV1,
  EquipmentManifestItemV1,
  EquipmentManifestContractV1,
  isEquipmentCoverageStatus,
  isEquipmentManifestCustodianV1,
  validateEquipmentManifestCustodianV1,
  isEquipmentManifestItemV1,
  validateEquipmentManifestItemV1,
  isEquipmentManifestContractV1,
  validateEquipmentManifestContractV1,
  calculateEquipmentCoverageStatus,
  createEquipmentManifestItemV1,
  createEquipmentManifestContractV1,

  // Realtime Events
  REALTIME_PACKING_EVENTS,
  READINESS_STATUSES,
  type ReadinessStatus,
  isReadinessStatus,
  RealtimeItemPackedPayload,
  isRealtimeItemPackedPayload,
  validateRealtimeItemPackedPayload,
  createRealtimeItemPackedPayload,
  RealtimeCustodyTakeoverPayload,
  isRealtimeCustodyTakeoverPayload,
  validateRealtimeCustodyTakeoverPayload,
  createRealtimeCustodyTakeoverPayload,
  RealtimeDeckSyncPayload,
  isRealtimeDeckSyncPayload,
  validateRealtimeDeckSyncPayload,
  createRealtimeDeckSyncPayload,
  RealtimeReadinessUpdatePayload,
  isRealtimeReadinessUpdatePayload,
  validateRealtimeReadinessUpdatePayload,
  createRealtimeReadinessUpdatePayload,

  // Calendar & Schedule
  CalendarManifestSummaryV1,
  CalendarScheduleExportContractV1,
  isValidIsoDateString,
  isValidRruleString,
  isCalendarManifestSummaryV1,
  validateCalendarManifestSummaryV1,
  isCalendarScheduleExportContractV1,
  validateCalendarScheduleExportContractV1,
  createCalendarScheduleExportContractV1,
} from './index';

describe('Published Language Contracts & Schemas', () => {
  describe('Equipment Manifest Contract', () => {
    const validCustodian: EquipmentManifestCustodianV1 = {
      userId: 'user-42',
      name: 'Alex Custodian',
    };

    const validItem: EquipmentManifestItemV1 = {
      itemId: 'item-101',
      name: '4-Season Expedition Tent',
      category: 'Shelter',
      requiredQuantity: 2,
      committedQuantity: 2,
      packedQuantity: 1,
      coverageStatus: 'COVERED',
      primaryCustodian: validCustodian,
    };

    const validManifest: EquipmentManifestContractV1 = {
      manifestId: 'manifest-001',
      activityId: 'activity-501',
      groupId: 'group-888',
      title: 'Alpine Winter Ascent',
      itemCount: 1,
      overallCoveragePercent: 100,
      items: [validItem],
    };

    describe('EquipmentCoverageStatus & Helpers', () => {
      it('should validate all defined coverage statuses', () => {
        expect(EQUIPMENT_COVERAGE_STATUSES).toEqual([
          'UNASSIGNED',
          'PARTIALLY_COVERED',
          'COVERED',
          'PACKED',
          'MISSING',
        ]);

        for (const status of EQUIPMENT_COVERAGE_STATUSES) {
          const typedStatus: EquipmentCoverageStatus = status;
          expect(isEquipmentCoverageStatus(typedStatus)).toBe(true);
        }

        expect(isEquipmentCoverageStatus('UNKNOWN')).toBe(false);
        expect(isEquipmentCoverageStatus(123)).toBe(false);
        expect(isEquipmentCoverageStatus(null)).toBe(false);
      });

      it('should correctly calculate coverage status from quantities', () => {
        expect(calculateEquipmentCoverageStatus(2, 0, 0)).toBe('UNASSIGNED');
        expect(calculateEquipmentCoverageStatus(2, 1, 0)).toBe('PARTIALLY_COVERED');
        expect(calculateEquipmentCoverageStatus(2, 2, 0)).toBe('COVERED');
        expect(calculateEquipmentCoverageStatus(2, 2, 2)).toBe('PACKED');
        expect(calculateEquipmentCoverageStatus(0, 0, 0)).toBe('COVERED');
        expect(calculateEquipmentCoverageStatus(2, 2, 0, true)).toBe('MISSING');
      });
    });

    describe('EquipmentManifestCustodianV1', () => {
      it('should accept valid custodian with or without name', () => {
        expect(isEquipmentManifestCustodianV1({ userId: 'u-1', name: 'Bob' })).toBe(true);
        expect(isEquipmentManifestCustodianV1({ userId: 'u-1' })).toBe(true);
      });

      it('should reject invalid custodians', () => {
        expect(isEquipmentManifestCustodianV1(null)).toBe(false);
        expect(isEquipmentManifestCustodianV1({})).toBe(false);
        expect(isEquipmentManifestCustodianV1({ userId: '' })).toBe(false);
        expect(isEquipmentManifestCustodianV1({ userId: 'u-1', name: '' })).toBe(false);

        const result = validateEquipmentManifestCustodianV1({ userId: '', name: '' });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('userId must be a non-empty string');
        expect(result.errors).toContain('name must be a non-empty string if provided');
      });
    });

    describe('EquipmentManifestItemV1', () => {
      it('should validate complete valid item', () => {
        expect(isEquipmentManifestItemV1(validItem)).toBe(true);
        const result = validateEquipmentManifestItemV1(validItem);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate item without primaryCustodian', () => {
        const itemWithoutCustodian = { ...validItem };
        delete itemWithoutCustodian.primaryCustodian;
        expect(isEquipmentManifestItemV1(itemWithoutCustodian)).toBe(true);
      });

      it('should reject item with null primaryCustodian', () => {
        const itemWithNullCustodian = { ...validItem, primaryCustodian: null };
        expect(isEquipmentManifestItemV1(itemWithNullCustodian)).toBe(false);
        const result = validateEquipmentManifestItemV1(itemWithNullCustodian);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('primaryCustodian.Custodian must be a non-null object');
      });

      it('should reject invalid item properties', () => {
        const invalidItem = {
          ...validItem,
          itemId: '',
          name: '',
          category: '',
          requiredQuantity: -1,
          committedQuantity: -2,
          packedQuantity: -3,
          coverageStatus: 'INVALID_STATUS',
          primaryCustodian: { userId: '' },
        };

        expect(isEquipmentManifestItemV1(invalidItem)).toBe(false);
        const result = validateEquipmentManifestItemV1(invalidItem);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('itemId must be a non-empty string');
        expect(result.errors).toContain('name must be a non-empty string');
        expect(result.errors).toContain('category must be a non-empty string');
        expect(result.errors).toContain('requiredQuantity must be a non-negative number');
        expect(result.errors).toContain('committedQuantity must be a non-negative number');
        expect(result.errors).toContain('packedQuantity must be a non-negative number');
        expect(result.errors).toContain(
          `coverageStatus must be one of: ${EQUIPMENT_COVERAGE_STATUSES.join(', ')}`,
        );
        expect(result.errors).toContain('primaryCustodian.userId must be a non-empty string');
      });

      it('should reject non-object values', () => {
        expect(isEquipmentManifestItemV1(null)).toBe(false);
        expect(isEquipmentManifestItemV1(undefined)).toBe(false);
        expect(isEquipmentManifestItemV1('item')).toBe(false);
        expect(isEquipmentManifestItemV1([])).toBe(false);
      });

      it('should create item using factory helper createEquipmentManifestItemV1', () => {
        const created = createEquipmentManifestItemV1({
          itemId: 'i-10',
          name: 'Camp Stove',
          category: 'Cooking',
          requiredQuantity: 2,
          committedQuantity: 2,
        });

        expect(created.itemId).toBe('i-10');
        expect(created.requiredQuantity).toBe(2);
        expect(created.committedQuantity).toBe(2);
        expect(created.packedQuantity).toBe(0);
        expect(created.coverageStatus).toBe('COVERED');

        expect(() =>
          createEquipmentManifestItemV1({
            itemId: '',
            name: 'Invalid',
            category: 'Cooking',
          }),
        ).toThrow('Failed to create EquipmentManifestItemV1');
      });
    });

    describe('EquipmentManifestContractV1', () => {
      it('should validate valid manifest contract', () => {
        expect(isEquipmentManifestContractV1(validManifest)).toBe(true);
        const result = validateEquipmentManifestContractV1(validManifest);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject manifest with invalid or missing fields', () => {
        const invalidManifest = {
          ...validManifest,
          manifestId: '',
          activityId: '',
          groupId: '',
          title: '',
          itemCount: -1,
          overallCoveragePercent: 150,
          items: [{ invalid: true }],
        };

        expect(isEquipmentManifestContractV1(invalidManifest)).toBe(false);
        const result = validateEquipmentManifestContractV1(invalidManifest);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('manifestId must be a non-empty string');
        expect(result.errors).toContain('activityId must be a non-empty string');
        expect(result.errors).toContain('groupId must be a non-empty string');
        expect(result.errors).toContain('title must be a non-empty string');
        expect(result.errors).toContain('itemCount must be a non-negative integer');
        expect(result.errors).toContain(
          'overallCoveragePercent must be a number between 0 and 100',
        );
        expect(result.errors.some((e) => e.startsWith('items[0].'))).toBe(true);
      });

      it('should reject manifest with fractional itemCount', () => {
        const fractionalItemCount = {
          ...validManifest,
          itemCount: 2.5,
        };
        expect(isEquipmentManifestContractV1(fractionalItemCount)).toBe(false);
        const result = validateEquipmentManifestContractV1(fractionalItemCount);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('itemCount must be a non-negative integer');
      });

      it('should reject non-object and non-array items', () => {
        expect(isEquipmentManifestContractV1(null)).toBe(false);
        expect(isEquipmentManifestContractV1(undefined)).toBe(false);
        expect(isEquipmentManifestContractV1('manifest')).toBe(false);
        expect(isEquipmentManifestContractV1({ ...validManifest, items: 'not-an-array' })).toBe(
          false,
        );
      });

      it('should create manifest using factory helper and auto-calculate coverage', () => {
        const item1 = createEquipmentManifestItemV1({
          itemId: 'i-1',
          name: 'First Aid Kit',
          category: 'Safety',
          requiredQuantity: 2,
          committedQuantity: 2,
        });
        const item2 = createEquipmentManifestItemV1({
          itemId: 'i-2',
          name: 'Emergency Bivy',
          category: 'Shelter',
          requiredQuantity: 2,
          committedQuantity: 0,
        });

        const manifest = createEquipmentManifestContractV1({
          manifestId: 'm-2',
          activityId: 'a-2',
          groupId: 'g-2',
          title: 'Day Hike',
          items: [item1, item2],
        });

        expect(manifest.itemCount).toBe(2);
        // committed: 2 out of 4 required = 50%
        expect(manifest.overallCoveragePercent).toBe(50);
        expect(isEquipmentManifestContractV1(manifest)).toBe(true);
      });

      it('should handle empty items array with 100% default coverage', () => {
        const emptyManifest = createEquipmentManifestContractV1({
          manifestId: 'm-empty',
          activityId: 'a-empty',
          groupId: 'g-empty',
          title: 'Empty Activity',
          items: [],
        });

        expect(emptyManifest.itemCount).toBe(0);
        expect(emptyManifest.overallCoveragePercent).toBe(100);
        expect(isEquipmentManifestContractV1(emptyManifest)).toBe(true);
      });

      it('should throw when createEquipmentManifestContractV1 receives invalid input', () => {
        expect(() =>
          createEquipmentManifestContractV1({
            manifestId: '',
            activityId: 'a-1',
            groupId: 'g-1',
            title: 'Test',
          }),
        ).toThrow('Failed to create EquipmentManifestContractV1');
      });
    });
  });

  describe('Real-Time Live Packing Protocol Schemas', () => {
    it('should verify defined realtime events and readiness statuses', () => {
      expect(REALTIME_PACKING_EVENTS.ITEM_PACKED).toBe('packing:item-packed');
      expect(REALTIME_PACKING_EVENTS.CUSTODY_TAKEOVER).toBe('packing:custody-takeover');
      expect(REALTIME_PACKING_EVENTS.DECK_SYNC).toBe('packing:deck-sync');
      expect(REALTIME_PACKING_EVENTS.READINESS_UPDATE).toBe('packing:readiness-update');

      expect(READINESS_STATUSES).toEqual(['CRITICAL', 'NEEDS_ATTENTION', 'GAME_READY']);
      const sampleStatus: ReadinessStatus = 'CRITICAL';
      expect(isReadinessStatus(sampleStatus)).toBe(true);
      expect(isReadinessStatus('NEEDS_ATTENTION')).toBe(true);
      expect(isReadinessStatus('GAME_READY')).toBe(true);
      expect(isReadinessStatus('DONE')).toBe(false);
    });

    describe('RealtimeItemPackedPayload', () => {
      const validPayload: RealtimeItemPackedPayload = {
        sessionId: 'sess-1',
        activityId: 'act-1',
        itemId: 'item-1',
        userId: 'usr-1',
        quantity: 2,
        timestamp: '2026-11-14T10:00:00.000Z',
      };

      it('should validate correct payload', () => {
        expect(isRealtimeItemPackedPayload(validPayload)).toBe(true);
        const result = validateRealtimeItemPackedPayload(validPayload);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject invalid payload fields', () => {
        const invalid = {
          ...validPayload,
          sessionId: '',
          quantity: 0,
          timestamp: 'not-a-timestamp',
        };

        expect(isRealtimeItemPackedPayload(invalid)).toBe(false);
        const result = validateRealtimeItemPackedPayload(invalid);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('sessionId must be a non-empty string');
        expect(result.errors).toContain('quantity must be a positive number greater than 0');
        expect(result.errors).toContain('timestamp must be a valid ISO 8601 date string');
      });

      it('should create payload with default timestamp via factory helper', () => {
        const created = createRealtimeItemPackedPayload({
          sessionId: 's-10',
          activityId: 'a-10',
          itemId: 'i-10',
          userId: 'u-10',
          quantity: 1,
        });

        expect(created.sessionId).toBe('s-10');
        expect(typeof created.timestamp).toBe('string');
        expect(isRealtimeItemPackedPayload(created)).toBe(true);
      });
    });

    describe('RealtimeCustodyTakeoverPayload', () => {
      it('should validate takeover with previousUserId', () => {
        const payload: RealtimeCustodyTakeoverPayload = {
          sessionId: 'sess-2',
          itemId: 'item-2',
          previousUserId: 'usr-1',
          newUserId: 'usr-2',
          quantity: 1,
        };

        expect(isRealtimeCustodyTakeoverPayload(payload)).toBe(true);
        const result = validateRealtimeCustodyTakeoverPayload(payload);
        expect(result.valid).toBe(true);
      });

      it('should validate takeover without previousUserId (first claim)', () => {
        const payload: RealtimeCustodyTakeoverPayload = {
          sessionId: 'sess-2',
          itemId: 'item-2',
          newUserId: 'usr-2',
          quantity: 3,
        };

        expect(isRealtimeCustodyTakeoverPayload(payload)).toBe(true);
        const created = createRealtimeCustodyTakeoverPayload(payload);
        expect(created.newUserId).toBe('usr-2');
      });

      it('should reject invalid takeover payload', () => {
        const invalid = {
          sessionId: '',
          itemId: '',
          previousUserId: '',
          newUserId: '',
          quantity: -1,
        };

        expect(isRealtimeCustodyTakeoverPayload(invalid)).toBe(false);
        const result = validateRealtimeCustodyTakeoverPayload(invalid);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('sessionId must be a non-empty string');
        expect(result.errors).toContain('itemId must be a non-empty string');
        expect(result.errors).toContain('previousUserId must be a non-empty string if provided');
        expect(result.errors).toContain('newUserId must be a non-empty string');
        expect(result.errors).toContain('quantity must be a positive number greater than 0');

        expect(() =>
          createRealtimeCustodyTakeoverPayload(
            invalid as unknown as RealtimeCustodyTakeoverPayload,
          ),
        ).toThrow('Failed to create RealtimeCustodyTakeoverPayload');
      });

      it('should reject takeover when previousUserId matches newUserId', () => {
        const payload: RealtimeCustodyTakeoverPayload = {
          sessionId: 'sess-same',
          itemId: 'item-same',
          previousUserId: 'usr-1',
          newUserId: 'usr-1',
          quantity: 1,
        };

        expect(isRealtimeCustodyTakeoverPayload(payload)).toBe(false);
        const result = validateRealtimeCustodyTakeoverPayload(payload);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('previousUserId and newUserId cannot be the same user');
      });
    });

    describe('RealtimeDeckSyncPayload', () => {
      const validPayload: RealtimeDeckSyncPayload = {
        sessionId: 'sess-deck',
        activityId: 'act-deck',
        currentCardIndex: 4,
        totalCards: 10,
        readinessScore: 85,
      };

      it('should validate deck sync payload', () => {
        expect(isRealtimeDeckSyncPayload(validPayload)).toBe(true);
        const result = validateRealtimeDeckSyncPayload(validPayload);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject when currentCardIndex exceeds totalCards', () => {
        const invalid = {
          ...validPayload,
          currentCardIndex: 11,
          totalCards: 10,
        };

        expect(isRealtimeDeckSyncPayload(invalid)).toBe(false);
        const result = validateRealtimeDeckSyncPayload(invalid);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('currentCardIndex cannot exceed totalCards');
      });

      it('should reject invalid deck sync values', () => {
        const invalid = {
          sessionId: '',
          activityId: '',
          currentCardIndex: -1,
          totalCards: -5,
          readinessScore: 120,
        };

        expect(isRealtimeDeckSyncPayload(invalid)).toBe(false);
        const result = validateRealtimeDeckSyncPayload(invalid);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('sessionId must be a non-empty string');
        expect(result.errors).toContain('activityId must be a non-empty string');
        expect(result.errors).toContain('currentCardIndex must be a non-negative integer');
        expect(result.errors).toContain('totalCards must be a non-negative integer');
        expect(result.errors).toContain('readinessScore must be a number between 0 and 100');

        expect(() =>
          createRealtimeDeckSyncPayload(invalid as unknown as RealtimeDeckSyncPayload),
        ).toThrow('Failed to create RealtimeDeckSyncPayload');
      });

      it('should allow boundary readiness scores 0 and 100', () => {
        expect(
          isRealtimeDeckSyncPayload({
            ...validPayload,
            readinessScore: 0,
          }),
        ).toBe(true);

        expect(
          isRealtimeDeckSyncPayload({
            ...validPayload,
            readinessScore: 100,
          }),
        ).toBe(true);
      });
    });

    describe('RealtimeReadinessUpdatePayload', () => {
      const validPayload: RealtimeReadinessUpdatePayload = {
        activityId: 'act-10',
        readinessScore: 92,
        status: 'GAME_READY',
      };

      it('should validate readiness update for all valid statuses', () => {
        expect(isRealtimeReadinessUpdatePayload(validPayload)).toBe(true);
        for (const status of ['CRITICAL', 'NEEDS_ATTENTION', 'GAME_READY'] as const) {
          const payload: RealtimeReadinessUpdatePayload = {
            activityId: 'act-10',
            readinessScore: 75,
            status,
          };
          expect(isRealtimeReadinessUpdatePayload(payload)).toBe(true);
          expect(createRealtimeReadinessUpdatePayload(payload)).toEqual(payload);
        }
      });

      it('should reject invalid readiness update payload', () => {
        const invalid = {
          activityId: '',
          readinessScore: -10,
          status: 'NOT_A_STATUS',
        };

        expect(isRealtimeReadinessUpdatePayload(invalid)).toBe(false);
        const result = validateRealtimeReadinessUpdatePayload(invalid);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('activityId must be a non-empty string');
        expect(result.errors).toContain('readinessScore must be a number between 0 and 100');
        expect(result.errors).toContain(
          `status must be one of: ${READINESS_STATUSES.join(', ')}`,
        );

        expect(() =>
          createRealtimeReadinessUpdatePayload(
            invalid as unknown as RealtimeReadinessUpdatePayload,
          ),
        ).toThrow('Failed to create RealtimeReadinessUpdatePayload');
      });
    });
  });

  describe('Calendar & Schedule Interchange Contract', () => {
    const validExport: CalendarScheduleExportContractV1 = {
      eventId: 'evt-2026-001',
      groupId: 'grp-123',
      summary: 'Weekend Climbing Session',
      description: 'Sport climbing at Red Rocks',
      location: 'Red Rock Canyon, NV',
      startTime: '2026-11-20T08:00:00Z',
      endTime: '2026-11-20T17:00:00Z',
      recurrenceRule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=SA',
      manifestSummary: {
        totalItems: 14,
        isFullyCovered: true,
      },
    };

    describe('Helper Validators', () => {
      it('should validate ISO 8601 strings', () => {
        expect(isValidIsoDateString('2026-11-14T10:00:00Z')).toBe(true);
        expect(isValidIsoDateString('2026-11-14T10:00:00.000Z')).toBe(true);
        expect(isValidIsoDateString('2026-11-14T10:00:00+02:00')).toBe(true);
        expect(isValidIsoDateString('2026-11-14T10:00:00')).toBe(true);
        expect(isValidIsoDateString('2024-02-29T10:00:00Z')).toBe(true); // leap year

        // Invalid calendar dates
        expect(isValidIsoDateString('2026-02-31T10:00:00Z')).toBe(false);
        expect(isValidIsoDateString('2026-02-29T10:00:00Z')).toBe(false); // not a leap year
        expect(isValidIsoDateString('2026-11-14T25:00:00Z')).toBe(false);
        expect(isValidIsoDateString('2026-11-14T10:65:00Z')).toBe(false);
        expect(isValidIsoDateString('November 14, 2026')).toBe(false);
        expect(isValidIsoDateString('2026/11/14')).toBe(false);
        expect(isValidIsoDateString('not-a-date')).toBe(false);
        expect(isValidIsoDateString('')).toBe(false);
        expect(isValidIsoDateString(123456789)).toBe(false);
        expect(isValidIsoDateString(null)).toBe(false);
      });

      it('should validate RFC 5545 RRULE strings', () => {
        expect(isValidRruleString('FREQ=DAILY;COUNT=5')).toBe(true);
        expect(isValidRruleString('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE')).toBe(true);
        expect(isValidRruleString('RRULE:FREQ=MONTHLY;BYMONTHDAY=1')).toBe(true);
        expect(isValidRruleString('FREQ=YEARLY')).toBe(true);
        expect(isValidRruleString('RRULE:FREQ=WEEKLY;WKST=MO')).toBe(true);

        // Strict rejection of unanchored, malformed or invalid parameters
        expect(isValidRruleString('INVALID STRING FREQ=DAILY')).toBe(false);
        expect(isValidRruleString('FREQ=DAILY;INVALID_KEY=123')).toBe(false);
        expect(isValidRruleString('FREQ=DAILY;COUNT=-1')).toBe(false);
        expect(isValidRruleString('FREQ=DAILY;INTERVAL=0')).toBe(false);
        expect(isValidRruleString('FREQ=UNKNOWN_FREQ')).toBe(false);
        expect(isValidRruleString('RRULE:')).toBe(false);
        expect(isValidRruleString('INTERVAL=2')).toBe(false);
        expect(isValidRruleString('')).toBe(false);
        expect(isValidRruleString(null)).toBe(false);
      });

      it('should validate CalendarManifestSummaryV1', () => {
        const validSummary: CalendarManifestSummaryV1 = {
          totalItems: 8,
          isFullyCovered: false,
        };
        expect(isCalendarManifestSummaryV1(validSummary)).toBe(true);

        const invalidSummary = {
          totalItems: -1,
          isFullyCovered: 'yes' as unknown as boolean,
        };
        expect(isCalendarManifestSummaryV1(invalidSummary)).toBe(false);
        const result = validateCalendarManifestSummaryV1(invalidSummary);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('totalItems must be a non-negative integer');
        expect(result.errors).toContain('isFullyCovered must be a boolean');
      });
    });

    describe('CalendarScheduleExportContractV1', () => {
      it('should validate complete RFC 5545 export contract', () => {
        expect(isCalendarScheduleExportContractV1(validExport)).toBe(true);
        const result = validateCalendarScheduleExportContractV1(validExport);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate minimal export contract (optional fields omitted)', () => {
        const minimalExport: CalendarScheduleExportContractV1 = {
          eventId: 'evt-min',
          groupId: 'grp-min',
          summary: 'Minimal Event',
          startTime: '2026-12-01T09:00:00Z',
          endTime: '2026-12-01T10:00:00Z',
        };

        expect(isCalendarScheduleExportContractV1(minimalExport)).toBe(true);
        const created = createCalendarScheduleExportContractV1(minimalExport);
        expect(created.eventId).toBe('evt-min');
      });

      it('should reject when startTime is after endTime', () => {
        const invertedTimes: CalendarScheduleExportContractV1 = {
          ...validExport,
          startTime: '2026-11-20T18:00:00Z',
          endTime: '2026-11-20T09:00:00Z',
        };

        expect(isCalendarScheduleExportContractV1(invertedTimes)).toBe(false);
        const result = validateCalendarScheduleExportContractV1(invertedTimes);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('startTime cannot be after endTime');
      });

      it('should reject invalid recurrence rule and manifest summary', () => {
        const invalid: CalendarScheduleExportContractV1 = {
          ...validExport,
          recurrenceRule: 'INVALID_RULE_WITHOUT_FREQ',
          manifestSummary: {
            totalItems: -3,
            isFullyCovered: 'not-bool' as unknown as boolean,
          },
        };

        expect(isCalendarScheduleExportContractV1(invalid)).toBe(false);
        const result = validateCalendarScheduleExportContractV1(invalid);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'recurrenceRule must be a valid RFC 5545 RRULE string (e.g., FREQ=WEEKLY;INTERVAL=1)',
        );
        expect(result.errors).toContain(
          'manifestSummary.totalItems must be a non-negative integer',
        );
        expect(result.errors).toContain('manifestSummary.isFullyCovered must be a boolean');

        expect(() => createCalendarScheduleExportContractV1(invalid)).toThrow(
          'Failed to create CalendarScheduleExportContractV1',
        );
      });

      it('should reject non-object inputs', () => {
        expect(isCalendarScheduleExportContractV1(null)).toBe(false);
        expect(isCalendarScheduleExportContractV1(undefined)).toBe(false);
        expect(isCalendarScheduleExportContractV1(42)).toBe(false);
        expect(isCalendarScheduleExportContractV1([])).toBe(false);
      });
    });
  });

  describe('Integration & Package Re-export', () => {
    it('should export all contracts, guards, and validators from common root', () => {
      // Direct imports from common module
      const commonModule = require('../index');

      // Equipment Manifest exports
      expect(typeof commonModule.isEquipmentManifestContractV1).toBe('function');
      expect(typeof commonModule.validateEquipmentManifestContractV1).toBe('function');
      expect(typeof commonModule.createEquipmentManifestContractV1).toBe('function');
      expect(typeof commonModule.isEquipmentManifestItemV1).toBe('function');
      expect(typeof commonModule.validateEquipmentManifestItemV1).toBe('function');
      expect(typeof commonModule.createEquipmentManifestItemV1).toBe('function');
      expect(typeof commonModule.calculateEquipmentCoverageStatus).toBe('function');
      expect(Array.isArray(commonModule.EQUIPMENT_COVERAGE_STATUSES)).toBe(true);

      // Realtime Events exports
      expect(typeof commonModule.isRealtimeItemPackedPayload).toBe('function');
      expect(typeof commonModule.validateRealtimeItemPackedPayload).toBe('function');
      expect(typeof commonModule.createRealtimeItemPackedPayload).toBe('function');
      expect(typeof commonModule.isRealtimeCustodyTakeoverPayload).toBe('function');
      expect(typeof commonModule.validateRealtimeCustodyTakeoverPayload).toBe('function');
      expect(typeof commonModule.createRealtimeCustodyTakeoverPayload).toBe('function');
      expect(typeof commonModule.isRealtimeDeckSyncPayload).toBe('function');
      expect(typeof commonModule.validateRealtimeDeckSyncPayload).toBe('function');
      expect(typeof commonModule.createRealtimeDeckSyncPayload).toBe('function');
      expect(typeof commonModule.isRealtimeReadinessUpdatePayload).toBe('function');
      expect(typeof commonModule.validateRealtimeReadinessUpdatePayload).toBe('function');
      expect(typeof commonModule.createRealtimeReadinessUpdatePayload).toBe('function');
      expect(commonModule.REALTIME_PACKING_EVENTS).toBeDefined();
      expect(Array.isArray(commonModule.READINESS_STATUSES)).toBe(true);

      // Calendar exports
      expect(typeof commonModule.isCalendarScheduleExportContractV1).toBe('function');
      expect(typeof commonModule.validateCalendarScheduleExportContractV1).toBe('function');
      expect(typeof commonModule.createCalendarScheduleExportContractV1).toBe('function');
      expect(typeof commonModule.isCalendarManifestSummaryV1).toBe('function');
      expect(typeof commonModule.validateCalendarManifestSummaryV1).toBe('function');
      expect(typeof commonModule.isValidIsoDateString).toBe('function');
      expect(typeof commonModule.isValidRruleString).toBe('function');

      // AppError and AppErrorCode should remain intact
      expect(commonModule.AppErrorCode).toBeDefined();
      expect(commonModule.AppError).toBeDefined();
    });
  });
});
