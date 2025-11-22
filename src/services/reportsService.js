const TeachingRecords = require("../models/teachingRecordsModel");
const Teacher = require("../models/teacherModel");
const Week = require("../models/weekModel");
const Subject = require("../models/subjectModel");
const Class = require("../models/classesModel");
const ExcelJS = require("exceljs");

/**
 * Tính số BC từ ngày dựa trên tháng bắt đầu năm học
 * @param {Date} date - Ngày cần tính
 * @param {number} schoolYearStartMonth - Tháng bắt đầu năm học (mặc định 9)
 * @returns {object} - Thông tin BC
 */
const getBCFromDate = (date, schoolYearStartMonth = 9) => {
  const month = new Date(date).getMonth() + 1;
  let bcNumber;
  if (month >= schoolYearStartMonth) {
    bcNumber = month - schoolYearStartMonth + 1;
  } else {
    bcNumber = (12 - schoolYearStartMonth + 1) + month;
  }
  return {
    bcNumber,
    bcName: `BC ${bcNumber}`,
    month,
    monthName: `Tháng ${month}`
  };
};

/**
 * Nhóm các records theo BC
 * @param {Array} records - Mảng teaching records
 * @param {number} schoolYearStartMonth - Tháng bắt đầu năm học
 * @returns {object} - Object chứa các BC groups
 */
const groupRecordsByBC = (records, schoolYearStartMonth = 9) => {
  const bcGroups = {};
  
  records.forEach(record => {
    if (!record.weekId?.startDate) return;
    
    const bcInfo = getBCFromDate(record.weekId.startDate, schoolYearStartMonth);
    const bcNumber = bcInfo.bcNumber;
    
    if (!bcGroups[bcNumber]) {
      bcGroups[bcNumber] = {
        bcNumber,
        bcName: bcInfo.bcName,
        month: bcInfo.month,
        monthName: bcInfo.monthName,
        semester: record.weekId.semester,
        weeks: [],
        weekNumbers: new Set(),
        records: []
      };
    }
    
    const weekNum = record.weekId.weekNumber;
    if (!bcGroups[bcNumber].weekNumbers.has(weekNum)) {
      bcGroups[bcNumber].weekNumbers.add(weekNum);
      bcGroups[bcNumber].weeks.push({
        weekNumber: weekNum,
        startDate: record.weekId.startDate,
        endDate: record.weekId.endDate
      });
    }
    
    bcGroups[bcNumber].records.push(record);
  });
  
  // Sắp xếp weeks và xóa weekNumbers Set
  Object.values(bcGroups).forEach(bc => {
    bc.weeks.sort((a, b) => a.weekNumber - b.weekNumber);
    delete bc.weekNumbers;
  });
  
  return bcGroups;
};

/**
 * Tính toán thống kê từ records
 * @param {Array} records - Mảng teaching records
 * @param {string} type - Loại thống kê
 * @returns {object} - Object chứa thống kê
 */
const calculateStatistics = (records, type) => {
  const stats = {
    totalPeriods: 0,
    totalRecords: records.length,
    bySubject: {},
    byClass: {},
    byWeek: {},
  };

  records.forEach((record) => {
    stats.totalPeriods += record.periods;
    
    // Thống kê theo môn học
    const subjectName = record.subjectId?.name || "Unknown";
    if (!stats.bySubject[subjectName]) {
      stats.bySubject[subjectName] = { count: 0, periods: 0 };
    }
    stats.bySubject[subjectName].count++;
    stats.bySubject[subjectName].periods += record.periods;
    
    // Thống kê theo lớp
    const className = record.classId?.name || "Unknown";
    if (!stats.byClass[className]) {
      stats.byClass[className] = { count: 0, periods: 0 };
    }
    stats.byClass[className].count++;
    stats.byClass[className].periods += record.periods;
    
    // Thống kê theo tuần
    const weekNumber = record.weekId?.weekNumber || 0;
    if (!stats.byWeek[weekNumber]) {
      stats.byWeek[weekNumber] = { count: 0, periods: 0 };
    }
    stats.byWeek[weekNumber].count++;
    stats.byWeek[weekNumber].periods += record.periods;
  });

  return stats;
};

