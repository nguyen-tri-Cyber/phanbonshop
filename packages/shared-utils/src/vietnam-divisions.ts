import { VietnamDivisionsDataset } from '@phanbonshop/shared-types';

export const VIETNAM_DIVISIONS_VERSION = '2024.1';

/**
 * Bộ dữ liệu hành chính Tỉnh / Quận / Huyện / Phường / Xã Việt Nam phiên bản 2024.1
 * Cung cấp mã chuẩn GSO và tên địa danh chính thức phục vụ logistics nông nghiệp.
 */
export const VIETNAM_DIVISIONS: VietnamDivisionsDataset = {
  version: VIETNAM_DIVISIONS_VERSION,
  updatedAt: '2026-09-19',
  provinces: [
    // 1. Đồng Bằng Sông Cửu Long (Trọng điểm lúa gạo & cây ăn trái)
    {
      code: '89',
      name: 'Tỉnh An Giang',
      districts: [
        {
          code: '883',
          name: 'Thành phố Long Xuyên',
          wards: [
            { code: '30340', name: 'Phường Mỹ Bình' },
            { code: '30343', name: 'Phường Mỹ Long' },
            { code: '30346', name: 'Phường Mỹ Xuyên' },
            { code: '30349', name: 'Phường Bình Khánh' },
            { code: '30352', name: 'Phường Mỹ Phước' },
          ],
        },
        {
          code: '884',
          name: 'Thành phố Châu Đốc',
          wards: [
            { code: '30355', name: 'Phường Châu Phú A' },
            { code: '30358', name: 'Phường Châu Phú B' },
            { code: '30361', name: 'Phường Vĩnh Mỹ' },
          ],
        },
        {
          code: '886',
          name: 'Huyện Chợ Mới',
          wards: [
            { code: '30400', name: 'Thị trấn Chợ Mới' },
            { code: '30403', name: 'Xã Kiến An' },
            { code: '30406', name: 'Xã Mỹ Hội Đông' },
            { code: '30409', name: 'Xã Long Điền A' },
            { code: '30412', name: 'Xã Long Điền B' },
          ],
        },
        {
          code: '889',
          name: 'Huyện Thoại Sơn',
          wards: [
            { code: '30430', name: 'Thị trấn Núi Sập' },
            { code: '30433', name: 'Xã Định Mỹ' },
            { code: '30436', name: 'Xã Thoại Giang' },
          ],
        },
      ],
    },
    {
      code: '87',
      name: 'Tỉnh Đồng Tháp',
      districts: [
        {
          code: '866',
          name: 'Thành phố Cao Lãnh',
          wards: [
            { code: '30001', name: 'Phường 1' },
            { code: '30004', name: 'Phường 2' },
            { code: '30007', name: 'Phường Mỹ Phú' },
            { code: '30010', name: 'Xã Mỹ Tân' },
          ],
        },
        {
          code: '867',
          name: 'Thành phố Sa Đéc',
          wards: [
            { code: '30013', name: 'Phường 1' },
            { code: '30016', name: 'Phường 2' },
            { code: '30019', name: 'Phường Tân Quy Đông' },
            { code: '30022', name: 'Xã Tân Khánh Đông' },
          ],
        },
        {
          code: '870',
          name: 'Huyện Lấp Vò',
          wards: [
            { code: '30070', name: 'Thị trấn Lấp Vò' },
            { code: '30073', name: 'Xã Bình Thành' },
            { code: '30076', name: 'Xã Vĩnh Thạnh' },
          ],
        },
        {
          code: '871',
          name: 'Huyện Lai Vung',
          wards: [
            { code: '30080', name: 'Thị trấn Lai Vung' },
            { code: '30083', name: 'Xã Phong Hòa' },
            { code: '30086', name: 'Xã Tân Phước' },
          ],
        },
      ],
    },
    {
      code: '92',
      name: 'Thành phố Cần Thơ',
      districts: [
        {
          code: '916',
          name: 'Quận Ninh Kiều',
          wards: [
            { code: '31147', name: 'Phường Tân An' },
            { code: '31150', name: 'Phường An Cư' },
            { code: '31153', name: 'Phường An Hòa' },
            { code: '31156', name: 'Phường Xuân Khánh' },
            { code: '31159', name: 'Phường Hưng Lợi' },
          ],
        },
        {
          code: '918',
          name: 'Quận Cái Răng',
          wards: [
            { code: '31174', name: 'Phường Lê Bình' },
            { code: '31177', name: 'Phường Hưng Phú' },
            { code: '31180', name: 'Phường Hưng Thạnh' },
            { code: '31183', name: 'Phường Ba Láng' },
          ],
        },
        {
          code: '923',
          name: 'Huyện Phong Điền',
          wards: [
            { code: '31210', name: 'Thị trấn Phong Điền' },
            { code: '31213', name: 'Xã Nhơn Ái' },
            { code: '31216', name: 'Xã Giai Xuân' },
            { code: '31219', name: 'Xã Mỹ Khánh' },
          ],
        },
        {
          code: '924',
          name: 'Huyện Thới Lai',
          wards: [
            { code: '31230', name: 'Thị trấn Thới Lai' },
            { code: '31233', name: 'Xã Định Môn' },
            { code: '31236', name: 'Xã Trường Thắng' },
          ],
        },
      ],
    },
    {
      code: '82',
      name: 'Tỉnh Tiền Giang',
      districts: [
        {
          code: '815',
          name: 'Thành phố Mỹ Tho',
          wards: [
            { code: '28300', name: 'Phường 1' },
            { code: '28303', name: 'Phường 2' },
            { code: '28306', name: 'Phường 5' },
            { code: '28309', name: 'Phường Đạo Thạnh' },
          ],
        },
        {
          code: '819',
          name: 'Huyện Cái Bè',
          wards: [
            { code: '28350', name: 'Thị trấn Cái Bè' },
            { code: '28353', name: 'Xã Đông Hòa Hiệp' },
            { code: '28356', name: 'Xã An Cư' },
          ],
        },
        {
          code: '820',
          name: 'Huyện Cai Lậy',
          wards: [
            { code: '28370', name: 'Thị trấn Bình Phú' },
            { code: '28373', name: 'Xã Tam Bình' },
            { code: '28376', name: 'Xã Long Trung' },
          ],
        },
        {
          code: '821',
          name: 'Huyện Châu Thành',
          wards: [
            { code: '28390', name: 'Thị trấn Tân Hiệp' },
            { code: '28393', name: 'Xã Thân Cửu Nghĩa' },
            { code: '28396', name: 'Xã Long An' },
          ],
        },
      ],
    },
    {
      code: '91',
      name: 'Tỉnh Kiên Giang',
      districts: [
        {
          code: '899',
          name: 'Thành phố Rạch Giá',
          wards: [
            { code: '30700', name: 'Phường Vĩnh Thanh Vân' },
            { code: '30703', name: 'Phường Vĩnh Thanh' },
            { code: '30706', name: 'Phường Vĩnh Quang' },
            { code: '30709', name: 'Phường An Hòa' },
          ],
        },
        {
          code: '900',
          name: 'Thành phố Hà Tiên',
          wards: [
            { code: '30720', name: 'Phường Bình San' },
            { code: '30723', name: 'Phường Đông Hồ' },
            { code: '30726', name: 'Phường Pháo Đài' },
          ],
        },
        {
          code: '905',
          name: 'Huyện Tân Hiệp',
          wards: [
            { code: '30790', name: 'Thị trấn Tân Hiệp' },
            { code: '30793', name: 'Xã Thạnh Đông' },
            { code: '30796', name: 'Xã Thạnh Trị' },
          ],
        },
      ],
    },
    {
      code: '96',
      name: 'Tỉnh Cà Mau',
      districts: [
        {
          code: '964',
          name: 'Thành phố Cà Mau',
          wards: [
            { code: '32200', name: 'Phường 1' },
            { code: '32203', name: 'Phường 2' },
            { code: '32206', name: 'Phường 5' },
            { code: '32209', name: 'Phường Tân Thành' },
          ],
        },
        {
          code: '967',
          name: 'Huyện Trần Văn Thời',
          wards: [
            { code: '32260', name: 'Thị trấn Trần Văn Thời' },
            { code: '32263', name: 'Xã Khánh Bình Tây' },
            { code: '32266', name: 'Xã Lợi An' },
          ],
        },
      ],
    },

    // 2. Tây Nguyên (Vùng chuyên canh Cà phê, Tiêu, Sầu riêng, Cao su)
    {
      code: '66',
      name: 'Tỉnh Đắk Lắk',
      districts: [
        {
          code: '643',
          name: 'Thành phố Buôn Ma Thuột',
          wards: [
            { code: '24301', name: 'Phường Thắng Lợi' },
            { code: '24304', name: 'Phường Tân Lợi' },
            { code: '24307', name: 'Phường Tân Lập' },
            { code: '24310', name: 'Phường Tự An' },
            { code: '24313', name: 'Xã Hòa Phú' },
          ],
        },
        {
          code: '645',
          name: 'Huyện Krông Búk',
          wards: [
            { code: '24330', name: 'Xã Chư Kbô' },
            { code: '24333', name: 'Xã Pơng Drang' },
            { code: '24336', name: 'Xã Tân Lập' },
          ],
        },
        {
          code: '647',
          name: 'Huyện Cư M\'gar',
          wards: [
            { code: '24360', name: 'Thị trấn Quảng Phú' },
            { code: '24363', name: 'Xã Cuôr Đăng' },
            { code: '24366', name: 'Xã Ea Kpam' },
          ],
        },
      ],
    },
    {
      code: '68',
      name: 'Tỉnh Lâm Đồng',
      districts: [
        {
          code: '672',
          name: 'Thành phố Đà Lạt',
          wards: [
            { code: '24790', name: 'Phường 1' },
            { code: '24793', name: 'Phường 2' },
            { code: '24796', name: 'Phường 8' },
            { code: '24799', name: 'Phường 10' },
          ],
        },
        {
          code: '673',
          name: 'Thành phố Bảo Lộc',
          wards: [
            { code: '24810', name: 'Phường 1' },
            { code: '24813', name: 'Phường 2' },
            { code: '24816', name: 'Phường B\'Lao' },
            { code: '24819', name: 'Xã Lộc Châu' },
          ],
        },
        {
          code: '676',
          name: 'Huyện Đức Trọng',
          wards: [
            { code: '24850', name: 'Thị trấn Liên Nghĩa' },
            { code: '24853', name: 'Xã Hiệp Thạnh' },
            { code: '24856', name: 'Xã Phú Hội' },
          ],
        },
      ],
    },
    {
      code: '64',
      name: 'Tỉnh Gia Lai',
      districts: [
        {
          code: '622',
          name: 'Thành phố Pleiku',
          wards: [
            { code: '23600', name: 'Phường Diên Hồng' },
            { code: '23603', name: 'Phường Hoa Lư' },
            { code: '23606', name: 'Phường Tây Sơn' },
          ],
        },
        {
          code: '624',
          name: 'Huyện Chư Sê',
          wards: [
            { code: '23640', name: 'Thị trấn Chư Sê' },
            { code: '23643', name: 'Xã Dun' },
            { code: '23646', name: 'Xã Ia Blang' },
          ],
        },
      ],
    },

    // 3. Đông Nam Bộ & Các Đô Thị Lớn (Trung tâm phân phối logistics)
    {
      code: '79',
      name: 'Thành phố Hồ Chí Minh',
      districts: [
        {
          code: '760',
          name: 'Quận 1',
          wards: [
            { code: '26734', name: 'Phường Bến Nghé' },
            { code: '26737', name: 'Phường Bến Thành' },
            { code: '26740', name: 'Phường Đa Kao' },
            { code: '26743', name: 'Phường Tân Định' },
          ],
        },
        {
          code: '769',
          name: 'Thành phố Thủ Đức',
          wards: [
            { code: '26840', name: 'Phường Thảo Điền' },
            { code: '26843', name: 'Phường An Phú' },
            { code: '26846', name: 'Phường Linh Trung' },
            { code: '26849', name: 'Phường Hiệp Phú' },
          ],
        },
        {
          code: '778',
          name: 'Huyện Củ Chi',
          wards: [
            { code: '27040', name: 'Thị trấn Củ Chi' },
            { code: '27043', name: 'Xã Tân An Hội' },
            { code: '27046', name: 'Xã Nhuận Đức' },
            { code: '27049', name: 'Xã Thái Mỹ' },
          ],
        },
        {
          code: '779',
          name: 'Huyện Hóc Môn',
          wards: [
            { code: '27070', name: 'Thị trấn Hóc Môn' },
            { code: '27073', name: 'Xã Tân Thới Nhì' },
            { code: '27076', name: 'Xã Xuân Thới Thượng' },
          ],
        },
      ],
    },
    {
      code: '75',
      name: 'Tỉnh Đồng Nai',
      districts: [
        {
          code: '731',
          name: 'Thành phố Biên Hòa',
          wards: [
            { code: '26001', name: 'Phường Quyết Thắng' },
            { code: '26004', name: 'Phường Trung Dũng' },
            { code: '26007', name: 'Phường Tam Hiệp' },
            { code: '26010', name: 'Phường Long Bình' },
          ],
        },
        {
          code: '732',
          name: 'Thành phố Long Khánh',
          wards: [
            { code: '26020', name: 'Phường Xuân An' },
            { code: '26023', name: 'Phường Xuân Bình' },
            { code: '26026', name: 'Xã Hàng Gòn' },
          ],
        },
        {
          code: '736',
          name: 'Huyện Định Quán',
          wards: [
            { code: '26070', name: 'Thị trấn Định Quán' },
            { code: '26073', name: 'Xã Gia Canh' },
            { code: '26076', name: 'Xã Phú Ngọc' },
          ],
        },
      ],
    },
    {
      code: '74',
      name: 'Tỉnh Bình Dương',
      districts: [
        {
          code: '718',
          name: 'Thành phố Thủ Dầu Một',
          wards: [
            { code: '25600', name: 'Phường Phú Cường' },
            { code: '25603', name: 'Phường Hiệp Thành' },
            { code: '25606', name: 'Phường Chánh Nghĩa' },
          ],
        },
        {
          code: '723',
          name: 'Thành phố Bến Cát',
          wards: [
            { code: '25660', name: 'Phường Mỹ Phước' },
            { code: '25663', name: 'Phường Thới Hòa' },
            { code: '25666', name: 'Xã An Điền' },
          ],
        },
      ],
    },

    // 4. Miền Bắc & Thủ Đô
    {
      code: '01',
      name: 'Thành phố Hà Nội',
      districts: [
        {
          code: '001',
          name: 'Quận Ba Đình',
          wards: [
            { code: '00001', name: 'Phường Phúc Xá' },
            { code: '00004', name: 'Phường Trúc Bạch' },
            { code: '00006', name: 'Phường Vĩnh Phúc' },
          ],
        },
        {
          code: '002',
          name: 'Quận Hoàn Kiếm',
          wards: [
            { code: '00037', name: 'Phường Hàng Bạc' },
            { code: '00040', name: 'Phường Hàng Đào' },
            { code: '00043', name: 'Phường Tràng Tiền' },
          ],
        },
        {
          code: '019',
          name: 'Huyện Đông Anh',
          wards: [
            { code: '00400', name: 'Thị trấn Đông Anh' },
            { code: '00403', name: 'Xã Kim Nỗ' },
            { code: '00406', name: 'Xã Hải Bối' },
          ],
        },
      ],
    },
    {
      code: '31',
      name: 'Thành phố Hải Phòng',
      districts: [
        {
          code: '303',
          name: 'Quận Hồng Bàng',
          wards: [
            { code: '11001', name: 'Phường Hoàng Văn Thụ' },
            { code: '11004', name: 'Phường Minh Khai' },
          ],
        },
        {
          code: '312',
          name: 'Huyện An Dương',
          wards: [
            { code: '11200', name: 'Thị trấn An Dương' },
            { code: '11203', name: 'Xã Lê Lợi' },
          ],
        },
      ],
    },
    {
      code: '48',
      name: 'Thành phố Đà Nẵng',
      districts: [
        {
          code: '490',
          name: 'Quận Hải Châu',
          wards: [
            { code: '20194', name: 'Phường Hải Châu 1' },
            { code: '20197', name: 'Phường Hải Châu 2' },
            { code: '20200', name: 'Phường Thạch Thang' },
          ],
        },
        {
          code: '497',
          name: 'Huyện Hòa Vang',
          wards: [
            { code: '20300', name: 'Xã Hòa Châu' },
            { code: '20303', name: 'Xã Hòa Phước' },
            { code: '20306', name: 'Xã Hòa Tiến' },
          ],
        },
      ],
    },
  ],
};

