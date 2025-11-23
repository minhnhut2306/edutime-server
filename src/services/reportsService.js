// ==================== UPDATED: src/services/reportsService.js ====================

const TeachingRecords = require("../models/teachingRecordsModel");
const Teacher = require("../models/teacherModel");
const Week = require("../models/weekModel");
const Subject = require("../models/subjectModel");
const Class = require("../models/classesModel");
const ExcelJS = require("exceljs");

// ==================== HELPER FUNCTIONS ====================

const getMonthFromWeek = (week, schoolYear) => {
  if (!week || !week.startDate) return 9;
  const startDate = new Date(week.startDate);
  return startDate.getMonth() + 1;
};

const getWeeksInMonth = async (month, schoolYear) => {
  const allWeeks = await Week.find({}).sort({ weekNumber: 1 });
  const [startYear, endYear] = schoolYear.split('-').map(Number);
  const year = month >= 9 ? startYear : endYear;
  
  return allWeeks.filter(week => {
    const weekStart = new Date(week.startDate);
    const weekEnd = new Date(week.endDate);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    return weekStart <= monthEnd && weekEnd >= monthStart;
  });
};

const groupRecordsByMonth = (records, weeks) => {
  const groups = {};
  
  records.forEach(record => {
    const weekId = record.weekId?._id?.toString() || record.weekId?.toString();
    const week = weeks.find(w => (w._id?.toString() || w.id) === weekId);
    
    if (week) {
      const month = getMonthFromWeek(week);
      if (!groups[month]) {
        groups[month] = { month, records: [], weeks: new Set() };
      }
      groups[month].records.push(record);
      groups[month].weeks.add(week._id?.toString() || week.id);
    }
  });
  
  return groups;
};

