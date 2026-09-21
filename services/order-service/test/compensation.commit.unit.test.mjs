import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CompensationTaskStatus,
  CompensationTaskType,
} from '../generated/client/index.js';
import { CompensationService } from '../dist/compensation/compensation.service.js';

process.env.INTERNAL_SERVICE_SECRET ||= 'runtime-unit-test-internal-secret';
process.env.INVENTORY_SERVICE_URL ||= 'http://127.0.0.1:3004';

test('COMMIT_INVENTORY task calls the idempotent commit endpoint and completes', async () => {
  let completed = false;
  let calledWith;
  const prisma = {
    compensationTask: {
      update: async ({ data }) => {
        completed = data.status === CompensationTaskStatus.COMPLETED;
        return data;
      },
    },
  };
  const service = new CompensationService(prisma);
  service.callInventoryCommit = async (...args) => {
    calledWith = args;
    return true;
  };
  const task = {
    id: 'commit-task-1',
    type: CompensationTaskType.COMMIT_INVENTORY,
    payload: JSON.stringify({
      reservationId: 'reservation-1-variant-1',
      referenceId: 'DH-20260920-WEBHOOK',
      requestId: 'request-1',
    }),
    status: CompensationTaskStatus.PROCESSING,
    retryCount: 0,
    maxRetries: 60,
  };

  assert.equal(await service.executeTask(task), true);
  assert.deepEqual(calledWith, [
    'reservation-1-variant-1',
    'DH-20260920-WEBHOOK',
    'request-1',
  ]);
  assert.equal(completed, true);
});
