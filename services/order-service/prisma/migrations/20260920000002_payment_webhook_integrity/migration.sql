-- Bind provider callbacks to the exact payment attempt and make provider
-- transaction processing durable/idempotent at the database boundary.
ALTER TABLE `payment_transactions`
  ADD COLUMN `providerOrderId` VARCHAR(100) NULL,
  ADD COLUMN `providerRequestId` VARCHAR(100) NULL,
  ADD COLUMN `providerTransactionId` VARCHAR(100) NULL;

CREATE INDEX `payment_transactions_provider_providerOrderId_idx`
  ON `payment_transactions`(`provider`, `providerOrderId`);
CREATE UNIQUE INDEX `payment_transactions_provider_order_request_key`
  ON `payment_transactions`(`provider`, `providerOrderId`, `providerRequestId`);
CREATE UNIQUE INDEX `payment_transactions_provider_transaction_key`
  ON `payment_transactions`(`provider`, `providerTransactionId`);

ALTER TABLE `compensation_tasks`
  MODIFY COLUMN `type` ENUM('RELEASE_INVENTORY', 'COMMIT_INVENTORY') NOT NULL DEFAULT 'RELEASE_INVENTORY',
  ADD COLUMN `idempotencyKey` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `compensation_tasks_idempotencyKey_key`
  ON `compensation_tasks`(`idempotencyKey`);
