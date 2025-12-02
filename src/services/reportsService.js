const mongoose = require("mongoose");
const TeachingRecords = require("../models/teachingRecordsModel");
const Teacher = require("../models/teacherModel");
const Week = require("../models/weekModel");
const SchoolYear = require("../models/schoolYearModel");
const ExcelJS = require("exceljs");

const isValidObjectId = (id) => !!(id && mongoose.Types.ObjectId.isValid(id));

const getMonthFromWeek = (week) => {
  if (!week || !week.startDate) return 9;
  const startDate = new Date(week.startDate);
  return startDate.getMonth() + 1;
};

const getWeeksInMonth = async (month, schoolYearLabel) => {
  const allWeeks = await Week.find({}).sort({ weekNumber: 1 });
  if (!schoolYearLabel) {
    return allWeeks.filter(w => getMonthFromWeek(w) === month);
  }
  const parts = (schoolYearLabel || "").toString().split('-').map(Number);
  const startYear = parts[0];
  const endYear = parts[1];
  if (!startYear || !endYear) {
    return allWeeks.filter(w => getMonthFromWeek(w) === month);
  }
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

const createBCSheet = async (workbook, sheetName, teacher, subject, mainClass, records, weeksInMonth, bcNumber, schoolYearLabel) => {
  const worksheet = workbook.addWorksheet(sheetName.substring(0, 31));
  worksheet.views = [{ showGridLines: false }];
  worksheet.columns = [
    { width: 5 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 12 },
    { width: 12 }, { width: 14 }, { width: 12 }, { width: 10 }, { width: 12 },
    { width: 14 }, { width: 14 }
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
    if (className && !classInfo[className]) {
      classInfo[className] = 0;
    }
    if (className) classInfo[className] += r.periods || 0;
  });

  const weeksCount = Math.max(weeksInMonth.length, 1);
  const phanCongParts = Object.keys(classInfo).map(cls => {
    const avgPeriods = Math.round(classInfo[cls] / weeksCount);
    return `Lớp: ${cls} giảng dạy ${avgPeriods} tiết/tuần`;
  });

  worksheet.getCell('B8').value = phanCongParts.length > 0 ? `- ${phanCongParts.join('; ')}` : '';
  worksheet.getCell('B8').font = { size: 10 };

  const totalTeachingPerWeek = Math.round(teachingRecords.reduce((sum, r) => sum + (r.periods || 0), 0) / weeksCount);
  worksheet.mergeCells('H9:L9');
  worksheet.getCell('H9').value = `Tổng cộng số tiết giảng dạy/tuần: ${String(totalTeachingPerWeek).padStart(2, '0')} Tiết`;
  worksheet.getCell('H9').font = { size: 10 };
  worksheet.getCell('H9').alignment = { horizontal: 'left' };

  worksheet.getCell('A10').value = '* Phân công kiêm nhiệm:';
  worksheet.getCell('A10').font = { size: 10 };
  worksheet.getCell('B10').value = `-Chủ nhiệm lớp: ${mainClass?.name || '..........'}. tiết/tuần`;
  worksheet.getCell('B10').font = { size: 10 };

  const extraRecords = records.filter(r => r.recordType === 'extra');
  const totalExtraPerWeek = Math.round(extraRecords.reduce((sum, r) => sum + (r.periods || 0), 0) / weeksCount);

  worksheet.getCell('B11').value = `-Kiêm nhiệm: ${totalExtraPerWeek > 0 ? totalExtraPerWeek : '.............'} tiết/tuần`;
  worksheet.getCell('B11').font = { size: 10 };

  worksheet.mergeCells('H11:L11');
  worksheet.getCell('H11').value = `Tổng cộng số tiết kiêm nhiệm/tuần: ${totalExtraPerWeek > 0 ? String(totalExtraPerWeek).padStart(2, '0') : '......'} tiết.`;
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
          if (cat.grades.length > 0) {
            return cat.grades.includes(rGrade);
          }
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
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
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
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
    cell.font = { bold: true, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  rowIndex += 2;
  worksheet.getCell(`A${rowIndex}`).value = 'Số tiền đề nghị thanh toán...............................đồng. (Ghi bằng chữ:.......................................................................)';
  worksheet.getCell(`A${rowIndex}`).font = { size: 10 };
  rowIndex += 2;
  const today = new Date();
  const dateStr = `Mỏ Cày, ngày ${String(today.getDate()).padStart(2, '0')} tháng ${String(today.getMonth() + 1).padStart(2, '0')} năm ${today.getFullYear()}`;
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

const exportReport = async (teacherIds, schoolYearId, options = {}) => {
  try {
    const { type = 'bc', bcNumber, weekId, weekIds, semester } = options;
    const teacherIdArray = Array.isArray(teacherIds) ? teacherIds : [teacherIds];
    const allWeeks = await Week.find({}).sort({ weekNumber: 1 });
    let schoolYearLabel = null;
    let resolvedSchoolYearId = schoolYearId;
    if (schoolYearId) {
      if (!isValidObjectId(schoolYearId)) {
        return { success: false, statusCode: 400, message: "Vui lòng cung cấp năm học hợp lệ" };
      }
      const sy = await SchoolYear.findById(schoolYearId);
      if (!sy) {
        return { success: false, statusCode: 404, message: "Không tìm thấy thông tin năm học. Vui lòng kiểm tra lại" };
      }
      schoolYearLabel = sy.year || sy.label || (sy.startYear && sy.endYear ? `${sy.startYear}-${sy.endYear}` : String(sy._id));
      resolvedSchoolYearId = sy._id;
    }

    const workbook = new ExcelJS.Workbook();
    let sheetCount = 0;

    for (const teacherId of teacherIdArray) {
      try {
        const teacher = await Teacher.findById(teacherId)
          .populate('subjectIds', 'name')
          .populate('mainClassId', 'name grade');
        if (!teacher) {
          continue;
        }

        let query = { teacherId: teacherId };
        if (resolvedSchoolYearId) query.schoolYearId = resolvedSchoolYearId;
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
          const weeksInMonth = await getWeeksInMonth(month, schoolYearLabel);
          const teacherShortName = teacher.name.split(' ').pop();
          const sheetName = teacherIdArray.length > 1 ? `BC${month}_${teacherShortName}` : `BC ${month}`;
          await createBCSheet(
            workbook,
            sheetName,
            teacher,
            teacher.subjectIds?.[0] || null,
            teacher.mainClassId,
            monthData.records,
            weeksInMonth,
            month,
            schoolYearLabel
          );
          sheetCount++;
        }
      } catch (innerErr) {
        console.error("exportReport error processing teacherId:", teacherId, innerErr && (innerErr.stack || innerErr));
      }
    }

    if (sheetCount === 0) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy dữ liệu giảng dạy. Vui lòng kiểm tra giáo viên và năm học đã chọn"
      };
    }

    return { success: true, data: { workbook, sheetCount, schoolYearLabel, fileName: `BaoCao_${schoolYearLabel || 'report'}.xlsx` } };
  } catch (error) {
    console.error("exportReport unexpected error:", error && (error.stack || error));
    return {
      success: false,
      statusCode: 500,
      message: "Có lỗi khi xuất báo cáo. Vui lòng thử lại sau"
    };
  }
};