// ✅ FIX: Tạo sheet Excel theo mẫu chuẩn
const createBCSheet = async (workbook, sheetName, teacher, subject, mainClass, records, weeksInMonth, bcNumber, schoolYear) => {
  const worksheet = workbook.addWorksheet(sheetName.substring(0, 31));
  
  worksheet.columns = [
    { width: 5 }, { width: 14 }, { width: 12 }, { width: 12 }, 
    { width: 12 }, { width: 12 }, { width: 14 }, { width: 12 }, 
    { width: 10 }, { width: 12 }, { width: 14 }, { width: 14 }
  ];

  // HEADER
  worksheet.getCell('A1').value = 'SỞ GD&ĐT TỈNH VĨNH LONG';
  worksheet.getCell('A1').font = { size: 10 };
  
  worksheet.getCell('A2').value = 'TRUNG TÂM GDNN-GDTX MỎ CÀY NAM';
  worksheet.getCell('A2').font = { size: 10, bold: true };

  // TIÊU ĐỀ
  worksheet.mergeCells('A4:L4');
  worksheet.getCell('A4').value = `BẢNG KÊ GIỜ THÁNG ${String(bcNumber).padStart(2, '0')} NĂM HỌC ${schoolYear} (BIÊN CHẾ)`;
  worksheet.getCell('A4').font = { size: 14, bold: true };
  worksheet.getCell('A4').alignment = { horizontal: 'center' };

  // MÔN HỌC
  worksheet.mergeCells('A5:L5');
  worksheet.getCell('A5').value = `Môn : ${subject?.name || ''}`;
  worksheet.getCell('A5').font = { size: 11, bold: true };
  worksheet.getCell('A5').alignment = { horizontal: 'center' };

  // HỌ TÊN GV
  worksheet.getCell('A7').value = `Họ và tên giáo viên:   ${teacher.name}`;

  // PHÂN CÔNG GIẢNG DẠY
  worksheet.getCell('A8').value = '* Phân công giảng dạy:';
  
  const classInfo = {};
  records.forEach(r => {
    const className = r.classId?.name || '';
    if (className && !classInfo[className]) {
      classInfo[className] = 0;
    }
    if (className) classInfo[className] += r.periods || 0;
  });
  
  let phanCongParts = [];
  const weeksCount = Math.max(weeksInMonth.length, 1);
  Object.keys(classInfo).forEach(cls => {
    const avgPeriods = Math.round(classInfo[cls] / weeksCount);
    phanCongParts.push(`Lớp: ${cls} giảng dạy ${avgPeriods} tiết/tuần`);
  });
  worksheet.getCell('B8').value = phanCongParts.length > 0 ? `- ${phanCongParts.join('; ')}` : '';

  // TỔNG SỐ TIẾT/TUẦN
  const totalPerWeek = Math.round(records.reduce((sum, r) => sum + (r.periods || 0), 0) / weeksCount);
  worksheet.mergeCells('H9:L9');
  worksheet.getCell('H9').value = `Tổng cộng số tiết giảng dạy/tuần: ${String(totalPerWeek).padStart(2, '0')} Tiết`;

  // PHÂN CÔNG KIÊM NHIỆM
  worksheet.getCell('A10').value = '* Phần công kiêm nhiệm:';
  worksheet.getCell('B10').value = `-Chủ nhiệm lớp: ${mainClass?.name || '..........'}. tiết/tuần`;
  worksheet.getCell('B11').value = '-Kiêm nhiệm: ............. tiết/ tuần';
  worksheet.mergeCells('H11:L11');
  worksheet.getCell('H11').value = 'Tổng cộng số tiết kiêm nhiệm/tuần: ...... tiết.';

  // TABLE HEADER
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

  // Tuần headers
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
    worksheet.getCell(`${col}14`).alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
  }

  // Style header
  ['A13','A14','B13','B14','C13','C14','D14','E14','F14','G13','G14','H13','H14','I13','I14','J13','J14','K13','K14','L13','L14'].forEach(addr => {
    const cell = worksheet.getCell(addr);
    cell.font = { bold: true, size: 9 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });

  // DATA ROWS
  let rowIndex = 15;
  const categories = [
    { label: 'Khối 12', grades: ['12'] },
    { label: 'Khối 11', grades: ['11'] },
    { label: 'Khối 10', grades: ['10'] },
    { label: 'TN-HN 1', grades: [] },
    { label: 'TN-HN 2', grades: [] },
    { label: 'TN-HN 3', grades: [] },
    { label: 'Kiêm nhiệm', grades: [] },
    { label: 'Coi thi', grades: [] },
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
      
      if (weeks[i] && cat.grades.length > 0) {
        const weekId = weeks[i]._id?.toString();
        const weekRecs = records.filter(r => {
          const rWeekId = r.weekId?._id?.toString() || r.weekId?.toString();
          const rGrade = r.classId?.grade;
          return rWeekId === weekId && cat.grades.includes(rGrade);
        });
        weekPeriods = weekRecs.reduce((sum, r) => sum + (r.periods || 0), 0);
      }
      
      worksheet.getCell(`${col}${rowIndex}`).value = weekPeriods;
      rowTotal += weekPeriods;
      weekTotals[i] += weekPeriods;
    }
    
    worksheet.getCell(`G${rowIndex}`).value = rowTotal;
    grandTotal += rowTotal;

    // Border
    for (let c = 0; c < 12; c++) {
      const cell = worksheet.getCell(rowIndex, c + 1);
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
    rowIndex++;
  });

  // TỔNG CỘNG
  worksheet.getCell(`B${rowIndex}`).value = 'Tổng cộng';
  worksheet.getCell(`B${rowIndex}`).font = { bold: true };
  
  for (let i = 0; i < 4; i++) {
    worksheet.getCell(rowIndex, 3 + i).value = weekTotals[i];
  }
  
  const standardHours = 68;
  worksheet.getCell(`G${rowIndex}`).value = grandTotal;
  worksheet.getCell(`H${rowIndex}`).value = standardHours;
  worksheet.getCell(`I${rowIndex}`).value = grandTotal - standardHours;

  for (let c = 0; c < 12; c++) {
    const cell = worksheet.getCell(rowIndex, c + 1);
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }
  
  rowIndex += 2;

  // FOOTER
  worksheet.getCell(`A${rowIndex}`).value = 'Số tiền đề nghị thanh toán...............................đồng. (Ghi bằng chữ:.......................................................................)';
  
  rowIndex += 2;
  const today = new Date();
  const dateStr = `Mỏ Cày, ngày ${String(today.getDate()).padStart(2, '0')} tháng ${String(today.getMonth() + 1).padStart(2, '0')} năm ${today.getFullYear()}`;
  
  worksheet.getCell(`D${rowIndex}`).value = dateStr;
  worksheet.getCell(`J${rowIndex}`).value = dateStr;
  
  rowIndex++;
  worksheet.getCell(`A${rowIndex}`).value = 'PHÓ GIÁM ĐỐC';
  worksheet.getCell(`A${rowIndex}`).font = { bold: true };
  worksheet.getCell(`D${rowIndex}`).value = 'TỔ TRƯỞNG DUYỆT';
  worksheet.getCell(`D${rowIndex}`).font = { bold: true };
  worksheet.getCell(`J${rowIndex}`).value = 'GIÁO VIÊN KÊ GIỜ';
  worksheet.getCell(`J${rowIndex}`).font = { bold: true };

  worksheet.getRow(4).height = 25;
  worksheet.getRow(13).height = 25;
  worksheet.getRow(14).height = 50;
};