/**
 * Lấy báo cáo giáo viên theo BC
 * @param {string} teacherId - ID giáo viên
 * @param {string} schoolYear - Năm học
 * @param {number} bcNumber - Số BC (1-12)
 */
const getBCReport = async (teacherId, schoolYear, bcNumber) => {
  try {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy giáo viên",
      };
    }

    // Lấy tất cả records trong năm học
    const allRecords = await TeachingRecords.find({
      teacherId,
      schoolYear
    })
      .populate("weekId", "weekNumber startDate endDate semester")
      .populate("subjectId", "name code")
      .populate("classId", "name grade")
      .sort({ "weekId.weekNumber": 1 });

    if (allRecords.length === 0) {
      return {
        success: false,
        statusCode: 404,
        message: "Không có dữ liệu giảng dạy",
      };
    }

    // Nhóm theo BC
    const bcGroups = groupRecordsByBC(allRecords);
    const bcData = bcGroups[bcNumber];
    
    if (!bcData) {
      return {
        success: false,
        statusCode: 404,
        message: `Không có dữ liệu cho BC ${bcNumber}`,
      };
    }

    const statistics = calculateStatistics(bcData.records, 'bc');

    return {
      success: true,
      data: {
        teacher: {
          id: teacher._id,
          name: teacher.name,
          email: teacher.email,
        },
        bcNumber: bcData.bcNumber,
        bcName: bcData.bcName,
        month: bcData.month,
        monthName: bcData.monthName,
        semester: bcData.semester,
        schoolYear,
        weeks: bcData.weeks,
        records: bcData.records,
        statistics,
      },
    };
  } catch (error) {
    console.error("Error in getBCReport:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi tạo báo cáo BC",
      error: error.message,
    };
  }
};

/**
 * Lấy báo cáo tất cả BC trong năm
 * @param {string} teacherId - ID giáo viên
 * @param {string} schoolYear - Năm học
 */
const getAllBCReport = async (teacherId, schoolYear) => {
  try {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy giáo viên",
      };
    }

    const records = await TeachingRecords.find({
      teacherId,
      schoolYear
    })
      .populate("weekId", "weekNumber startDate endDate semester")
      .populate("subjectId", "name code")
      .populate("classId", "name grade")
      .sort({ "weekId.weekNumber": 1 });

    if (records.length === 0) {
      return {
        success: false,
        statusCode: 404,
        message: "Không có dữ liệu giảng dạy",
      };
    }

    const bcGroups = groupRecordsByBC(records);

    // Tính thống kê cho từng BC
    Object.keys(bcGroups).forEach(bcNum => {
      bcGroups[bcNum].statistics = calculateStatistics(
        bcGroups[bcNum].records,
        'bc'
      );
    });

    // Sắp xếp BC theo thứ tự
    const sortedBCGroups = Object.keys(bcGroups)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .reduce((acc, key) => {
        acc[key] = bcGroups[key];
        return acc;
      }, {});

    return {
      success: true,
      data: {
        teacher: {
          id: teacher._id,
          name: teacher.name,
          email: teacher.email,
        },
        schoolYear,
        bcGroups: sortedBCGroups,
        totalBCs: Object.keys(bcGroups).length,
        totalStatistics: calculateStatistics(records, 'year'),
      },
    };
  } catch (error) {
    console.error("Error in getAllBCReport:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi tạo báo cáo tổng hợp BC",
      error: error.message,
    };
  }
};

/**
 * Lấy báo cáo giáo viên theo loại (month/week/semester/year)
 * @param {string} teacherId - ID giáo viên
 * @param {string} type - Loại báo cáo
 * @param {object} filters - Các filter
 */