const exportBCReport = async (teacherIds, schoolYearId, bcNumber) => {
  return await exportReport(teacherIds, schoolYearId, { type: 'bc', bcNumber });
};

const exportMonthReport = async (teacherId, schoolYearId, month, bcNumber = null) => {
  const bc = bcNumber || month;
  return await exportReport(teacherId, schoolYearId, { type: 'bc', bcNumber: bc });
};

const exportWeekReport = async (teacherId, weekId, schoolYearId) => {
  try {
    const week = await Week.findById(weekId);
    if (!week) {
      return { success: false, statusCode: 404, message: "Không tìm thấy tuần học. Vui lòng kiểm tra lại" };
    }
    let resolvedSchoolYearId = schoolYearId;
    if (!schoolYearId) {
      const weekDate = new Date(week.startDate);
      const year = weekDate.getFullYear();
      const month = weekDate.getMonth() + 1;
      const schoolYearStr = month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
      const sy = await SchoolYear.findOne({ year: schoolYearStr });
      if (sy) resolvedSchoolYearId = sy._id;
    }
    return await exportReport(teacherId, resolvedSchoolYearId, { type: 'week', weekId });
  } catch (error) {
    console.error("exportWeekReport error:", error && (error.stack || error));
    return { success: false, statusCode: 500, message: "Có lỗi khi xuất báo cáo tuần. Vui lòng thử lại sau" };
  }
};