// ==================== MAIN EXPORT FUNCTION ====================

/**
 * ✅ FIX: Xuất Excel báo cáo - DÙNG CHUNG CHO TẤT CẢ LOẠI
 */
const exportReport = async (teacherIds, schoolYear, options = {}) => {
  try {
    const { type = 'bc', bcNumber, weekId, weekIds, semester } = options;
    const teacherIdArray = Array.isArray(teacherIds) ? teacherIds : [teacherIds];
    
    console.log("📊 exportReport SERVICE - Start:", { teacherIdArray, schoolYear, type, bcNumber, weekId });

    // Lấy tất cả weeks
    const allWeeks = await Week.find({}).sort({ weekNumber: 1 });
    
    const workbook = new ExcelJS.Workbook();
    let sheetCount = 0;

    for (const teacherId of teacherIdArray) {
      // Lấy thông tin GV
      const teacher = await Teacher.findById(teacherId)
        .populate('subjectIds', 'name')
        .populate('mainClassId', 'name grade');
      
      if (!teacher) {
        console.warn(`⚠️ Không tìm thấy giáo viên: ${teacherId}`);
        continue;
      }

      console.log(`📝 Processing teacher: ${teacher.name} (${teacherId})`);

      // ✅ FIX: Xây dựng query chính xác
      let query = { teacherId: teacherId, schoolYear: schoolYear };
      
      if (type === 'week' && weekId) {
        query.weekId = weekId;
        console.log(`🔍 Filtering by weekId: ${weekId}`);
      } else if (type === 'week' && weekIds && weekIds.length > 0) {
        query.weekId = { $in: weekIds };
        console.log(`🔍 Filtering by weekIds: ${weekIds.join(',')}`);
      } else if (type === 'semester' && semester) {
        const semesterWeeks = allWeeks.filter(w => {
          const wn = w.weekNumber || 0;
          return semester === 1 ? (wn >= 1 && wn <= 18) : (wn >= 19 && wn <= 35);
        });
        query.weekId = { $in: semesterWeeks.map(w => w._id) };
        console.log(`🔍 Filtering by semester ${semester}: ${semesterWeeks.length} weeks`);
      }

      // ✅ FIX: Fetch records
      const records = await TeachingRecords.find(query)
        .populate("weekId", "weekNumber startDate endDate")
        .populate("subjectId", "name")
        .populate("classId", "name grade")
        .sort({ "weekId.weekNumber": 1 });

      console.log(`📋 Found ${records.length} records for ${teacher.name}`);

      if (records.length === 0) {
        console.warn(`⚠️ Không có dữ liệu cho ${teacher.name} với query:`, query);
        continue;
      }

      // Group records theo tháng
      const monthGroups = groupRecordsByMonth(records, allWeeks);
      
      let monthsToExport = Object.keys(monthGroups).map(Number);
      if (bcNumber) {
        monthsToExport = monthsToExport.filter(m => m === bcNumber);
      }

      console.log(`📅 Months to export: ${monthsToExport.join(',')}`);

      // Tạo sheet cho mỗi tháng
      for (const month of monthsToExport.sort((a, b) => {
        const orderA = a >= 9 ? a - 9 : a + 3;
        const orderB = b >= 9 ? b - 9 : b + 3;
        return orderA - orderB;
      })) {
        const monthData = monthGroups[month];
        if (!monthData || monthData.records.length === 0) continue;

        const weeksInMonth = await getWeeksInMonth(month, schoolYear);

        const teacherShortName = teacher.name.split(' ').pop();
        const sheetName = teacherIdArray.length > 1 
          ? `BC${month}_${teacherShortName}`
          : `BC ${month}`;

        console.log(`📄 Creating sheet: ${sheetName}`);

        await createBCSheet(
          workbook,
          sheetName,
          teacher,
          teacher.subjectIds?.[0] || null,
          teacher.mainClassId,
          monthData.records,
          weeksInMonth,
          month,
          schoolYear
        );
        sheetCount++;
      }
    }

    console.log(`✅ Total sheets created: ${sheetCount}`);

    if (sheetCount === 0) {
      return { 
        success: false, 
        statusCode: 404, 
        message: "Không có dữ liệu để xuất. Vui lòng kiểm tra:\n- Giáo viên đã tạo bản ghi chưa?\n- Bản ghi đã được liên kết với tuần học chưa?\n- Năm học có khớp không?" 
      };
    }

    return { success: true, data: { workbook, sheetCount } };
  } catch (error) {
    console.error("❌ exportReport ERROR:", error);
    return { 
      success: false, 
      statusCode: 500, 
      message: "Lỗi khi xuất báo cáo: " + error.message 
    };
  }
};