const getTeacherReport = async (teacherId, type, filters = {}) => {
  try {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy giáo viên",
      };
    }

    let query = { teacherId };
    
    // Build query theo type
    if (filters.schoolYear) {
      query.schoolYear = filters.schoolYear;
    }

    let records;
    
    switch (type) {
      case 'month':
        if (!filters.month || !filters.schoolYear) {
          return {
            success: false,
            statusCode: 400,
            message: "Thiếu month hoặc schoolYear",
          };
        }
        
        // Tìm các tuần trong tháng này
        const monthWeeks = await Week.find({
          schoolYear: filters.schoolYear,
          month: parseInt(filters.month)
        });
        
        const monthWeekIds = monthWeeks.map(w => w._id);
        query.weekId = { $in: monthWeekIds };
        break;
        
      case 'week':
        if (!filters.weekId) {
          return {
            success: false,
            statusCode: 400,
            message: "Thiếu weekId",
          };
        }
        query.weekId = filters.weekId;
        break;
        
      case 'semester':
        if (!filters.semester || !filters.schoolYear) {
          return {
            success: false,
            statusCode: 400,
            message: "Thiếu semester hoặc schoolYear",
          };
        }
        
        const semesterWeeks = await Week.find({
          schoolYear: filters.schoolYear,
          semester: parseInt(filters.semester)
        });
        
        const semesterWeekIds = semesterWeeks.map(w => w._id);
        query.weekId = { $in: semesterWeekIds };
        break;
        
      case 'year':
        // Chỉ cần schoolYear trong query
        break;
        
      default:
        return {
          success: false,
          statusCode: 400,
          message: "Type không hợp lệ",
        };
    }

    records = await TeachingRecords.find(query)
      .populate("weekId", "weekNumber startDate endDate semester month")
      .populate("subjectId", "name code")
      .populate("classId", "name grade")
      .sort({ "weekId.weekNumber": 1 });

    if (records.length === 0) {
      return {
        success: false,
        statusCode: 404,
        message: "Không có dữ liệu giảng dạy",
      };
    }

    const statistics = calculateStatistics(records, type);

    return {
      success: true,
      data: {
        teacher: {
          id: teacher._id,
          name: teacher.name,
          email: teacher.email,
        },
        type,
        filters,
        records,
        statistics,
      },
    };
  } catch (error) {
    console.error("Error in getTeacherReport:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi tạo báo cáo",
      error: error.message,
    };
  }
};

/**
 * Xuất Excel báo cáo BC
 */
const exportBCReport = async (teacherId, schoolYear, bcNumber) => {
  try {
    const reportData = await getBCReport(teacherId, schoolYear, bcNumber);

    if (!reportData.success) {
      return reportData;
    }

    const workbook = await createBCExcelReport(reportData.data);

    return {
      success: true,
      data: { workbook },
    };
  } catch (error) {
    console.error("Error in exportBCReport:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi xuất báo cáo BC Excel",
      error: error.message,
    };
  }
};

/**
 * Xuất Excel tất cả BC trong năm
 */
const exportAllBCReport = async (teacherId, schoolYear) => {
  try {
    const reportData = await getAllBCReport(teacherId, schoolYear);

    if (!reportData.success) {
      return reportData;
    }

    const workbook = await createAllBCExcelReport(reportData.data);

    return {
      success: true,
      data: { workbook },
    };
  } catch (error) {
    console.error("Error in exportAllBCReport:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi xuất báo cáo tổng hợp BC Excel",
      error: error.message,
    };
  }
};

/**
 * Xuất Excel báo cáo tháng
 */
const exportMonthReport = async (teacherId, schoolYear, month) => {
  try {
    const reportData = await getTeacherReport(teacherId, 'month', { 
      schoolYear, 
      month 
    });

    if (!reportData.success) {
      return reportData;
    }

    const workbook = new ExcelJS.Workbook();
    // TODO: Implement month report worksheet
    // createMonthWorksheet(workbook, reportData.data);

    return {
      success: true,
      data: { workbook },
    };
  } catch (error) {
    console.error("Error in exportMonthReport:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi xuất báo cáo tháng Excel",
      error: error.message,
    };
  }
};

/**
 * Xuất Excel báo cáo tuần
 */
