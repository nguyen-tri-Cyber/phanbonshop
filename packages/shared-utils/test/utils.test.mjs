import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatVND, createMoneyVND, toVietnameseSlug, isValidVNPhoneNumber, normalizeVNPhoneNumber, VIETNAM_DIVISIONS } from '../dist/index.js';

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

  describe('Vietnam Administrative Divisions', () => {
    test('VIETNAM_DIVISIONS contains provinces', () => {
      assert.ok(Array.isArray(VIETNAM_DIVISIONS.provinces));
      assert.ok(VIETNAM_DIVISIONS.provinces.length > 0);
      const anGiang = VIETNAM_DIVISIONS.provinces.find((d) => d.name.includes('An Giang') || d.code === '89');
      assert.ok(anGiang, 'Should contain An Giang province');
    });
  });
});
