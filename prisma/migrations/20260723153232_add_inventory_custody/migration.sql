-- CreateTable
CREATE TABLE `inventory_custodies` (
    `id` VARCHAR(191) NOT NULL,
    `batch_id` VARCHAR(191) NULL,
    `asset_id` VARCHAR(191) NULL,
    `holder_id` VARCHAR(191) NOT NULL,
    `activity_id` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `purpose` VARCHAR(500) NULL,
    `checked_out_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `due_at` DATETIME(3) NULL,
    `returned_at` DATETIME(3) NULL,

    INDEX `inventory_custodies_batch_id_returned_at_idx`(`batch_id`, `returned_at`),
    INDEX `inventory_custodies_asset_id_returned_at_idx`(`asset_id`, `returned_at`),
    INDEX `inventory_custodies_holder_id_returned_at_idx`(`holder_id`, `returned_at`),
    INDEX `inventory_custodies_activity_id_idx`(`activity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `inventory_custodies` ADD CONSTRAINT `inventory_custodies_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_custodies` ADD CONSTRAINT `inventory_custodies_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `inventory_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_custodies` ADD CONSTRAINT `inventory_custodies_holder_id_fkey` FOREIGN KEY (`holder_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_custodies` ADD CONSTRAINT `inventory_custodies_activity_id_fkey` FOREIGN KEY (`activity_id`) REFERENCES `group_activities`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
