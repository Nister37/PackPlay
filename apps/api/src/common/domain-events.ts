export class ItemCreatedEvent {
  readonly activityId: string;
  readonly itemId: string;
  readonly groupId: string;
  readonly catalogueItemId?: string;
  readonly createdById: string;

  constructor(payload: {
    activityId: string;
    itemId: string;
    groupId: string;
    catalogueItemId?: string;
    createdById: string;
  }) {
    this.activityId = payload.activityId;
    this.itemId = payload.itemId;
    this.groupId = payload.groupId;
    this.catalogueItemId = payload.catalogueItemId;
    this.createdById = payload.createdById;
  }
}

export class ItemPackedEvent {
  readonly activityId: string;
  readonly itemId: string;
  readonly userId: string;
  readonly timestamp: Date;

  constructor(payload: {
    activityId: string;
    itemId: string;
    userId: string;
    timestamp?: Date;
  }) {
    this.activityId = payload.activityId;
    this.itemId = payload.itemId;
    this.userId = payload.userId;
    this.timestamp = payload.timestamp ?? new Date();
  }
}

export class CustodyTransferredEvent {
  readonly activityId: string;
  readonly itemId: string;
  readonly fromUserId: string;
  readonly toUserId: string;
  readonly quantity: number;

  constructor(payload: {
    activityId: string;
    itemId: string;
    fromUserId: string;
    toUserId: string;
    quantity: number;
  }) {
    this.activityId = payload.activityId;
    this.itemId = payload.itemId;
    this.fromUserId = payload.fromUserId;
    this.toUserId = payload.toUserId;
    this.quantity = payload.quantity;
  }
}