const exportWeekReport = async (teacherId, weekId) => {
  try {
    const reportData = await getTeacherReport(teacherId, 'week', { weekId });

    if (!reportData.success) {
      return reportData;
    }

    const workbook = new ExcelJS.Workbook();
    // TODO: Implement week report worksheet
    // createWeekWorksheet(workbook, reportData.data);

    return {
      success: true,
      data: { workbook },
    };
  } catch (error) {
    console.error("Error in exportWeekReport:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi xuất báo cáo tuần Excel",
      error: error.message,
    };
  }
};

/**
 * Xuất Excel báo cáo nhiều tuần (group theo BC)
 */
const exportWeekRangeReport = async (teacherId, weekIds) => {
  try {
    if (!Array.isArray(weekIds) || weekIds.length === 0) {
      return {
        success: false,
        statusCode: 400,
        message: "weekIds phải là mảng không rỗng",
      };
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy giáo viên",
      };
    }

    // Lấy records của các tuần được chọn
    const records = await TeachingRecords.find({
      teacherId,
      weekId: { $in: weekIds }
    })
      .populate("weekId", "weekNumber startDate endDate semester")
      .populate("subjectId", "name code")
      .populate("classId", "name grade")
      .sort({ "weekId.weekNumber": 1 });

    if (records.length === 0) {
      return {
        success: false,
        statusCode: 404,
        message: "Không có dữ liệu cho các tuần đã chọn",
      };
    }

    // Group theo BC
    const bcGroups = groupRecordsByBC(records);
    
    // Tạo workbook với nhiều sheet (mỗi BC 1 sheet)
    const workbook = new ExcelJS.Workbook();
    Object.values(bcGroups).forEach(bcData => {
      const bcReportData = {
        teacher: {
          id: teacher._id,
          name: teacher.name,
          email: teacher.email,
        },
        bcName: bcData.bcName,
        bcNumber: bcData.bcNumber,
        monthName: bcData.monthName,
        month: bcData.month,
        schoolYear: records[0].schoolYear,
        weeks: bcData.weeks,
        records: bcData.records,
        statistics: calculateStatistics(bcData.records, 'bc')
      };
      createBCWorksheet(workbook, bcReportData);
    });

    return {
      success: true,
      data: { 
        workbook,
        bcInfo: Object.values(bcGroups).map(bc => ({
          bcNumber: bc.bcNumber,
          bcName: bc.bcName,
          weeks: bc.weeks
        }))
      },
    };
  } catch (error) {
    console.error("Error in exportWeekRangeReport:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi xuất báo cáo nhiều tuần Excel",
      error: error.message,
    };
  }
};

/**
 * Xuất Excel báo cáo học kỳ
 */
const exportSemesterReport = async (teacherId, schoolYear, semester) => {
  try {
    const reportData = await getTeacherReport(teacherId, 'semester', { 
      schoolYear, 
      semester 
    });

    if (!reportData.success) {
      return reportData;
    }

    const workbook = new ExcelJS.Workbook();
    // TODO: Implement semester report worksheet
    // createSemesterWorksheet(workbook, reportData.data);

    return {
      success: true,
      data: { workbook },
    };
  } catch (error) {
    console.error("Error in exportSemesterReport:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi xuất báo cáo học kỳ Excel",
      error: error.message,
    };
  }
};

/**
 * Xuất Excel báo cáo năm
 */
const exportYearReport = async (teacherId, schoolYear) => {
  try {
    const reportData = await getTeacherReport(teacherId, 'year', { schoolYear });

    if (!reportData.success) {
      return reportData;
    }

    const workbook = new ExcelJS.Workbook();
    // TODO: Implement year report worksheet
    // createYearWorksheet(workbook, reportData.data);

    return {
      success: true,
      data: { workbook },
    };
  } catch (error) {
    console.error("Error in exportYearReport:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi xuất báo cáo năm Excel",
      error: error.message,
    };
  }
};

/**
 * Tạo Excel workbook cho báo cáo BC
 */
const createBCExcelReport = async (data) => {
  const workbook = new ExcelJS.Workbook();
  createBCWorksheet(workbook, data);
  return workbook;
};

