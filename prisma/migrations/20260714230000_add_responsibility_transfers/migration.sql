CREATE TABLE `responsibility_transfers` (
  `id` VARCHAR(191) NOT NULL,
  `shared_item_id` VARCHAR(191) NOT NULL,
  `from_user_id` VARCHAR(191) NOT NULL,
  `to_user_id` VARCHAR(191) NOT NULL,
  `quantity` INTEGER NOT NULL,
  `status` ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `responded_at` DATETIME(3) NULL,
  INDEX `responsibility_transfers_to_user_id_status_idx` (`to_user_id`, `status`),
  INDEX `responsibility_transfers_shared_item_id_status_idx` (`shared_item_id`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `responsibility_transfers_shared_item_id_fkey` FOREIGN KEY (`shared_item_id`) REFERENCES `shared_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `responsibility_transfers_from_user_id_fkey` FOREIGN KEY (`from_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `responsibility_transfers_to_user_id_fkey` FOREIGN KEY (`to_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