const exportWeekRangeReport = async (teacherId, weekIds, schoolYearId) => {
  try {
    if (!weekIds || weekIds.length === 0) {
      return { success: false, statusCode: 400, message: "Vui lòng chọn các tuần cần xuất báo cáo" };
    }
    const week = await Week.findById(weekIds[0]);
    if (!week) {
      return { success: false, statusCode: 404, message: "Không tìm thấy tuần học. Vui lòng kiểm tra lại" };
    }
    let resolvedSchoolYearId = schoolYearId;
    if (!schoolYearId) {
      const weekDate = new Date(week.startDate);
      const year = weekDate.getFullYear();
      const month = weekDate.getMonth() + 1;
      const schoolYearStr = month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
      const sy = await SchoolYear.findOne({ year: schoolYearStr });
      if (sy) resolvedSchoolYearId = sy._id;
    }
    return await exportReport(teacherId, resolvedSchoolYearId, { type: 'week', weekIds });
  } catch (error) {
    console.error("exportWeekRangeReport error:", error && (error.stack || error));
    return { success: false, statusCode: 500, message: "Có lỗi khi xuất báo cáo nhiều tuần. Vui lòng thử lại sau" };
  }
};

const exportSemesterReport = async (teacherId, schoolYearId, semester) => {
  try {
    return await exportReport(teacherId, schoolYearId, { type: 'semester', semester });
  } catch (error) {
    console.error("exportSemesterReport error:", error && (error.stack || error));
    return { success: false, statusCode: 500, message: "Có lỗi khi xuất báo cáo học kỳ. Vui lòng thử lại sau" };
  }
};

const exportYearReport = async (teacherId, schoolYearId) => {
  try {
    return await exportReport(teacherId, schoolYearId, { type: 'year' });
  } catch (error) {
    console.error("exportYearReport error:", error && (error.stack || error));
    return { success: false, statusCode: 500, message: "Có lỗi khi xuất báo cáo năm. Vui lòng thử lại sau" };
  }
};

const exportAllBCReport = async (teacherId, schoolYearId) => {
  return await exportReport(teacherId, schoolYearId, { type: 'year' });
};

const getBCReport = async (teacherId, schoolYearId, bcNumber) => {
  try {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return { success: false, statusCode: 404, message: "Không tìm thấy giáo viên. Vui lòng kiểm tra lại lựa chọn giáo viên" };
    }
    const query = { teacherId };
    if (schoolYearId) query.schoolYearId = schoolYearId;
    const records = await TeachingRecords.find(query)
      .populate("weekId", "weekNumber startDate endDate")
      .populate("subjectId", "name")
      .populate("classId", "name grade");
    if (records.length === 0) {
      return { success: false, statusCode: 404, message: "Không có dữ liệu giảng dạy cho lựa chọn này. Vui lòng kiểm tra lại giáo viên và năm học" };
    }
    return {
      success: true,
      data: {
        teacher: { id: teacher._id, name: teacher.name },
        schoolYearId,
        bcNumber,
        records,
        totalPeriods: records.reduce((sum, r) => sum + (r.periods || 0), 0)
      }
    };
  } catch (error) {
    console.error("getBCReport error:", error && (error.stack || error));
    return { success: false, statusCode: 500, message: "Có lỗi khi lấy báo cáo. Vui lòng thử lại sau" };
  }
};

const getTeacherReport = async (teacherId, type, filters = {}) => {
  try {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return { success: false, statusCode: 404, message: "Không tìm thấy giáo viên. Vui lòng kiểm tra lại lựa chọn giáo viên" };
    }
    let query = { teacherId };
    if (filters.schoolYearId) query.schoolYearId = filters.schoolYearId;
    const records = await TeachingRecords.find(query)
      .populate("weekId", "weekNumber startDate endDate")
      .populate("subjectId", "name")
      .populate("classId", "name grade")
      .sort({ "weekId.weekNumber": 1 });
    if (records.length === 0) {
      return {
        success: false,
        statusCode: 404,
        message: "Không có dữ liệu giảng dạy cho lựa chọn này. Vui lòng kiểm tra lại giáo viên và năm học"
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
          totalRecords: records.length
        }
      }
    };
  } catch (error) {
    console.error("getTeacherReport error:", error && (error.stack || error));
    return { success: false, statusCode: 500, message: "Có lỗi khi lấy báo cáo. Vui lòng thử lại sau" };
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
  exportYearReport
};