/**
 * Lấy danh sách toàn bộ Tỉnh / Thành phố
 */
export function getProvinces(): Array<{ code: string; name: string }> {
  return VIETNAM_DIVISIONS.provinces.map((p) => ({ code: p.code, name: p.name }));
}

/**
 * Lấy danh sách Quận / Huyện thuộc Tỉnh
 */
export function getDistricts(provinceCode: string): Array<{ code: string; name: string }> {
  const province = VIETNAM_DIVISIONS.provinces.find((p) => p.code === provinceCode);
  if (!province) return [];
  return province.districts.map((d) => ({ code: d.code, name: d.name }));
}

/**
 * Lấy danh sách Phường / Xã thuộc Huyện
 */
export function getWards(provinceCode: string, districtCode: string): Array<{ code: string; name: string }> {
  const province = VIETNAM_DIVISIONS.provinces.find((p) => p.code === provinceCode);
  if (!province) return [];
  const district = province.districts.find((d) => d.code === districtCode);
  if (!district) return [];
  return district.wards;
}

/**
 * Tra cứu thông tin đầy đủ tên theo bộ mã
 */
export function lookupDivisionNames(
  provinceCode: string,
  districtCode: string,
  wardCode: string,
): { provinceName: string; districtName: string; wardName: string } | null {
  const province = VIETNAM_DIVISIONS.provinces.find((p) => p.code === provinceCode);
  if (!province) return null;
  const district = province.districts.find((d) => d.code === districtCode);
  if (!district) return null;
  const ward = district.wards.find((w) => w.code === wardCode);
  if (!ward) return null;

  return {
    provinceName: province.name,
    districtName: district.name,
    wardName: ward.name,
  };
}
