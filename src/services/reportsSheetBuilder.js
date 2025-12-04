const createBCSheet = async (
  workbook,
  sheetName,
  teacher,
  subject,
  mainClass,
  records,
  weeksInMonth,
  bcNumber,
  schoolYearLabel
) => {
  const worksheet = workbook.addWorksheet(sheetName.substring(0, 31));

  worksheet.views = [{ showGridLines: false }];
  worksheet.columns = [
    { width: 5 }, { width: 14 }, { width: 12 }, { width: 12 },
    { width: 12 }, { width: 12 }, { width: 14 }, { width: 12 },
    { width: 10 }, { width: 12 }, { width: 14 }, { width: 14 }
  ];

  worksheet.getCell('A1').value = 'SỞ GD&ĐT TỈNH VĨNH LONG';
  worksheet.getCell('A1').font = { size: 10 };

  worksheet.getCell('A2').value = 'TRUNG TÂM GDNN-GDTX MỎ CÀY NAM';
  worksheet.getCell('A2').font = { size: 10, bold: true };

  worksheet.mergeCells('A4:L4');
  worksheet.getCell('A4').value = `BẢNG KÊ GIỜ THÁNG ${String(bcNumber).padStart(2, '0')} NĂM HỌC ${schoolYearLabel || ''} (BIÊN CHẾ)`;
  worksheet.getCell('A4').font = { size: 14, bold: true };
  worksheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.mergeCells('A5:L5');
  worksheet.getCell('A5').value = `Môn : ${subject?.name || 'Toán'}`;
  worksheet.getCell('A5').font = { size: 11, bold: true };
  worksheet.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' };

  worksheet.getCell('A7').value = `Họ và tên giáo viên:   ${teacher.name}`;
  worksheet.getCell('A7').font = { size: 11 };

  worksheet.getCell('A8').value = '* Phân công giảng dạy:';
  worksheet.getCell('A8').font = { size: 10 };

  const classInfo = {};
  const teachingRecords = records.filter(r => r.recordType === 'teaching' || !r.recordType);

  teachingRecords.forEach(r => {
    const className = r.classId?.name || '';
    if (className && !classInfo[className]) classInfo[className] = 0;
    if (className) classInfo[className] += r.periods || 0;
  });

  const phanCongParts = [];
  const weeksCount = Math.max(weeksInMonth.length, 1);
  Object.keys(classInfo).forEach(cls => {
    const avgPeriods = Math.round(classInfo[cls] / weeksCount);
    phanCongParts.push(`Lớp: ${cls} giảng dạy ${avgPeriods} tiết/tuần`);
  });

  worksheet.getCell('B8').value = phanCongParts.length > 0 ? `- ${phanCongParts.join('; ')}` : '';
  worksheet.getCell('B8').font = { size: 10 };

  const totalTeachingPerWeek = Math.round(
    teachingRecords.reduce((sum, r) => sum + (r.periods || 0), 0) / weeksCount
  );
  worksheet.mergeCells('H9:L9');
  worksheet.getCell('H9').value = `Tổng cộng số tiết giảng dạy/tuần: ${String(totalTeachingPerWeek).padStart(2, '0')} Tiết`;
  worksheet.getCell('H9').font = { size: 10 };
  worksheet.getCell('H9').alignment = { horizontal: 'left' };

  worksheet.getCell('A10').value = '* Phân công kiêm nhiệm:';
  worksheet.getCell('A10').font = { size: 10 };

  worksheet.getCell('B10').value = `-Chủ nhiệm lớp: ${mainClass?.name || '..........'}. tiết/tuần`;
  worksheet.getCell('B10').font = { size: 10 };

  const extraRecords = records.filter(r => r.recordType === 'extra');
  const totalExtraPerWeek = Math.round(
    extraRecords.reduce((sum, r) => sum + (r.periods || 0), 0) / weeksCount
  );

  worksheet.getCell('B11').value = `-Kiêm nhiệm: ${totalExtraPerWeek > 0 ? totalExtraPerWeek : '.............'} tiết/tuần`;
  worksheet.getCell('B11').font = { size: 10 };

  worksheet.mergeCells('H11:L11');
  worksheet.getCell('H11').value = `Tổng cộng số tiết kiêm nhiệm/tuần: ${
    totalExtraPerWeek > 0 ? String(totalExtraPerWeek).padStart(2, '0') : '......'
  } tiết.`;
  worksheet.getCell('H11').font = { size: 10 };
  worksheet.getCell('H11').alignment = { horizontal: 'left' };

  worksheet.mergeCells('A13:A14');
  worksheet.mergeCells('B13:B14');
  worksheet.mergeCells('C13:F13');
  worksheet.mergeCells('G13:G14');
  worksheet.mergeCells('H13:H14');
  worksheet.mergeCells('I13:I14');
  worksheet.mergeCells('J13:J14');
  worksheet.mergeCells('K13:K14');
  worksheet.mergeCells('L13:L14');

  worksheet.getCell('A13').value = 'TT';
  worksheet.getCell('B13').value = 'Phân công';
  worksheet.getCell('C13').value = 'THỜI GIAN';
  worksheet.getCell('G13').value = 'Tổng số tiết thực dạy, kiêm nhiệm';
  worksheet.getCell('H13').value = 'Giờ tiêu chuẩn';
  worksheet.getCell('I13').value = 'Giờ dư';
  worksheet.getCell('J13').value = 'Đơn giá';
  worksheet.getCell('K13').value = 'Thành tiền';
  worksheet.getCell('L13').value = 'Phụ chú';

  const weeks = weeksInMonth.slice(0, 4);
  for (let i = 0; i < 4; i++) {
    const col = String.fromCharCode(67 + i);
    if (weeks[i]) {
      const s = new Date(weeks[i].startDate);
      const e = new Date(weeks[i].endDate);
      worksheet.getCell(`${col}14`).value = `Tuần ${i + 1}\nTừ ${s.toLocaleDateString('vi-VN')}\nđến ${e.toLocaleDateString('vi-VN')}`;
    } else {
      worksheet.getCell(`${col}14`).value = `Tuần ${i + 1}`;
    }
    worksheet.getCell(`${col}14`).alignment = {
      wrapText: true,
      vertical: 'middle',
      horizontal: 'center'
    };
  }

  const headerCells = [
    'A13', 'A14', 'B13', 'B14',
    'C13', 'C14', 'D14', 'E14', 'F14',
    'G13', 'G14',
    'H13', 'H14',
    'I13', 'I14',
    'J13', 'J14',
    'K13', 'K14',
    'L13', 'L14'
  ];

  headerCells.forEach(addr => {
    const cell = worksheet.getCell(addr);
    cell.font = { bold: true, size: 9 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  let rowIndex = 15;

  const categories = [
    { label: 'Khối 12', grades: ['12'], recordTypes: ['teaching', null, undefined] },
    { label: 'Khối 11', grades: ['11'], recordTypes: ['teaching', null, undefined] },
    { label: 'Khối 10', grades: ['10'], recordTypes: ['teaching', null, undefined] },
    { label: 'TN-HN 1', grades: [], recordTypes: ['tn-hn1'] },
    { label: 'TN-HN 2', grades: [], recordTypes: ['tn-hn2'] },
    { label: 'TN-HN 3', grades: [], recordTypes: ['tn-hn3'] },
    { label: 'Kiêm nhiệm', grades: [], recordTypes: ['extra'] },
    { label: 'Coi thi', grades: [], recordTypes: ['exam'] }
  ];

  let grandTotal = 0;
  const weekTotals = [0, 0, 0, 0];

  categories.forEach((cat, idx) => {
    worksheet.getCell(`A${rowIndex}`).value = idx + 1;
    worksheet.getCell(`B${rowIndex}`).value = cat.label;

    let rowTotal = 0;

    for (let i = 0; i < 4; i++) {
      const col = String.fromCharCode(67 + i);
      let weekPeriods = 0;

      if (weeks[i]) {
        const weekId = weeks[i]._id?.toString();

        const weekRecs = records.filter(r => {
          const rWeekId = r.weekId?._id?.toString() || r.weekId?.toString();
          const rType = r.recordType || 'teaching';
          const rGrade = r.classId?.grade;

          if (rWeekId !== weekId) return false;
          if (!cat.recordTypes.includes(rType)) return false;
          if (cat.grades.length > 0) return cat.grades.includes(rGrade);
          return true;
        });

        weekPeriods = weekRecs.reduce((sum, r) => sum + (r.periods || 0), 0);
      }

      worksheet.getCell(`${col}${rowIndex}`).value = weekPeriods;
      rowTotal += weekPeriods;
      weekTotals[i] += weekPeriods;
    }

    worksheet.getCell(`G${rowIndex}`).value = rowTotal;
    grandTotal += rowTotal;

    for (let c = 0; c < 12; c++) {
      const cell = worksheet.getCell(rowIndex, c + 1);
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
    rowIndex++;
  });

  worksheet.getCell(`B${rowIndex}`).value = 'Tổng cộng';
  worksheet.getCell(`B${rowIndex}`).font = { bold: true, size: 10 };

  for (let i = 0; i < 4; i++) {
    worksheet.getCell(rowIndex, 3 + i).value = weekTotals[i];
  }

  const standardHours = 68;
  worksheet.getCell(`G${rowIndex}`).value = grandTotal;
  worksheet.getCell(`H${rowIndex}`).value = standardHours;
  worksheet.getCell(`I${rowIndex}`).value = grandTotal - standardHours;

  for (let c = 0; c < 12; c++) {
    const cell = worksheet.getCell(rowIndex, c + 1);
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    cell.font = { bold: true, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  rowIndex += 2;

  worksheet.getCell(`A${rowIndex}`).value =
    'Số tiền đề nghị thanh toán...............................đồng. (Ghi bằng chữ:.......................................................................)';
  worksheet.getCell(`A${rowIndex}`).font = { size: 10 };

  rowIndex += 2;
  const today = new Date();
  const dateStr = `Mỏ Cày, ngày ${String(today.getDate()).padStart(2, '0')} tháng ${String(
    today.getMonth() + 1
  ).padStart(2, '0')} năm ${today.getFullYear()}`;

  worksheet.getCell(`D${rowIndex}`).value = dateStr;
  worksheet.getCell(`D${rowIndex}`).font = { size: 10, italic: true };

  worksheet.getCell(`J${rowIndex}`).value = dateStr;
  worksheet.getCell(`J${rowIndex}`).font = { size: 10, italic: true };

  rowIndex++;
  worksheet.getCell(`A${rowIndex}`).value = 'PHÓ GIÁM ĐỐC';
  worksheet.getCell(`A${rowIndex}`).font = { bold: true, size: 10 };

  worksheet.getCell(`D${rowIndex}`).value = 'TỔ TRƯỞNG DUYỆT';
  worksheet.getCell(`D${rowIndex}`).font = { bold: true, size: 10 };

  worksheet.getCell(`J${rowIndex}`).value = 'GIÁO VIÊN KÊ GIỜ';
  worksheet.getCell(`J${rowIndex}`).font = { bold: true, size: 10 };

  worksheet.getRow(4).height = 25;
  worksheet.getRow(13).height = 25;
  worksheet.getRow(14).height = 50;
};

module.exports = {
  createBCSheet,
};


