// services/reportsService.js

const TeachingRecords = require("../models/teachingRecordsModel");
const Teacher = require("../models/teacherModel");
const Week = require("../models/weekModel");
const Subject = require("../models/subjectModel");
const Class = require("../models/classesModel");
const ExcelJS = require("exceljs");

/**
 * Lấy báo cáo theo giáo viên
 * @param {string} teacherId - ID giáo viên
 * @param {string} type - Loại báo cáo: month|week|semester|year
 * @param {object} filters - Filters (schoolYear, month, weekId, semester)
 */
const getTeacherReport = async (teacherId, type, filters = {}) => {
  try {
    // Kiểm tra giáo viên tồn tại
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy giáo viên",
      };
    }

    let query = { teacherId };

    // Xây dựng query theo type
    switch (type) {
      case "week":
        if (filters.weekId) {
          query.weekId = filters.weekId;
        }
        break;

      case "month":
        if (filters.schoolYear && filters.month) {
          // Lấy các tuần trong tháng
          const weeks = await Week.find({
            schoolYear: filters.schoolYear,
            $expr: {
              $eq: [{ $month: "$startDate" }, parseInt(filters.month)],
            },
          });
          query.weekId = { $in: weeks.map((w) => w._id) };
        }
        break;

      case "semester":
        if (filters.schoolYear && filters.semester) {
          const weeks = await Week.find({
            schoolYear: filters.schoolYear,
            semester: parseInt(filters.semester),
          });
          query.weekId = { $in: weeks.map((w) => w._id) };
        }
        break;

      case "year":
        if (filters.schoolYear) {
          query.schoolYear = filters.schoolYear;
        }
        break;

      default:
        return {
          success: false,
          statusCode: 400,
          message: "Loại báo cáo không hợp lệ",
        };
    }

    // Lấy dữ liệu teaching records
    const records = await TeachingRecords.find(query)
      .populate("weekId", "weekNumber startDate endDate semester")
      .populate("subjectId", "name code")
      .populate("classId", "name grade")
      .sort({ "weekId.weekNumber": 1 });

    // Tính toán thống kê
    const statistics = calculateStatistics(records, type);

    return {
      success: true,
      data: {
        teacher: {
          id: teacher._id,
          name: teacher.name,
          email: teacher.email,
          allowedGrades: teacher.allowedGrades,
        },
        type,
        filters,
        records,
        statistics,
      },
    };
  } catch (error) {
    console.error("Error in getTeacherReport service:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi tạo báo cáo",
      error: error.message,
    };
  }
};

/**
 * Xuất báo cáo ra Excel theo tháng
 */
const exportMonthReport = async (teacherId, schoolYear, month) => {
  try {
    const reportData = await getTeacherReport(teacherId, "month", {
      schoolYear,
      month,
    });

    if (!reportData.success) {
      return reportData;
    }

    const workbook = await createMonthExcelReport(reportData.data, month);

    return {
      success: true,
      data: { workbook },
    };
  } catch (error) {
    console.error("Error in exportMonthReport:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi xuất báo cáo Excel",
      error: error.message,
    };
  }
};

/**
 * Xuất báo cáo ra Excel theo tuần
 */
const exportWeekReport = async (teacherId, weekId) => {
  try {
    const reportData = await getTeacherReport(teacherId, "week", {
      weekId,
    });

    if (!reportData.success) {
      return reportData;
    }

    const workbook = await createWeekExcelReport(reportData.data);

    return {
      success: true,
      data: { workbook },
    };
  } catch (error) {
    console.error("Error in exportWeekReport:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi xuất báo cáo Excel",
      error: error.message,
    };
  }
};

/**
 * Xuất báo cáo ra Excel theo học kỳ
 */
const exportSemesterReport = async (teacherId, schoolYear, semester) => {
  try {
    const reportData = await getTeacherReport(teacherId, "semester", {
      schoolYear,
      semester,
    });

    if (!reportData.success) {
      return reportData;
    }

    const workbook = await createSemesterExcelReport(reportData.data, semester);

    return {
      success: true,
      data: { workbook },
    };
  } catch (error) {
    console.error("Error in exportSemesterReport:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi xuất báo cáo Excel",
      error: error.message,
    };
  }
};

/**
 * Xuất báo cáo ra Excel cả năm
 */
