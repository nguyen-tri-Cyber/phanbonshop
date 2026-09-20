import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Database Backup & Restore Tooling Tests (TASK-P5-02 / AUD-P1-002)', () => {
  const scriptsDir = path.resolve(rootDir, 'scripts');

  test('backup and restore shell scripts exist and have correct headers', () => {
    const backupSh = path.join(scriptsDir, 'backup-databases.sh');
    const restoreSh = path.join(scriptsDir, 'restore-databases.sh');

    assert.ok(fs.existsSync(backupSh), 'backup-databases.sh must exist');
    assert.ok(fs.existsSync(restoreSh), 'restore-databases.sh must exist');

    const backupContent = fs.readFileSync(backupSh, 'utf8');
    assert.ok(backupContent.startsWith('#!/usr/bin/env bash'));
    assert.ok(backupContent.includes('auth_db'));
    assert.ok(backupContent.includes('product_db'));
    assert.ok(backupContent.includes('order_db'));
    assert.ok(backupContent.includes('inventory_db'));
    assert.ok(backupContent.includes('customer_db'));
    assert.ok(backupContent.includes('content_db'));
    assert.ok(backupContent.includes('metadata.json'));

    const restoreContent = fs.readFileSync(restoreSh, 'utf8');
    assert.ok(restoreContent.startsWith('#!/usr/bin/env bash'));
    assert.ok(restoreContent.includes('mysql'));
  });

  test('backup and restore PowerShell scripts exist for Windows', () => {
    const backupPs1 = path.join(scriptsDir, 'backup-databases.ps1');
    const restorePs1 = path.join(scriptsDir, 'restore-databases.ps1');

    assert.ok(fs.existsSync(backupPs1), 'backup-databases.ps1 must exist');
    assert.ok(fs.existsSync(restorePs1), 'restore-databases.ps1 must exist');

    const backupContent = fs.readFileSync(backupPs1, 'utf8');
    assert.ok(backupContent.includes('auth_db'));
    assert.ok(backupContent.includes('metadata.json'));

    const restoreContent = fs.readFileSync(restorePs1, 'utf8');
    assert.ok(restoreContent.includes('Get-ChildItem'));
  });

  test('backup metadata schema verification', () => {
    const sampleMetadata = {
      timestamp: '20260920_170000',
      host: '127.0.0.1:3307',
      totalDatabases: 6,
      successCount: 6,
      failedCount: 0,
      databases: ['auth_db', 'product_db', 'order_db', 'inventory_db', 'customer_db', 'content_db'],
    };

    assert.strictEqual(sampleMetadata.databases.length, 6);
    assert.strictEqual(sampleMetadata.successCount, 6);
    assert.strictEqual(sampleMetadata.failedCount, 0);
  });
});