// ==================== WRAPPER FUNCTIONS ====================

const exportBCReport = async (teacherIds, schoolYear, bcNumber) => {
  return await exportReport(teacherIds, schoolYear, { type: 'bc', bcNumber });
};

const exportMonthReport = async (teacherId, schoolYear, month, bcNumber = null) => {
  const bc = bcNumber || month;
  return await exportReport(teacherId, schoolYear, { type: 'bc', bcNumber: bc });
};

const exportWeekReport = async (teacherId, weekId) => {
  const week = await Week.findById(weekId);
  if (!week) return { success: false, statusCode: 404, message: "Không tìm thấy tuần" };
  
  const weekDate = new Date(week.startDate);
  const year = weekDate.getFullYear();
  const month = weekDate.getMonth() + 1;
  const schoolYear = month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  
  return await exportReport(teacherId, schoolYear, { type: 'week', weekId });
};

const exportWeekRangeReport = async (teacherId, weekIds) => {
  if (!weekIds || weekIds.length === 0) {
    return { success: false, statusCode: 400, message: "Phải cung cấp weekIds" };
  }
  
  const week = await Week.findById(weekIds[0]);
  if (!week) return { success: false, statusCode: 404, message: "Không tìm thấy tuần" };
  
  const weekDate = new Date(week.startDate);
  const year = weekDate.getFullYear();
  const month = weekDate.getMonth() + 1;
  const schoolYear = month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  
  return await exportReport(teacherId, schoolYear, { type: 'week', weekIds });
};

const exportSemesterReport = async (teacherId, schoolYear, semester) => {
  return await exportReport(teacherId, schoolYear, { type: 'semester', semester });
};

const exportYearReport = async (teacherId, schoolYear) => {
  return await exportReport(teacherId, schoolYear, { type: 'year' });
};

const exportAllBCReport = async (teacherId, schoolYear) => {
  return await exportReport(teacherId, schoolYear, { type: 'year' });
};

// ==================== GET REPORT (JSON) ====================

const getBCReport = async (teacherId, schoolYear, bcNumber) => {
  try {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return { success: false, statusCode: 404, message: "Không tìm thấy giáo viên" };

    const records = await TeachingRecords.find({ teacherId, schoolYear })
      .populate("weekId", "weekNumber startDate endDate")
      .populate("subjectId", "name")
      .populate("classId", "name grade");

    return {
      success: true,
      data: {
        teacher: { id: teacher._id, name: teacher.name },
        schoolYear,
        bcNumber,
        records,
        totalPeriods: records.reduce((sum, r) => sum + (r.periods || 0), 0),
      },
    };
  } catch (error) {
    return { success: false, statusCode: 500, message: error.message };
  }
};

const getTeacherReport = async (teacherId, type, filters = {}) => {
  try {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return { success: false, statusCode: 404, message: "Không tìm thấy giáo viên" };

    let query = { teacherId };
    if (filters.schoolYear) query.schoolYear = filters.schoolYear;

    const records = await TeachingRecords.find(query)
      .populate("weekId", "weekNumber startDate endDate")
      .populate("subjectId", "name")
      .populate("classId", "name grade")
      .sort({ "weekId.weekNumber": 1 });

    if (records.length === 0) return { success: false, statusCode: 404, message: "Không có dữ liệu" };

    return {
      success: true,
      data: {
        teacher: { id: teacher._id, name: teacher.name },
        type,
        filters,
        records,
        statistics: {
          totalPeriods: records.reduce((sum, r) => sum + (r.periods || 0), 0),
          totalRecords: records.length,
        },
      },
    };
  } catch (error) {
    return { success: false, statusCode: 500, message: error.message };
  }
};

module.exports = {
  exportReport,
  getBCReport,
  exportBCReport,
  exportAllBCReport,
  getTeacherReport,
  exportMonthReport,
  exportWeekReport,
  exportWeekRangeReport,
  exportSemesterReport,
  exportYearReport,
};