/**
 * Tạo Excel workbook cho tất cả BC
 */
const createAllBCExcelReport = async (data) => {
  const workbook = new ExcelJS.Workbook();
  Object.values(data.bcGroups).forEach(bcData => {
    const bcReportData = {
      teacher: data.teacher,
      bcName: bcData.bcName,
      bcNumber: bcData.bcNumber,
      monthName: bcData.monthName,
      month: bcData.month,
      schoolYear: data.schoolYear,
      weeks: bcData.weeks,
      records: bcData.records,
      statistics: bcData.statistics
    };
    createBCWorksheet(workbook, bcReportData);
  });
  return workbook;
};

/**
 * Tạo worksheet cho BC trong Excel
 */
const createBCWorksheet = (workbook, data) => {
  const worksheet = workbook.addWorksheet(data.bcName);

  const { bcName, monthName, schoolYear, weeks } = data;

  // Header
  worksheet.mergeCells("A1:K1");
  worksheet.getCell("A1").value = "SỞ GD&ĐT TỈNH VĨNH LONG";
  worksheet.getCell("A1").font = { bold: true, size: 11 };
  worksheet.getCell("A1").alignment = { horizontal: "center" };

  worksheet.mergeCells("A2:K2");
  worksheet.getCell("A2").value = "TRUNG TÂM GDNN-GDTX MÔ CÂY NAM";
  worksheet.getCell("A2").font = { bold: true, size: 11 };
  worksheet.getCell("A2").alignment = { horizontal: "center" };

  worksheet.mergeCells("A4:K4");
  worksheet.getCell("A4").value = `BẢNG KÊ GIỜ ${monthName.toUpperCase()} NĂM HỌC ${schoolYear} (BIÊN CHẾ)`;
  worksheet.getCell("A4").font = { bold: true, size: 14 };
  worksheet.getCell("A4").alignment = { horizontal: "center" };

  worksheet.mergeCells("A5:K5");
  worksheet.getCell("A5").value = "Môn : Toán";
  worksheet.getCell("A5").font = { bold: true, size: 11 };
  worksheet.getCell("A5").alignment = { horizontal: "center" };

  // Thông tin giáo viên
  worksheet.getCell("A7").value = `Họ và tên giáo viên: ${data.teacher.name}`;
  worksheet.getCell("A7").font = { bold: true };

  worksheet.getCell("A8").value = "*Phân công giảng dạy:";
  worksheet.getCell("A8").font = { italic: true };

  const classes = [...new Set(data.records.map((r) => r.classId?.name))];
  let classesText = classes.map((c) => `Lớp: ${c} giảng dạy ... tiết/tuần`).join("; ");
  worksheet.getCell("A9").value = classesText;

  const totalPeriods = data.statistics.totalPeriods;
  worksheet.getCell("A10").value = `Tổng công số tiết giảng dạy/tuần: ${String(totalPeriods).padStart(2, "0")} Tiết`;
  worksheet.getCell("A10").font = { bold: true };

  worksheet.getCell("A12").value = "*Phân công kiểm nhiệm:";
  worksheet.getCell("A12").font = { italic: true };
  worksheet.getCell("A13").value = "-Chủ nhiệm lớp: ........... tiết/tuần.";
  worksheet.getCell("A14").value = "-Kiểm nhiệm: ........ tiết/tuần";
  worksheet.getCell("A15").value = "Tổng công số tiết kiểm nhiệm/tuần: ..... tiết.";
  worksheet.getCell("A15").font = { bold: true };

  // Table header
  const headerRow = 17;
  worksheet.mergeCells(`A${headerRow}:A${headerRow + 1}`);
  worksheet.getCell(`A${headerRow}`).value = "TT";
  worksheet.mergeCells(`B${headerRow}:B${headerRow + 1}`);
  worksheet.getCell(`B${headerRow}`).value = "Phân công";
  
  const numWeeks = weeks.length;
  const lastWeekCol = String.fromCharCode(67 + numWeeks - 1);

  worksheet.mergeCells(`C${headerRow}:${lastWeekCol}${headerRow}`);
  worksheet.getCell(`C${headerRow}`).value = "THỜI GIAN";

  weeks.forEach((week, index) => {
    const col = String.fromCharCode(67 + index);
    worksheet.getCell(`${col}${headerRow + 1}`).value = `Tuần ${week.weekNumber}`;
  });

  const afterWeekCol = String.fromCharCode(67 + numWeeks);
  worksheet.mergeCells(`${afterWeekCol}${headerRow}:${afterWeekCol}${headerRow + 1}`);
  worksheet.getCell(`${afterWeekCol}${headerRow}`).value = "Tổng số tiết theo c.trình";

  const col2 = String.fromCharCode(67 + numWeeks + 1);
  worksheet.mergeCells(`${col2}${headerRow}:${col2}${headerRow + 1}`);
  worksheet.getCell(`${col2}${headerRow}`).value = "Giờ tiêu chuẩn";

  const col3 = String.fromCharCode(67 + numWeeks + 2);
  worksheet.mergeCells(`${col3}${headerRow}:${col3}${headerRow + 1}`);
  worksheet.getCell(`${col3}${headerRow}`).value = "Giờ dự";

  const col4 = String.fromCharCode(67 + numWeeks + 3);
  worksheet.mergeCells(`${col4}${headerRow}:${col4}${headerRow + 1}`);
  worksheet.getCell(`${col4}${headerRow}`).value = "Đơn giá";

  const col5 = String.fromCharCode(67 + numWeeks + 4);
  worksheet.mergeCells(`${col5}${headerRow}:${col5}${headerRow + 1}`);
  worksheet.getCell(`${col5}${headerRow}`).value = "Thành tiền";

  const col6 = String.fromCharCode(67 + numWeeks + 5);
  worksheet.mergeCells(`${col6}${headerRow}:${col6}${headerRow + 1}`);
  worksheet.getCell(`${col6}${headerRow}`).value = "Phụ chú";

  const totalCols = 2 + numWeeks + 6;
  
  // Style header
  for (let col = 1; col <= totalCols; col++) {
    for (let row = headerRow; row <= headerRow + 1; row++) {
      const cell = worksheet.getCell(row, col);
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }
  }

  // Data rows
  let rowIndex = headerRow + 2;
  const groupedByClass = {};
  data.records.forEach((record) => {
    const className = record.classId?.name || "Unknown";
    if (!groupedByClass[className]) {
      groupedByClass[className] = [];
    }
    groupedByClass[className].push(record);
  });

  let stt = 1;
  Object.entries(groupedByClass).forEach(([className, records]) => {
    const row = worksheet.getRow(rowIndex);
    row.getCell(1).value = stt++;
    row.getCell(2).value = className;
    
    const weeklyPeriods = {};
    weeks.forEach(week => {
      weeklyPeriods[week.weekNumber] = 0;
    });
    
    records.forEach((r) => {
      const weekNum = r.weekId?.weekNumber;
      if (weeklyPeriods.hasOwnProperty(weekNum)) {
        weeklyPeriods[weekNum] += r.periods;
      }
    });
    
    weeks.forEach((week, index) => {
      row.getCell(3 + index).value = weeklyPeriods[week.weekNumber] || 0;
    });
    
    const totalClassPeriods = records.reduce((sum, r) => sum + r.periods, 0);
    row.getCell(3 + numWeeks).value = totalClassPeriods;
    
    for (let col = 1; col <= totalCols; col++) {
      const cell = row.getCell(col);
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      if (col >= 3) {
        cell.alignment = { horizontal: "center" };
      }
    }
    rowIndex++;
  });

  // Các môn khác
  const otherSubjects = ["Khối 11", "Khối 10", "TH-HN 1", "TH-HN 2", "TH-HN 3", "Kiểm nhiệm", "Coi thi"];
  otherSubjects.forEach((subject) => {
    const row = worksheet.getRow(rowIndex);
    row.getCell(1).value = stt++;
    row.getCell(2).value = subject;
    row.getCell(3 + numWeeks).value = 0;
    
    for (let col = 1; col <= totalCols; col++) {
      const cell = row.getCell(col);
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }
    rowIndex++;
  });

  // Tổng cộng
  const totalRow = worksheet.getRow(rowIndex);
  totalRow.getCell(1).value = "Tổng cộng";
  totalRow.getCell(2).value = "";
  
  const weekTotals = {};
  weeks.forEach(week => {
    weekTotals[week.weekNumber] = 0;
  });
  
  data.records.forEach((r) => {
    const weekNum = r.weekId?.weekNumber;
    if (weekTotals.hasOwnProperty(weekNum)) {
      weekTotals[weekNum] += r.periods;
    }
  });

  weeks.forEach((week, index) => {
    totalRow.getCell(3 + index).value = weekTotals[week.weekNumber];
  });

  totalRow.getCell(3 + numWeeks).value = totalPeriods;
  totalRow.getCell(3 + numWeeks + 1).value = 68;
  totalRow.getCell(3 + numWeeks + 2).value = -32;
  totalRow.font = { bold: true };
  
  for (let col = 1; col <= totalCols; col++) {
    const cell = totalRow.getCell(col);
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
    if (col >= 3) {
      cell.alignment = { horizontal: "center" };
    }
  }

  // Footer
  rowIndex += 2;
  worksheet.getCell(`A${rowIndex}`).value = `Số tiền đã ghi thành toán: ..................... đồng (Ghi bằng chữ: ........................)`;

  rowIndex += 2;
  const today = new Date();
  const dateStr = `Mô Cây, ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;
  worksheet.getCell(`A${rowIndex}`).value = dateStr;
  worksheet.getCell(`A${rowIndex}`).alignment = { horizontal: "center" };

  const col7 = String.fromCharCode(67 + numWeeks + 2);
  worksheet.getCell(`${col7}${rowIndex}`).value = dateStr;
  worksheet.getCell(`${col7}${rowIndex}`).alignment = { horizontal: "center" };

  rowIndex++;
  worksheet.getCell(`A${rowIndex}`).value = "PHÓ GIÁM ĐỐC";
  worksheet.getCell(`A${rowIndex}`).font = { bold: true };
  worksheet.getCell(`A${rowIndex}`).alignment = { horizontal: "center" };

  worksheet.getCell(`D${rowIndex}`).value = "TỔ TRƯỞNG DUYỆT";
  worksheet.getCell(`D${rowIndex}`).font = { bold: true };
  worksheet.getCell(`D${rowIndex}`).alignment = { horizontal: "center" };

  worksheet.getCell(`${col7}${rowIndex}`).value = "GIÁO VIÊN KÊ GIỜ";
  worksheet.getCell(`${col7}${rowIndex}`).font = { bold: true };
  worksheet.getCell(`${col7}${rowIndex}`).alignment = { horizontal: "center" };

  // Column widths
  worksheet.getColumn(1).width = 5;
  worksheet.getColumn(2).width = 15;
  for (let i = 0; i < numWeeks; i++) {
    worksheet.getColumn(3 + i).width = 10;
  }
  worksheet.getColumn(3 + numWeeks).width = 12;
  worksheet.getColumn(3 + numWeeks + 1).width = 10;
  worksheet.getColumn(3 + numWeeks + 2).width = 10;
  worksheet.getColumn(3 + numWeeks + 3).width = 10;
  worksheet.getColumn(3 + numWeeks + 4).width = 12;
  worksheet.getColumn(3 + numWeeks + 5).width = 15;

  return worksheet;
};

module.exports = {
  // Báo cáo BC
  getBCReport,
  getAllBCReport,
  exportBCReport,
  exportAllBCReport,
  
  // Báo cáo thông thường
  getTeacherReport,
  exportMonthReport,
  exportWeekReport,
  exportWeekRangeReport,
  exportSemesterReport,
  exportYearReport,
  
  // Helper functions
  calculateStatistics,
  createBCExcelReport,
  createAllBCExcelReport,
  groupRecordsByBC,
  getBCFromDate,
  createBCWorksheet
};