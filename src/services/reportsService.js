const TeachingRecords = require("../models/teachingRecordsModel");
const Teacher = require("../models/teacherModel");
const Week = require("../models/weekModel");
const Subject = require("../models/subjectModel");
const Class = require("../models/classesModel");
const ExcelJS = require("exceljs");

const getMonthFromWeek = (week) => {
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

// Cập nhật hàm createBCSheet trong src/services/reportsService.js

const createBCSheet = async (workbook, sheetName, teacher, subject, mainClass, records, weeksInMonth, bcNumber, schoolYear) => {
  const worksheet = workbook.addWorksheet(sheetName.substring(0, 31));
  
  worksheet.columns = [
    { width: 5 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 12 },
    { width: 10 },
    { width: 12 },
    { width: 14 },
    { width: 14 }
  ];

  worksheet.getCell('A1').value = 'SỞ GD&ĐT TỈNH VĨNH LONG';
  worksheet.getCell('A1').font = { size: 10 };
  worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'none' };
  
  worksheet.getCell('A2').value = 'TRUNG TÂM GDNN-GDTX MỎ CÀY NAM';
  worksheet.getCell('A2').font = { size: 10, bold: true };
  worksheet.getCell('A2').fill = { type: 'pattern', pattern: 'none' };

  worksheet.mergeCells('A4:L4');
  worksheet.getCell('A4').value = `BẢNG KÊ GIỜ THÁNG ${String(bcNumber).padStart(2, '0')} NĂM HỌC ${schoolYear} (BIÊN CHẾ)`;
  worksheet.getCell('A4').font = { size: 14, bold: true };
  worksheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getCell('A4').fill = { type: 'pattern', pattern: 'none' };

  worksheet.mergeCells('A5:L5');
  worksheet.getCell('A5').value = `Môn : ${subject?.name || 'Toán'}`;
  worksheet.getCell('A5').font = { size: 11, bold: true };
  worksheet.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getCell('A5').fill = { type: 'pattern', pattern: 'none' };

  worksheet.getCell('A7').value = `Họ và tên giáo viên:   ${teacher.name}`;
  worksheet.getCell('A7').font = { size: 11 };
  worksheet.getCell('A7').fill = { type: 'pattern', pattern: 'none' };

  worksheet.getCell('A8').value = '* Phân công giảng dạy:';
  worksheet.getCell('A8').font = { size: 10 };
  worksheet.getCell('A8').fill = { type: 'pattern', pattern: 'none' };
  
  // Tính toán thông tin phân công cho từng loại tiết dạy
  const classInfo = {};
  const teachingRecords = records.filter(r => r.recordType === 'teaching' || !r.recordType);
  
  teachingRecords.forEach(r => {
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
  worksheet.getCell('B8').font = { size: 10 };
  worksheet.getCell('B8').fill = { type: 'pattern', pattern: 'none' };

  // Tính tổng tiết giảng dạy (chỉ teaching)
  const totalTeachingPerWeek = Math.round(teachingRecords.reduce((sum, r) => sum + (r.periods || 0), 0) / weeksCount);
  worksheet.mergeCells('H9:L9');
  worksheet.getCell('H9').value = `Tổng cộng số tiết giảng dạy/tuần: ${String(totalTeachingPerWeek).padStart(2, '0')} Tiết`;
  worksheet.getCell('H9').font = { size: 10 };
  worksheet.getCell('H9').alignment = { horizontal: 'left' };
  worksheet.getCell('H9').fill = { type: 'pattern', pattern: 'none' };

  worksheet.getCell('A10').value = '* Phân công kiêm nhiệm:';
  worksheet.getCell('A10').font = { size: 10 };
  worksheet.getCell('A10').fill = { type: 'pattern', pattern: 'none' };
  
  worksheet.getCell('B10').value = `-Chủ nhiệm lớp: ${mainClass?.name || '..........'}. tiết/tuần`;
  worksheet.getCell('B10').font = { size: 10 };
  worksheet.getCell('B10').fill = { type: 'pattern', pattern: 'none' };
  
  // Tính tổng tiết kiêm nhiệm
  const extraRecords = records.filter(r => r.recordType === 'extra');
  const totalExtraPerWeek = Math.round(extraRecords.reduce((sum, r) => sum + (r.periods || 0), 0) / weeksCount);
  
  worksheet.getCell('B11').value = `-Kiêm nhiệm: ${totalExtraPerWeek > 0 ? totalExtraPerWeek : '.............'} tiết/tuần`;
  worksheet.getCell('B11').font = { size: 10 };
  worksheet.getCell('B11').fill = { type: 'pattern', pattern: 'none' };
  
  worksheet.mergeCells('H11:L11');
  worksheet.getCell('H11').value = `Tổng cộng số tiết kiêm nhiệm/tuần: ${totalExtraPerWeek > 0 ? String(totalExtraPerWeek).padStart(2, '0') : '......'} tiết.`;
  worksheet.getCell('H11').font = { size: 10 };
  worksheet.getCell('H11').alignment = { horizontal: 'left' };
  worksheet.getCell('H11').fill = { type: 'pattern', pattern: 'none' };

  // Tạo header bảng
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
    worksheet.getCell(`${col}14`).alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
  }

  const headerCells = ['A13','A14','B13','B14','C13','C14','D14','E14','F14','G13','G14','H13','H14','I13','I14','J13','J14','K13','K14','L13','L14'];
  headerCells.forEach(addr => {
    const cell = worksheet.getCell(addr);
    cell.font = { bold: true, size: 9 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
    cell.fill = { type: 'pattern', pattern: 'none' };
  });

  let rowIndex = 15;
  
  // Định nghĩa các loại tiết dạy
  const categories = [
    { label: 'Khối 12', grades: ['12'], recordTypes: ['teaching', null, undefined] },
    { label: 'Khối 11', grades: ['11'], recordTypes: ['teaching', null, undefined] },
    { label: 'Khối 10', grades: ['10'], recordTypes: ['teaching', null, undefined] },
    { label: 'TN-HN 1', grades: [], recordTypes: ['tn-hn1'] },
    { label: 'TN-HN 2', grades: [], recordTypes: ['tn-hn2'] },
    { label: 'TN-HN 3', grades: [], recordTypes: ['tn-hn3'] },
    { label: 'Kiêm nhiệm', grades: [], recordTypes: ['extra'] },
    { label: 'Coi thi', grades: [], recordTypes: ['exam'] },
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
        
        // Lọc bản ghi theo tuần và loại tiết dạy
        const weekRecs = records.filter(r => {
          const rWeekId = r.weekId?._id?.toString() || r.weekId?.toString();
          const rType = r.recordType || 'teaching';
          const rGrade = r.classId?.grade;
          
          // Kiểm tra tuần
          if (rWeekId !== weekId) return false;
          
          // Kiểm tra loại tiết dạy
          if (!cat.recordTypes.includes(rType)) return false;
          
          // Nếu có grades (Khối 10, 11, 12), kiểm tra khối
          if (cat.grades.length > 0) {
            return cat.grades.includes(rGrade);
          }
          
          // Nếu không có grades (TN-HN, Kiêm nhiệm, Coi thi), chỉ cần đúng recordType
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

    // Format border cho từng cell trong dòng
    for (let c = 0; c < 12; c++) {
      const cell = worksheet.getCell(rowIndex, c + 1);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = { type: 'pattern', pattern: 'none' };
    }
    rowIndex++;
  });

  // Dòng tổng cộng
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
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
    cell.font = { bold: true, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'none' };
  }
  
  rowIndex += 2;

  // Footer
  worksheet.getCell(`A${rowIndex}`).value = 'Số tiền đề nghị thanh toán...............................đồng. (Ghi bằng chữ:.......................................................................)';
  worksheet.getCell(`A${rowIndex}`).font = { size: 10 };
  worksheet.getCell(`A${rowIndex}`).fill = { type: 'pattern', pattern: 'none' };
  
  rowIndex += 2;
  const today = new Date();
  const dateStr = `Mỏ Cày, ngày ${String(today.getDate()).padStart(2, '0')} tháng ${String(today.getMonth() + 1).padStart(2, '0')} năm ${today.getFullYear()}`;
  
  worksheet.getCell(`D${rowIndex}`).value = dateStr;
  worksheet.getCell(`D${rowIndex}`).font = { size: 10, italic: true };
  worksheet.getCell(`D${rowIndex}`).fill = { type: 'pattern', pattern: 'none' };
  
  worksheet.getCell(`J${rowIndex}`).value = dateStr;
  worksheet.getCell(`J${rowIndex}`).font = { size: 10, italic: true };
  worksheet.getCell(`J${rowIndex}`).fill = { type: 'pattern', pattern: 'none' };
  
  rowIndex++;
  worksheet.getCell(`A${rowIndex}`).value = 'PHÓ GIÁM ĐỐC';
  worksheet.getCell(`A${rowIndex}`).font = { bold: true, size: 10 };
  worksheet.getCell(`A${rowIndex}`).fill = { type: 'pattern', pattern: 'none' };
  
  worksheet.getCell(`D${rowIndex}`).value = 'TỔ TRƯỞNG DUYỆT';
  worksheet.getCell(`D${rowIndex}`).font = { bold: true, size: 10 };
  worksheet.getCell(`D${rowIndex}`).fill = { type: 'pattern', pattern: 'none' };
  
  worksheet.getCell(`J${rowIndex}`).value = 'GIÁO VIÊN KÊ GIỜ';
  worksheet.getCell(`J${rowIndex}`).font = { bold: true, size: 10 };
  worksheet.getCell(`J${rowIndex}`).fill = { type: 'pattern', pattern: 'none' };

  worksheet.getRow(4).height = 25;
  worksheet.getRow(13).height = 25;
  worksheet.getRow(14).height = 50;
};

const exportReport = async (teacherIds, schoolYear, options = {}) => {
  try {
    const { type = 'bc', bcNumber, weekId, weekIds, semester } = options;
    const teacherIdArray = Array.isArray(teacherIds) ? teacherIds : [teacherIds];

    const allWeeks = await Week.find({}).sort({ weekNumber: 1 });
    
    const workbook = new ExcelJS.Workbook();
    let sheetCount = 0;

    for (const teacherId of teacherIdArray) {
      const teacher = await Teacher.findById(teacherId)
        .populate('subjectIds', 'name')
        .populate('mainClassId', 'name grade');
      
      if (!teacher) {
        continue;
      }

      let query = { teacherId: teacherId, schoolYear: schoolYear };
      
      if (type === 'week' && weekId) {
        query.weekId = weekId;
      } else if (type === 'week' && weekIds && weekIds.length > 0) {
        query.weekId = { $in: weekIds };
      } else if (type === 'semester' && semester) {
        const semesterWeeks = allWeeks.filter(w => {
          const wn = w.weekNumber || 0;
          return semester === 1 ? (wn >= 1 && wn <= 18) : (wn >= 19 && wn <= 35);
        });
        query.weekId = { $in: semesterWeeks.map(w => w._id) };
      }

      const records = await TeachingRecords.find(query)
        .populate("weekId", "weekNumber startDate endDate")
        .populate("subjectId", "name")
        .populate("classId", "name grade")
        .sort({ "weekId.weekNumber": 1 });

      if (records.length === 0) {
        continue;
      }

      const monthGroups = groupRecordsByMonth(records, allWeeks);
      
      let monthsToExport = Object.keys(monthGroups).map(Number);
      
      if (bcNumber) {
        monthsToExport = monthsToExport.filter(m => m === bcNumber);
      }

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

    if (sheetCount === 0) {
      return { 
        success: false, 
        statusCode: 404, 
        message: `Không tìm thấy dữ liệu giảng dạy cho năm học ${schoolYear}.\n\nGiáo viên chưa nhập tiết dạy hoặc dữ liệu thuộc năm học khác.` 
      };
    }

    return { success: true, data: { workbook, sheetCount } };
  } catch (error) {
    return { 
      success: false, 
      statusCode: 500, 
      message: "Lỗi hệ thống khi xuất báo cáo. Vui lòng thử lại sau!" 
    };
  }
};

const exportBCReport = async (teacherIds, schoolYear, bcNumber) => {
  return await exportReport(teacherIds, schoolYear, { type: 'bc', bcNumber });
};

const exportMonthReport = async (teacherId, schoolYear, month, bcNumber = null) => {
  const bc = bcNumber || month;
  return await exportReport(teacherId, schoolYear, { type: 'bc', bcNumber: bc });
};

const exportWeekReport = async (teacherId, weekId, schoolYear) => {
  const week = await Week.findById(weekId);
  if (!week) return { success: false, statusCode: 404, message: "Không tìm thấy tuần học" };
  
  if (!schoolYear) {
    const weekDate = new Date(week.startDate);
    const year = weekDate.getFullYear();
    const month = weekDate.getMonth() + 1;
    schoolYear = month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  }
  
  return await exportReport(teacherId, schoolYear, { type: 'week', weekId });
};

const exportWeekRangeReport = async (teacherId, weekIds, schoolYear) => {
  if (!weekIds || weekIds.length === 0) {
    return { success: false, statusCode: 400, message: "Phải cung cấp weekIds" };
  }
  
  const week = await Week.findById(weekIds[0]);
  if (!week) return { success: false, statusCode: 404, message: "Không tìm thấy tuần học" };
  
  if (!schoolYear) {
    const weekDate = new Date(week.startDate);
    const year = weekDate.getFullYear();
    const month = weekDate.getMonth() + 1;
    schoolYear = month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  }
  
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

const getBCReport = async (teacherId, schoolYear, bcNumber) => {
  try {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return { success: false, statusCode: 404, message: "Không tìm thấy giáo viên" };

    const records = await TeachingRecords.find({ teacherId, schoolYear })
      .populate("weekId", "weekNumber startDate endDate")
      .populate("subjectId", "name")
      .populate("classId", "name grade");

    if (records.length === 0) {
      return { 
        success: false, 
        statusCode: 404, 
        message: `Không có dữ liệu giảng dạy cho năm học ${schoolYear}` 
      };
    }

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
    return { success: false, statusCode: 500, message: "Lỗi hệ thống: " + error.message };
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

    if (records.length === 0) {
      return { 
        success: false, 
        statusCode: 404, 
        message: filters.schoolYear 
          ? `Không có dữ liệu giảng dạy cho năm học ${filters.schoolYear}` 
          : "Không có dữ liệu giảng dạy" 
      };
    }

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
    return { success: false, statusCode: 500, message: "Lỗi hệ thống: " + error.message };
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