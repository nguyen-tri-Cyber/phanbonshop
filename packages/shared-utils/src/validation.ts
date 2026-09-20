/**
 * Kiểm tra số điện thoại di động Việt Nam hợp lệ
 * Đầu số phổ biến: 03, 05, 07, 08, 09 (gồm 10 chữ số) hoặc +84...
 */
export function isValidVNPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s.-]/g, '');
  const vnPhoneRegex = /^(0|\+84)(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/;
  return vnPhoneRegex.test(cleaned);
}

/**
 * Chuẩn hóa số điện thoại về định dạng 10 số bắt đầu bằng 0
 */
export function normalizeVNPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[\s.-]/g, '');
  if (cleaned.startsWith('+84')) {
    return '0' + cleaned.slice(3);
  }
  if (cleaned.startsWith('84') && cleaned.length === 11) {
    return '0' + cleaned.slice(2);
  }
  return cleaned;
}

export interface ImageValidationResult {
  valid: boolean;
  detectedFormat?: 'jpeg' | 'png' | 'webp' | 'gif';
  mimeType?: string;
  error?: string;
}

/**
 * Thẩm định tệp tin hình ảnh thông qua Magic Bytes header và chặn hoàn toàn SVG.
 *
 * Quy tắc Magic Bytes chuẩn:
 * - JPEG: FF D8 FF
 * - PNG:  89 50 4E 47 0D 0A 1A 0A
 * - GIF:  47 49 46 38 (GIF87a / GIF89a)
 * - WEBP: 52 49 46 46 (RIFF) + 57 45 42 50 (WEBP) tại offset 8..11
 *
 * Chặn SVG:
 * - Tên file đuôi: .svg, .svgz
 * - MIME type khai báo: image/svg+xml
 * - Sniffing nội dung byte: Phát hiện <svg, <?xml, <!DOCTYPE svg trong 512 bytes đầu
 */
export function validateImageMagicBytes(
  buffer: Buffer | Uint8Array,
  originalname?: string,
  declaredMimetype?: string,
): ImageValidationResult {
  if (!buffer) {
    return {
      valid: false,
      error: 'Dữ liệu tệp hình ảnh không được để trống',
    };
  }

  // 1. Chặn SVG tuyệt đối từ tên file hoặc declared mimetype
  if (originalname) {
    const ext = originalname.toLowerCase().split('.').pop();
    if (ext === 'svg' || ext === 'svgz') {
      return {
        valid: false,
        error: 'Tệp định dạng SVG bị từ chối vì lý do an toàn bảo mật (nguy cơ XSS/Script Injection). Vui lòng dùng JPG, PNG hoặc WebP.',
      };
    }
  }

  if (declaredMimetype && declaredMimetype.toLowerCase().includes('svg')) {
    return {
      valid: false,
      error: 'Định dạng MIME image/svg+xml bị chặn vì nguy cơ bảo mật XSS.',
    };
  }

  if (buffer.length < 12) {
    return {
      valid: false,
      error: 'Tập tin hình ảnh quá nhỏ hoặc không hợp lệ (dưới 12 bytes)',
    };
  }

  // 2. Chặn SVG ẩn danh qua Magic Bytes sniffing (nếu đổi đuôi file thành .png/.jpg nhưng nội dung là XML/SVG)
  const headerSlice = buffer.subarray(0, Math.min(512, buffer.length));
  const headerStr = Buffer.from(headerSlice).toString('utf-8').toLowerCase().trim();
  if (
    headerStr.startsWith('<?xml') ||
    headerStr.startsWith('<svg') ||
    headerStr.includes('<!doctype svg') ||
    headerStr.includes('<svg')
  ) {
    return {
      valid: false,
      error: 'Phát hiện nội dung mã XML/SVG được ngụy trang trong tệp ảnh. Hệ thống từ chối vì nguy cơ an ninh.',
    };
  }

  // 3. Kiểm tra Magic Bytes cho các định dạng ảnh raster an toàn
  const b = buffer;

  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return {
      valid: true,
      detectedFormat: 'jpeg',
      mimeType: 'image/jpeg',
    };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return {
      valid: true,
      detectedFormat: 'png',
      mimeType: 'image/png',
    };
  }

  // GIF: GIF87a hoặc GIF89a (47 49 46 38 37 61 hoặc 47 49 46 38 39 61)
  if (
    b[0] === 0x47 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x38 &&
    (b[4] === 0x37 || b[4] === 0x39) &&
    b[5] === 0x61
  ) {
    return {
      valid: true,
      detectedFormat: 'gif',
      mimeType: 'image/gif',
    };
  }

  // WebP: RIFF (bytes 0..3) + WEBP (bytes 8..11)
  // 'R' = 0x52, 'I' = 0x49, 'F' = 0x46, 'F' = 0x46
  // 'W' = 0x57, 'E' = 0x45, 'B' = 0x42, 'P' = 0x50
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return {
      valid: true,
      detectedFormat: 'webp',
      mimeType: 'image/webp',
    };
  }

  return {
    valid: false,
    error: 'Tệp không khớp với cấu trúc byte (Magic Bytes) của bất kỳ định dạng ảnh hợp lệ nào (JPG, PNG, WEBP, GIF).',
  };
}

