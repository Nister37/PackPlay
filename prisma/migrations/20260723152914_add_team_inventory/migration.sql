-- CreateTable
CREATE TABLE `inventory_items` (
    `id` VARCHAR(191) NOT NULL,
    `group_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(100) NULL,
    `unit` VARCHAR(50) NOT NULL DEFAULT 'piece',
    `tracking_type` ENUM('BATCH', 'ASSET') NOT NULL,
    `archived_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `inventory_items_group_id_archived_at_idx`(`group_id`, `archived_at`),
    INDEX `inventory_items_group_id_name_idx`(`group_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_storage_locations` (
    `id` VARCHAR(191) NOT NULL,
    `group_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `details` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inventory_storage_locations_group_id_name_key`(`group_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_batches` (
    `id` VARCHAR(191) NOT NULL,
    `inventory_item_id` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `available_quantity` INTEGER NOT NULL,
    `condition` ENUM('GOOD', 'NEEDS_ATTENTION', 'DAMAGED', 'INCOMPLETE', 'RETIRED') NOT NULL DEFAULT 'GOOD',
    `location_id` VARCHAR(191) NULL,
    `holder_id` VARCHAR(191) NULL,
    `qr_token_hash` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inventory_batches_qr_token_hash_key`(`qr_token_hash`),
    INDEX `inventory_batches_inventory_item_id_idx`(`inventory_item_id`),
    INDEX `inventory_batches_location_id_idx`(`location_id`),
    INDEX `inventory_batches_holder_id_idx`(`holder_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_assets` (
    `id` VARCHAR(191) NOT NULL,
    `inventory_item_id` VARCHAR(191) NOT NULL,
    `asset_tag` VARCHAR(100) NOT NULL,
    `serial_number` VARCHAR(200) NULL,
    `condition` ENUM('GOOD', 'NEEDS_ATTENTION', 'DAMAGED', 'INCOMPLETE', 'RETIRED') NOT NULL DEFAULT 'GOOD',
    `location_id` VARCHAR(191) NULL,
    `holder_id` VARCHAR(191) NULL,
    `qr_token_hash` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inventory_assets_qr_token_hash_key`(`qr_token_hash`),
    INDEX `inventory_assets_location_id_idx`(`location_id`),
    INDEX `inventory_assets_holder_id_idx`(`holder_id`),
    UNIQUE INDEX `inventory_assets_inventory_item_id_asset_tag_key`(`inventory_item_id`, `asset_tag`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_reservations` (
    `id` VARCHAR(191) NOT NULL,
    `shared_item_id` VARCHAR(191) NOT NULL,
    `batch_id` VARCHAR(191) NULL,
    `asset_id` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('ACTIVE', 'RELEASED', 'FULFILLED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `released_at` DATETIME(3) NULL,

    INDEX `inventory_reservations_shared_item_id_status_idx`(`shared_item_id`, `status`),
    INDEX `inventory_reservations_batch_id_status_idx`(`batch_id`, `status`),
    INDEX `inventory_reservations_asset_id_status_idx`(`asset_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_movements` (
    `id` VARCHAR(191) NOT NULL,
    `group_id` VARCHAR(191) NOT NULL,
    `batch_id` VARCHAR(191) NULL,
    `asset_id` VARCHAR(191) NULL,
    `type` ENUM('RESERVATION', 'RESERVATION_RELEASE', 'CHECKOUT', 'TRANSFER', 'RETURN', 'CORRECTION', 'CONDITION_CHANGE') NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `from_location_id` VARCHAR(191) NULL,
    `to_location_id` VARCHAR(191) NULL,
    `from_holder_id` VARCHAR(191) NULL,
    `to_holder_id` VARCHAR(191) NULL,
    `activity_id` VARCHAR(191) NULL,
    `actor_id` VARCHAR(191) NOT NULL,
    `details` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `inventory_movements_group_id_created_at_idx`(`group_id`, `created_at`),
    INDEX `inventory_movements_batch_id_created_at_idx`(`batch_id`, `created_at`),
    INDEX `inventory_movements_asset_id_created_at_idx`(`asset_id`, `created_at`),
    INDEX `inventory_movements_activity_id_created_at_idx`(`activity_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_damage_reports` (
    `id` VARCHAR(191) NOT NULL,
    `batch_id` VARCHAR(191) NULL,
    `asset_id` VARCHAR(191) NULL,
    `condition` ENUM('GOOD', 'NEEDS_ATTENTION', 'DAMAGED', 'INCOMPLETE', 'RETIRED') NOT NULL,
    `note` TEXT NULL,
    `photo_url` VARCHAR(2048) NULL,
    `reporter_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `inventory_damage_reports_batch_id_created_at_idx`(`batch_id`, `created_at`),
    INDEX `inventory_damage_reports_asset_id_created_at_idx`(`asset_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `inventory_items` ADD CONSTRAINT `inventory_items_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_storage_locations` ADD CONSTRAINT `inventory_storage_locations_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_batches` ADD CONSTRAINT `inventory_batches_inventory_item_id_fkey` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_batches` ADD CONSTRAINT `inventory_batches_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `inventory_storage_locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_batches` ADD CONSTRAINT `inventory_batches_holder_id_fkey` FOREIGN KEY (`holder_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_assets` ADD CONSTRAINT `inventory_assets_inventory_item_id_fkey` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_assets` ADD CONSTRAINT `inventory_assets_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `inventory_storage_locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_assets` ADD CONSTRAINT `inventory_assets_holder_id_fkey` FOREIGN KEY (`holder_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_reservations` ADD CONSTRAINT `inventory_reservations_shared_item_id_fkey` FOREIGN KEY (`shared_item_id`) REFERENCES `shared_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_reservations` ADD CONSTRAINT `inventory_reservations_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_reservations` ADD CONSTRAINT `inventory_reservations_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `inventory_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `inventory_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_activity_id_fkey` FOREIGN KEY (`activity_id`) REFERENCES `group_activities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_damage_reports` ADD CONSTRAINT `inventory_damage_reports_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_damage_reports` ADD CONSTRAINT `inventory_damage_reports_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `inventory_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_damage_reports` ADD CONSTRAINT `inventory_damage_reports_reporter_id_fkey` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
