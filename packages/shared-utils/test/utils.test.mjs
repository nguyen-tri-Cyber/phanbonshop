import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatVND,
  createMoneyVND,
  toVietnameseSlug,
  isValidVNPhoneNumber,
  normalizeVNPhoneNumber,
  VIETNAM_DIVISIONS,
  validateImageMagicBytes,
} from '../dist/index.js';

describe('Shared Utils Unit Tests', () => {

  describe('Currency Utils', () => {
    test('formatVND formats number to VND currency string', () => {
      const formatted = formatVND(150000);
      assert.ok(formatted.includes('150.000') || formatted.includes('150,000'));
      assert.ok(formatted.includes('₫') || formatted.includes('VND') || formatted.includes('đ'));
    });

    test('formatVND handles 0', () => {
      const formatted = formatVND(0);
      assert.ok(formatted.includes('0'));
    });

    test('createMoneyVND creates MoneyVND object', () => {
      const money = createMoneyVND(150000.4);
      assert.strictEqual(money.amount, 150000);
      assert.strictEqual(money.currency, 'VND');
    });
  });

  describe('Slug Utils', () => {
    test('toVietnameseSlug converts Vietnamese accented string to SEO-friendly slug', () => {
      const slug = toVietnameseSlug('Phân Bón NPK Đầu Trâu 20-20-15 Cao Cấp');
      assert.strictEqual(slug, 'phan-bon-npk-dau-trau-20-20-15-cao-cap');
    });

    test('toVietnameseSlug handles special characters and double spaces', () => {
      const slug = toVietnameseSlug('Đạm   Phú Mỹ (Bao 50kg) & Phân Lân!');
      assert.strictEqual(slug, 'dam-phu-my-bao-50kg-phan-lan');
    });
  });

  describe('Validation Utils', () => {
    test('isValidVNPhoneNumber validates Vietnamese mobile numbers', () => {
      assert.strictEqual(isValidVNPhoneNumber('0901234567'), true);
      assert.strictEqual(isValidVNPhoneNumber('0389998877'), true);
      assert.strictEqual(isValidVNPhoneNumber('+84901234567'), true);
      assert.strictEqual(isValidVNPhoneNumber('123456'), false);
      assert.strictEqual(isValidVNPhoneNumber('012345678901'), false);
      assert.strictEqual(isValidVNPhoneNumber('abcdefghij'), false);
    });

    test('normalizeVNPhoneNumber normalizes phone number', () => {
      assert.strictEqual(normalizeVNPhoneNumber('+84901234567'), '0901234567');
      assert.strictEqual(normalizeVNPhoneNumber('84901234567'), '0901234567');
      assert.strictEqual(normalizeVNPhoneNumber('0901234567'), '0901234567');
    });
  });

  describe('Image Magic Bytes Validation & SVG Blocking (AUD-P2-004)', () => {
    test('accepts valid JPEG buffer', () => {
      const buf = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(30)]);
      const res = validateImageMagicBytes(buf, 'photo.jpg', 'image/jpeg');
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.detectedFormat, 'jpeg');
      assert.strictEqual(res.mimeType, 'image/jpeg');
    });

    test('accepts valid PNG buffer', () => {
      const buf = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(30),
      ]);
      const res = validateImageMagicBytes(buf, 'image.png', 'image/png');
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.detectedFormat, 'png');
      assert.strictEqual(res.mimeType, 'image/png');
    });

    test('accepts valid GIF buffer', () => {
      const buf = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(20)]);
      const res = validateImageMagicBytes(buf, 'animation.gif', 'image/gif');
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.detectedFormat, 'gif');
      assert.strictEqual(res.mimeType, 'image/gif');
    });

    test('accepts valid WebP buffer', () => {
      const header = Buffer.alloc(16);
      header.write('RIFF', 0);
      header.writeUInt32LE(100, 4);
      header.write('WEBP', 8);
      const buf = Buffer.concat([header, Buffer.alloc(30)]);
      const res = validateImageMagicBytes(buf, 'banner.webp', 'image/webp');
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.detectedFormat, 'webp');
      assert.strictEqual(res.mimeType, 'image/webp');
    });

    test('blocks SVG by file extension', () => {
      const buf = Buffer.from('<svg></svg>');
      const res = validateImageMagicBytes(buf, 'icon.svg', 'image/svg+xml');
      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.includes('SVG'));
    });

    test('blocks SVG disguised as PNG with malicious SVG content', () => {
      const buf = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      const res = validateImageMagicBytes(buf, 'harmless.png', 'image/png');
      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.includes('SVG'));
    });

    test('blocks XML disguised as JPEG', () => {
      const buf = Buffer.from('<?xml version="1.0"?><svg><script></script></svg>');
      const res = validateImageMagicBytes(buf, 'fake.jpg', 'image/jpeg');
      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.includes('SVG') || res.error?.includes('định dạng'));
    });

    test('rejects arbitrary binary or script file', () => {
      const buf = Buffer.from('#!/bin/bash\necho "exploit"\n');
      const res = validateImageMagicBytes(buf, 'script.png', 'image/png');
      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.includes('định dạng'));
    });

    test('rejects buffer smaller than minimum required bytes', () => {
      const buf = Buffer.from([0x01, 0x02]);
      const res = validateImageMagicBytes(buf, 'tiny.jpg', 'image/jpeg');
      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.includes('quá nhỏ'));
    });
  });

  describe('Vietnam Administrative Divisions', () => {
    test('VIETNAM_DIVISIONS contains provinces', () => {
      assert.ok(Array.isArray(VIETNAM_DIVISIONS.provinces));
      assert.ok(VIETNAM_DIVISIONS.provinces.length > 0);
      const anGiang = VIETNAM_DIVISIONS.provinces.find((d) => d.name.includes('An Giang') || d.code === '89');
      assert.ok(anGiang, 'Should contain An Giang province');
    });
  });
});