const exportYearReport = async (teacherId, schoolYear) => {
  try {
    const reportData = await getTeacherReport(teacherId, "year", {
      schoolYear,
    });

    if (!reportData.success) {
      return reportData;
    }

    const workbook = await createYearExcelReport(reportData.data);

    return {
      success: true,
      data: { workbook },
    };
  } catch (error) {
    console.error("Error in exportYearReport:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi xuất báo cáo Excel",
      error: error.message,
    };
  }
};

/**
 * Tính toán thống kê
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
 * Tạo file Excel báo cáo tháng
 */
const createMonthExcelReport = async (data, month) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Báo cáo tháng");

  const monthName = `THÁNG ${month.toString().padStart(2, "0")}`;
  const schoolYear = data.records[0]?.schoolYear || "2025-2026";

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
  worksheet.getCell(
    "A4"
  ).value = `BẢNG KÊ GIỜ ${monthName} NĂM HỌC ${schoolYear} (BIÊN CHẾ)`;
  worksheet.getCell("A4").font = { bold: true, size: 14 };
  worksheet.getCell("A4").alignment = { horizontal: "center" };

  worksheet.mergeCells("A5:K5");
  worksheet.getCell("A5").value = "Môn : Toán";
  worksheet.getCell("A5").font = { bold: true, size: 11 };
  worksheet.getCell("A5").alignment = { horizontal: "center" };

  // Thông tin giáo viên
  worksheet.getCell(
    "A7"
  ).value = `Họ và tên giáo viên: ${data.teacher.name}`;
  worksheet.getCell("A7").font = { bold: true };

  // Phân công giảng dạy
  worksheet.getCell("A8").value = "*Phân công giảng dạy:";
  worksheet.getCell("A8").font = { italic: true };

  // Lấy danh sách các lớp unique
  const classes = [...new Set(data.records.map((r) => r.classId?.name))];
  let classesText = classes
    .map((c) => `Lớp: ${c} giảng dạy ... tiết/tuần`)
    .join("; ");
  worksheet.getCell("A9").value = classesText;

  // Tổng số tiết
  const totalPeriods = data.statistics.totalPeriods;
  worksheet.getCell(
    "A10"
  ).value = `Tổng công số tiết giảng dạy/tuần: ${String(totalPeriods).padStart(
    2,
    "0"
  )} Tiết`;
  worksheet.getCell("A10").font = { bold: true };

  // Phân công kiểm nhiệm
  worksheet.getCell("A12").value = "*Phân công kiểm nhiệm:";
  worksheet.getCell("A12").font = { italic: true };
  worksheet.getCell("A13").value = "-Chủ nhiệm lớp: ........... tiết/tuần.";
  worksheet.getCell("A14").value = "-Kiểm nhiệm: ........ tiết/tuần";

  worksheet.getCell("A15").value =
    "Tổng công số tiết kiểm nhiệm/tuần: ..... tiết.";
  worksheet.getCell("A15").font = { bold: true };

  // Table header
  const headerRow = 17;
  worksheet.mergeCells(`A${headerRow}:A${headerRow + 1}`);
  worksheet.getCell(`A${headerRow}`).value = "TT";

  worksheet.mergeCells(`B${headerRow}:B${headerRow + 1}`);
  worksheet.getCell(`B${headerRow}`).value = "Phân công";

  // Thời gian - 4 tuần
  worksheet.mergeCells(`C${headerRow}:F${headerRow}`);
  worksheet.getCell(`C${headerRow}`).value = "THỜI GIAN";

  worksheet.getCell(`C${headerRow + 1}`).value = "Tuần 1";
  worksheet.getCell(`D${headerRow + 1}`).value = "Tuần 2";
  worksheet.getCell(`E${headerRow + 1}`).value = "Tuần 3";
  worksheet.getCell(`F${headerRow + 1}`).value = "Tuần 4";

  worksheet.mergeCells(`G${headerRow}:G${headerRow + 1}`);
  worksheet.getCell(`G${headerRow}`).value = "Tổng số tiết theo c.trình";

  worksheet.mergeCells(`H${headerRow}:H${headerRow + 1}`);
  worksheet.getCell(`H${headerRow}`).value = "Giờ tiêu chuẩn";

  worksheet.mergeCells(`I${headerRow}:I${headerRow + 1}`);
  worksheet.getCell(`I${headerRow}`).value = "Giờ dự";

  worksheet.mergeCells(`J${headerRow}:J${headerRow + 1}`);
  worksheet.getCell(`J${headerRow}`).value = "Đơn giá";

  worksheet.mergeCells(`K${headerRow}:K${headerRow + 1}`);
  worksheet.getCell(`K${headerRow}`).value = "Thành tiền";

  worksheet.mergeCells(`L${headerRow}:L${headerRow + 1}`);
  worksheet.getCell(`L${headerRow}`).value = "Phụ chú";

  // Style header
  for (let col = 1; col <= 12; col++) {
    for (let row = headerRow; row <= headerRow + 1; row++) {
      const cell = worksheet.getCell(row, col);
      cell.font = { bold: true };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
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

  // Group by class
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

    // Tính số tiết cho mỗi tuần (giả sử có 4 tuần trong tháng)
    const weeklyPeriods = { 1: 0, 2: 0, 3: 0, 4: 0 };
    records.forEach((r) => {
      const weekNum = (r.weekId?.weekNumber % 4) || 1;
      weeklyPeriods[weekNum] += r.periods;
    });

    row.getCell(3).value = weeklyPeriods[1] || 0;
    row.getCell(4).value = weeklyPeriods[2] || 0;
    row.getCell(5).value = weeklyPeriods[3] || 0;
    row.getCell(6).value = weeklyPeriods[4] || 0;

    const totalClassPeriods = records.reduce((sum, r) => sum + r.periods, 0);
    row.getCell(7).value = totalClassPeriods;

    // Style data row
    for (let col = 1; col <= 12; col++) {
      const cell = row.getCell(col);
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      if (col >= 3 && col <= 7) {
        cell.alignment = { horizontal: "center" };
      }
    }

    rowIndex++;
  });

  // Các môn khác
  const otherSubjects = [
    "Khối 11",
    "Khối 10",
    "TH-HN 1",
    "TH-HN 2",
    "TH-HN 3",
    "Kiểm nhiệm",
    "Coi thi",
  ];
  otherSubjects.forEach((subject) => {
    const row = worksheet.getRow(rowIndex);
    row.getCell(1).value = stt++;
    row.getCell(2).value = subject;
    row.getCell(7).value = 0;

    for (let col = 1; col <= 12; col++) {
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

  // Tính tổng từng tuần
  let week1Total = 0,
    week2Total = 0,
    week3Total = 0,
    week4Total = 0;
  data.records.forEach((r) => {
    const weekNum = (r.weekId?.weekNumber % 4) || 1;
    if (weekNum === 1) week1Total += r.periods;
    else if (weekNum === 2) week2Total += r.periods;
    else if (weekNum === 3) week3Total += r.periods;
    else week4Total += r.periods;
  });

  totalRow.getCell(3).value = week1Total;
  totalRow.getCell(4).value = week2Total;
  totalRow.getCell(5).value = week3Total;
  totalRow.getCell(6).value = week4Total;
  totalRow.getCell(7).value = totalPeriods;
  totalRow.getCell(8).value = 68;
  totalRow.getCell(9).value = -32;

  totalRow.font = { bold: true };
  for (let col = 1; col <= 12; col++) {
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
  worksheet.getCell(
    `A${rowIndex}`
  ).value = `Số tiền đã ghi thành toán: ..................... đồng (Ghi bằng chữ: ........................)`;

  rowIndex += 2;
  worksheet.getCell(`A${rowIndex}`).value = `Mô Cây, ngày 07 tháng 10 năm 2025`;
  worksheet.getCell(`A${rowIndex}`).alignment = { horizontal: "center" };

  worksheet.getCell(`I${rowIndex}`).value = `Mô Cây, ngày 06 tháng 10 năm 2025`;
  worksheet.getCell(`I${rowIndex}`).alignment = { horizontal: "center" };

  rowIndex++;
  worksheet.getCell(`A${rowIndex}`).value = "PHÓ GIÁM ĐỐC";
  worksheet.getCell(`A${rowIndex}`).font = { bold: true };
  worksheet.getCell(`A${rowIndex}`).alignment = { horizontal: "center" };

  worksheet.getCell(`D${rowIndex}`).value = "TỔ TRƯỞNG DUYỆT";
  worksheet.getCell(`D${rowIndex}`).font = { bold: true };
  worksheet.getCell(`D${rowIndex}`).alignment = { horizontal: "center" };

  worksheet.getCell(`I${rowIndex}`).value = "GIÁO VIÊN KÊ GIỜ";
  worksheet.getCell(`I${rowIndex}`).font = { bold: true };
  worksheet.getCell(`I${rowIndex}`).alignment = { horizontal: "center" };

  // Adjust column widths
  worksheet.getColumn(1).width = 5;
  worksheet.getColumn(2).width = 15;
  worksheet.getColumn(3).width = 10;
  worksheet.getColumn(4).width = 10;
  worksheet.getColumn(5).width = 10;
  worksheet.getColumn(6).width = 10;
  worksheet.getColumn(7).width = 12;
  worksheet.getColumn(8).width = 10;
  worksheet.getColumn(9).width = 10;
  worksheet.getColumn(10).width = 10;
  worksheet.getColumn(11).width = 12;
  worksheet.getColumn(12).width = 15;

  return workbook;
};

/**
 * Tạo file Excel báo cáo tuần
 */
const createWeekExcelReport = async (data) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Báo cáo tuần");

  const weekInfo = data.records[0]?.weekId || {};
  const weekNumber = weekInfo.weekNumber || 0;
  const schoolYear = data.records[0]?.schoolYear || "2025-2026";

  // Header
  worksheet.mergeCells("A1:H1");
  worksheet.getCell("A1").value = "SỞ GD&ĐT TỈNH VĨNH LONG";
  worksheet.getCell("A1").font = { bold: true, size: 11 };
  worksheet.getCell("A1").alignment = { horizontal: "center" };

  worksheet.mergeCells("A2:H2");
  worksheet.getCell("A2").value = "TRUNG TÂM GDNN-GDTX MÔ CÂY NAM";
  worksheet.getCell("A2").font = { bold: true, size: 11 };
  worksheet.getCell("A2").alignment = { horizontal: "center" };

  worksheet.mergeCells("A4:H4");
  worksheet.getCell(
    "A4"
  ).value = `BÁO CÁO GIẢNG DẠY TUẦN ${weekNumber} NĂM HỌC ${schoolYear}`;
  worksheet.getCell("A4").font = { bold: true, size: 14 };
  worksheet.getCell("A4").alignment = { horizontal: "center" };

  // Thông tin giáo viên
  worksheet.getCell(
    "A6"
  ).value = `Họ và tên giáo viên: ${data.teacher.name}`;
  worksheet.getCell("A6").font = { bold: true };

  worksheet.getCell("A7").value = `Email: ${data.teacher.email}`;

  // Thời gian tuần
  if (weekInfo.startDate && weekInfo.endDate) {
    const startDate = new Date(weekInfo.startDate).toLocaleDateString("vi-VN");
    const endDate = new Date(weekInfo.endDate).toLocaleDateString("vi-VN");
    worksheet.getCell(
      "A8"
    ).value = `Thời gian: Từ ${startDate} đến ${endDate}`;
  }

  // Table header
  const headerRow = 10;
  const headers = [
    "STT",
    "Lớp",
    "Môn học",
    "Số tiết",
    "Nội dung",
    "Ghi chú",
  ];

  headers.forEach((header, index) => {
    const cell = worksheet.getCell(headerRow, index + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Data rows
  let rowIndex = headerRow + 1;
  data.records.forEach((record, index) => {
    const row = worksheet.getRow(rowIndex);

    row.getCell(1).value = index + 1;
    row.getCell(2).value = record.classId?.name || "";
    row.getCell(3).value = record.subjectId?.name || "";
    row.getCell(4).value = record.periods;
    row.getCell(5).value = record.content || "";
    row.getCell(6).value = record.note || "";

    // Style data row
    for (let col = 1; col <= 6; col++) {
      const cell = row.getCell(col);
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      if (col === 1 || col === 4) {
        cell.alignment = { horizontal: "center" };
      }
    }

    rowIndex++;
  });

  // Tổng cộng
  const totalRow = worksheet.getRow(rowIndex);
  totalRow.getCell(1).value = "";
  totalRow.getCell(2).value = "Tổng cộng";
  totalRow.getCell(3).value = "";
  totalRow.getCell(4).value = data.statistics.totalPeriods;
  totalRow.getCell(5).value = "";
  totalRow.getCell(6).value = "";

  totalRow.font = { bold: true };
  for (let col = 1; col <= 6; col++) {
    const cell = totalRow.getCell(col);
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
    if (col === 4) {
      cell.alignment = { horizontal: "center" };
    }
  }

  // Footer
  rowIndex += 3;
  worksheet.getCell(`F${rowIndex}`).value = `Mô Cây, ngày ... tháng ... năm 2025`;
  worksheet.getCell(`F${rowIndex}`).alignment = { horizontal: "center" };

  rowIndex++;
  worksheet.getCell(`F${rowIndex}`).value = "GIÁO VIÊN";
  worksheet.getCell(`F${rowIndex}`).font = { bold: true };
  worksheet.getCell(`F${rowIndex}`).alignment = { horizontal: "center" };

  rowIndex += 4;
  worksheet.getCell(`F${rowIndex}`).value = data.teacher.name;
  worksheet.getCell(`F${rowIndex}`).alignment = { horizontal: "center" };

  // Adjust column widths
  worksheet.getColumn(1).width = 5;
  worksheet.getColumn(2).width = 15;
  worksheet.getColumn(3).width = 15;
  worksheet.getColumn(4).width = 10;
  worksheet.getColumn(5).width = 30;
  worksheet.getColumn(6).width = 20;

  return workbook;
};

/**
 * Tạo file Excel báo cáo học kỳ
 */
const createSemesterExcelReport = async (data, semester) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`Báo cáo HK${semester}`);

  const schoolYear = data.records[0]?.schoolYear || "2025-2026";
  const semesterText = semester === 1 ? "HỌC KỲ I" : "HỌC KỲ II";

  // Header
  worksheet.mergeCells("A1:J1");
  worksheet.getCell("A1").value = "SỞ GD&ĐT TỈNH VĨNH LONG";
  worksheet.getCell("A1").font = { bold: true, size: 11 };
  worksheet.getCell("A1").alignment = { horizontal: "center" };

  worksheet.mergeCells("A2:J2");
  worksheet.getCell("A2").value = "TRUNG TÂM GDNN-GDTX MÔ CÂY NAM";
  worksheet.getCell("A2").font = { bold: true, size: 11 };
  worksheet.getCell("A2").alignment = { horizontal: "center" };

  worksheet.mergeCells("A4:J4");
  worksheet.getCell(
    "A4"
  ).value = `BÁO CÁO TỔNG HỢP ${semesterText} NĂM HỌC ${schoolYear}`;
  worksheet.getCell("A4").font = { bold: true, size: 14 };
  worksheet.getCell("A4").alignment = { horizontal: "center" };

  // Thông tin giáo viên
  worksheet.getCell(
    "A6"
  ).value = `Họ và tên giáo viên: ${data.teacher.name}`;
  worksheet.getCell("A6").font = { bold: true };

  // Table header
  const headerRow = 8;
  const headers = [
    "STT",
    "Lớp",
    "Môn học",
    "Tổng số tiết",
    "Số tuần",
    "TB tiết/tuần",
    "Ghi chú",
  ];

  headers.forEach((header, index) => {
    const cell = worksheet.getCell(headerRow, index + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Group data by class and subject
  const groupedData = {};
  data.records.forEach((record) => {
    const className = record.classId?.name || "Unknown";
    const subjectName = record.subjectId?.name || "Unknown";
    const key = `${className}-${subjectName}`;

    if (!groupedData[key]) {
      groupedData[key] = {
        className,
        subjectName,
        totalPeriods: 0,
        weeks: new Set(),
      };
    }

    groupedData[key].totalPeriods += record.periods;
    if (record.weekId?.weekNumber) {
      groupedData[key].weeks.add(record.weekId.weekNumber);
    }
  });

  // Data rows
  let rowIndex = headerRow + 1;
  let stt = 1;

  Object.values(groupedData).forEach((item) => {
    const row = worksheet.getRow(rowIndex);
    const weekCount = item.weeks.size || 1;
    const avgPerWeek = (item.totalPeriods / weekCount).toFixed(1);

    row.getCell(1).value = stt++;
    row.getCell(2).value = item.className;
    row.getCell(3).value = item.subjectName;
    row.getCell(4).value = item.totalPeriods;
    row.getCell(5).value = weekCount;
    row.getCell(6).value = avgPerWeek;
    row.getCell(7).value = "";

    // Style data row
    for (let col = 1; col <= 7; col++) {
      const cell = row.getCell(col);
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      if (col === 1 || col >= 4) {
        cell.alignment = { horizontal: "center" };
      }
    }

    rowIndex++;
  });

  // Tổng cộng
  const totalRow = worksheet.getRow(rowIndex);
  totalRow.getCell(1).value = "";
  totalRow.getCell(2).value = "Tổng cộng";
  totalRow.getCell(3).value = "";
  totalRow.getCell(4).value = data.statistics.totalPeriods;
  totalRow.getCell(5).value = "";
  totalRow.getCell(6).value = "";
  totalRow.getCell(7).value = "";

  totalRow.font = { bold: true };
  for (let col = 1; col <= 7; col++) {
    const cell = totalRow.getCell(col);
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
    if (col === 4) {
      cell.alignment = { horizontal: "center" };
    }
  }

  // Thống kê chi tiết
  rowIndex += 3;
  worksheet.getCell(`A${rowIndex}`).value = "THỐNG KÊ CHI TIẾT:";
  worksheet.getCell(`A${rowIndex}`).font = { bold: true, size: 12 };

  rowIndex += 2;
  worksheet.getCell(`A${rowIndex}`).value = "Theo môn học:";
  worksheet.getCell(`A${rowIndex}`).font = { bold: true };

  rowIndex++;
  Object.entries(data.statistics.bySubject).forEach(([subject, stats]) => {
    worksheet.getCell(
      `A${rowIndex}`
    ).value = `  - ${subject}: ${stats.periods} tiết (${stats.count} buổi)`;
    rowIndex++;
  });

  rowIndex++;
  worksheet.getCell(`A${rowIndex}`).value = "Theo lớp:";
  worksheet.getCell(`A${rowIndex}`).font = { bold: true };

  rowIndex++;
  Object.entries(data.statistics.byClass).forEach(([className, stats]) => {
    worksheet.getCell(
      `A${rowIndex}`
    ).value = `  - ${className}: ${stats.periods} tiết (${stats.count} buổi)`;
    rowIndex++;
  });

  // Footer
  rowIndex += 3;
  worksheet.getCell(`A${rowIndex}`).value = "TỔ TRƯỞNG";
  worksheet.getCell(`A${rowIndex}`).font = { bold: true };
  worksheet.getCell(`A${rowIndex}`).alignment = { horizontal: "center" };

  worksheet.getCell(`E${rowIndex}`).value = `Mô Cây, ngày ... tháng ... năm 2025`;
  worksheet.getCell(`E${rowIndex}`).alignment = { horizontal: "center" };

  rowIndex++;
  worksheet.getCell(`E${rowIndex}`).value = "GIÁO VIÊN";
  worksheet.getCell(`E${rowIndex}`).font = { bold: true };
  worksheet.getCell(`E${rowIndex}`).alignment = { horizontal: "center" };

  rowIndex += 4;
  worksheet.getCell(`E${rowIndex}`).value = data.teacher.name;
  worksheet.getCell(`E${rowIndex}`).alignment = { horizontal: "center" };

  // Adjust column widths
  worksheet.getColumn(1).width = 5;
  worksheet.getColumn(2).width = 15;
  worksheet.getColumn(3).width = 15;
  worksheet.getColumn(4).width = 12;
  worksheet.getColumn(5).width = 10;
  worksheet.getColumn(6).width = 12;
  worksheet.getColumn(7).width = 20;

  return workbook;
};

/**
 * Tạo file Excel báo cáo năm
 */
const createYearExcelReport = async (data) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Báo cáo năm học");

  const schoolYear = data.records[0]?.schoolYear || "2025-2026";

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
  worksheet.getCell(
    "A4"
  ).value = `BÁO CÁO TỔNG HỢP NĂM HỌC ${schoolYear}`;
  worksheet.getCell("A4").font = { bold: true, size: 14 };
  worksheet.getCell("A4").alignment = { horizontal: "center" };

  // Thông tin giáo viên
  worksheet.getCell(
    "A6"
  ).value = `Họ và tên giáo viên: ${data.teacher.name}`;
  worksheet.getCell("A6").font = { bold: true };

  worksheet.getCell("A7").value = `Email: ${data.teacher.email}`;

  // Table header
  const headerRow = 9;
  worksheet.mergeCells(`A${headerRow}:A${headerRow + 1}`);
  worksheet.getCell(`A${headerRow}`).value = "STT";

  worksheet.mergeCells(`B${headerRow}:B${headerRow + 1}`);
  worksheet.getCell(`B${headerRow}`).value = "Lớp";

  worksheet.mergeCells(`C${headerRow}:C${headerRow + 1}`);
  worksheet.getCell(`C${headerRow}`).value = "Môn học";

  // Học kỳ I
  worksheet.mergeCells(`D${headerRow}:F${headerRow}`);
  worksheet.getCell(`D${headerRow}`).value = "HỌC KỲ I";

  worksheet.getCell(`D${headerRow + 1}`).value = "Số tiết";
  worksheet.getCell(`E${headerRow + 1}`).value = "Số tuần";
  worksheet.getCell(`F${headerRow + 1}`).value = "TB/tuần";

  // Học kỳ II
  worksheet.mergeCells(`G${headerRow}:I${headerRow}`);
  worksheet.getCell(`G${headerRow}`).value = "HỌC KỲ II";

  worksheet.getCell(`G${headerRow + 1}`).value = "Số tiết";
  worksheet.getCell(`H${headerRow + 1}`).value = "Số tuần";
  worksheet.getCell(`I${headerRow + 1}`).value = "TB/tuần";

  worksheet.mergeCells(`J${headerRow}:J${headerRow + 1}`);
  worksheet.getCell(`J${headerRow}`).value = "Tổng năm";

  worksheet.mergeCells(`K${headerRow}:K${headerRow + 1}`);
  worksheet.getCell(`K${headerRow}`).value = "Ghi chú";

  // Style header
  for (let col = 1; col <= 11; col++) {
    for (let row = headerRow; row <= headerRow + 1; row++) {
      const cell = worksheet.getCell(row, col);
      cell.font = { bold: true };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };
    }
  }

  // Group data by class, subject, and semester
  const groupedData = {};
  data.records.forEach((record) => {
    const className = record.classId?.name || "Unknown";
    const subjectName = record.subjectId?.name || "Unknown";
    const semester = record.weekId?.semester || 1;
    const key = `${className}-${subjectName}`;

    if (!groupedData[key]) {
      groupedData[key] = {
        className,
        subjectName,
        semester1: { totalPeriods: 0, weeks: new Set() },
        semester2: { totalPeriods: 0, weeks: new Set() },
      };
    }

    const semesterKey = semester === 1 ? "semester1" : "semester2";
    groupedData[key][semesterKey].totalPeriods += record.periods;
    if (record.weekId?.weekNumber) {
      groupedData[key][semesterKey].weeks.add(record.weekId.weekNumber);
    }
  });

  // Data rows
  let rowIndex = headerRow + 2;
  let stt = 1;

  Object.values(groupedData).forEach((item) => {
    const row = worksheet.getRow(rowIndex);

    // Học kỳ I
    const sem1WeekCount = item.semester1.weeks.size || 1;
    const sem1Avg = (item.semester1.totalPeriods / sem1WeekCount).toFixed(1);

    // Học kỳ II
    const sem2WeekCount = item.semester2.weeks.size || 1;
    const sem2Avg = (item.semester2.totalPeriods / sem2WeekCount).toFixed(1);

    // Tổng năm
    const yearTotal = item.semester1.totalPeriods + item.semester2.totalPeriods;

    row.getCell(1).value = stt++;
    row.getCell(2).value = item.className;
    row.getCell(3).value = item.subjectName;

    row.getCell(4).value = item.semester1.totalPeriods;
    row.getCell(5).value = sem1WeekCount;
    row.getCell(6).value = sem1Avg;

    row.getCell(7).value = item.semester2.totalPeriods;
    row.getCell(8).value = sem2WeekCount;
    row.getCell(9).value = sem2Avg;

    row.getCell(10).value = yearTotal;
    row.getCell(11).value = "";

    // Style data row
    for (let col = 1; col <= 11; col++) {
      const cell = row.getCell(col);
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      if (col === 1 || col >= 4) {
        cell.alignment = { horizontal: "center" };
      }
    }

    rowIndex++;
  });

  // Tổng cộng
  const totalRow = worksheet.getRow(rowIndex);
  totalRow.getCell(1).value = "";
  totalRow.getCell(2).value = "TỔNG CỘNG";
  totalRow.getCell(3).value = "";

  // Tính tổng học kỳ I
  const sem1Total = data.records
    .filter((r) => r.weekId?.semester === 1)
    .reduce((sum, r) => sum + r.periods, 0);

  // Tính tổng học kỳ II
  const sem2Total = data.records
    .filter((r) => r.weekId?.semester === 2)
    .reduce((sum, r) => sum + r.periods, 0);

  totalRow.getCell(4).value = sem1Total;
  totalRow.getCell(5).value = "";
  totalRow.getCell(6).value = "";

  totalRow.getCell(7).value = sem2Total;
  totalRow.getCell(8).value = "";
  totalRow.getCell(9).value = "";

  totalRow.getCell(10).value = data.statistics.totalPeriods;
  totalRow.getCell(11).value = "";

  totalRow.font = { bold: true };
  for (let col = 1; col <= 11; col++) {
    const cell = totalRow.getCell(col);
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF0F0F0" },
    };
    if (col >= 4) {
      cell.alignment = { horizontal: "center" };
    }
  }

  // Biểu đồ thống kê
  rowIndex += 3;
  worksheet.getCell(`A${rowIndex}`).value = "THỐNG KÊ TỔNG HỢP:";
  worksheet.getCell(`A${rowIndex}`).font = { bold: true, size: 12 };

  rowIndex += 2;
  worksheet.getCell(`A${rowIndex}`).value = "1. Theo học kỳ:";
  worksheet.getCell(`A${rowIndex}`).font = { bold: true };

  rowIndex++;
  worksheet.getCell(
    `A${rowIndex}`
  ).value = `   - Học kỳ I: ${sem1Total} tiết`;
  rowIndex++;
  worksheet.getCell(
    `A${rowIndex}`
  ).value = `   - Học kỳ II: ${sem2Total} tiết`;
  rowIndex++;
  worksheet.getCell(
    `A${rowIndex}`
  ).value = `   - Tổng cả năm: ${data.statistics.totalPeriods} tiết`;

  rowIndex += 2;
  worksheet.getCell(`A${rowIndex}`).value = "2. Theo môn học:";
  worksheet.getCell(`A${rowIndex}`).font = { bold: true };

  rowIndex++;
  Object.entries(data.statistics.bySubject).forEach(([subject, stats]) => {
    worksheet.getCell(
      `A${rowIndex}`
    ).value = `   - ${subject}: ${stats.periods} tiết (${stats.count} buổi)`;
    rowIndex++;
  });

  rowIndex++;
  worksheet.getCell(`A${rowIndex}`).value = "3. Theo lớp:";
  worksheet.getCell(`A${rowIndex}`).font = { bold: true };

  rowIndex++;
  Object.entries(data.statistics.byClass).forEach(([className, stats]) => {
    worksheet.getCell(
      `A${rowIndex}`
    ).value = `   - ${className}: ${stats.periods} tiết (${stats.count} buổi)`;
    rowIndex++;
  });

  // Footer signatures
  rowIndex += 3;
  worksheet.getCell(`A${rowIndex}`).value = "HIỆU TRƯỞNG";
  worksheet.getCell(`A${rowIndex}`).font = { bold: true };
  worksheet.getCell(`A${rowIndex}`).alignment = { horizontal: "center" };

  worksheet.getCell(`E${rowIndex}`).value = "TỔ TRƯỞNG";
  worksheet.getCell(`E${rowIndex}`).font = { bold: true };
  worksheet.getCell(`E${rowIndex}`).alignment = { horizontal: "center" };

  worksheet.getCell(`I${rowIndex}`).value = `Mô Cây, ngày ... tháng ... năm 2025`;
  worksheet.getCell(`I${rowIndex}`).alignment = { horizontal: "center" };

  rowIndex++;
  worksheet.getCell(`I${rowIndex}`).value = "GIÁO VIÊN";
  worksheet.getCell(`I${rowIndex}`).font = { bold: true };
  worksheet.getCell(`I${rowIndex}`).alignment = { horizontal: "center" };

  rowIndex += 4;
  worksheet.getCell(`I${rowIndex}`).value = data.teacher.name;
  worksheet.getCell(`I${rowIndex}`).alignment = { horizontal: "center" };

  // Adjust column widths
  worksheet.getColumn(1).width = 5;
  worksheet.getColumn(2).width = 15;
  worksheet.getColumn(3).width = 15;
  worksheet.getColumn(4).width = 10;
  worksheet.getColumn(5).width = 10;
  worksheet.getColumn(6).width = 10;
  worksheet.getColumn(7).width = 10;
  worksheet.getColumn(8).width = 10;
  worksheet.getColumn(9).width = 10;
  worksheet.getColumn(10).width = 12;
  worksheet.getColumn(11).width = 20;

  return workbook;
};

// Export các functions
module.exports = {
  getTeacherReport,
  exportMonthReport,
  exportWeekReport,
  exportSemesterReport,
  exportYearReport,
  calculateStatistics,
  createMonthExcelReport,
  createWeekExcelReport,
  createSemesterExcelReport,
  createYearExcelReport,
};