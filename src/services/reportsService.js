const TeachingRecords = require("../models/teachingRecordsModel");
const Teacher = require("../models/teacherModel");
const Week = require("../models/weekModel");
const Subject = require("../models/subjectModel");
const Class = require("../models/classesModel");
const ExcelJS = require("exceljs");
const SchoolYear = require("../models/schoolYearModel");

// ============ HELPER FUNCTIONS ============

const getMonthFromWeek = (week) => {
  if (!week?.startDate) return 9;
  return new Date(week.startDate).getMonth() + 1;
};

const getWeeksInMonth = async (month, schoolYearId) => {
  const [allWeeks, schoolYearDoc] = await Promise.all([
    Week.find({ schoolYearId }).sort({ weekNumber: 1 }),
    SchoolYear.findById(schoolYearId)
  ]);

  if (!schoolYearDoc) throw new Error("Năm học không tồn tại");

  const [startYear, endYear] = schoolYearDoc.year.split("-").map(Number);
  const year = month >= 9 ? startYear : endYear;
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  return allWeeks.filter((week) => {
    const weekStart = new Date(week.startDate);
    const weekEnd = new Date(week.endDate);
    return weekStart <= monthEnd && weekEnd >= monthStart;
  });
};

const groupRecordsByMonth = (records, weeks) => {
  const groups = {};

  records.forEach((record) => {
    const weekId = record.weekId?._id?.toString() || record.weekId?.toString();
    const week = weeks.find((w) => (w._id?.toString() || w.id) === weekId);

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

const generateFileName = (teacher, schoolYear, options = {}) => {
  const { type, bcNumber, semester } = options;
  const teacherShortName = teacher.name.split(" ").pop();
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;

  const fileNameMap = {
    bc: `BC_Thang${String(bcNumber).padStart(2, "0")}_${teacherShortName}_${schoolYear}_${timestamp}.xlsx`,
    semester: `BaoCao_HK${semester}_${teacherShortName}_${schoolYear}_${timestamp}.xlsx`,
    year: `BaoCao_NamHoc_${teacherShortName}_${schoolYear}_${timestamp}.xlsx`,
    week: `BaoCao_Tuan_${teacherShortName}_${schoolYear}_${timestamp}.xlsx`
  };

  return fileNameMap[type] || `BaoCao_${teacherShortName}_${schoolYear}_${timestamp}.xlsx`;
};

// ============ EXCEL SHEET CREATION ============

const applyBorder = (cell) => {
  cell.border = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } }
  };
};

const setCell = (worksheet, address, value, options = {}) => {
  const cell = worksheet.getCell(address);
  cell.value = value;
  if (options.font) cell.font = options.font;
  if (options.alignment) cell.alignment = options.alignment;
  if (options.border) applyBorder(cell);
  cell.fill = { type: "pattern", pattern: "none" };
  return cell;
};

const createHeader = (worksheet, schoolYear, subject, bcNumber) => {
  worksheet.columns = Array(12).fill({ width: 12 });
  worksheet.columns[0] = { width: 5 };
  worksheet.columns[1] = { width: 14 };
  worksheet.columns[6] = { width: 14 };
  worksheet.columns[10] = { width: 14 };
  worksheet.columns[11] = { width: 14 };

  setCell(worksheet, "A1", "SỞ GD&ĐT TỈNH VĨNH LONG", { font: { size: 10 } });
  setCell(worksheet, "A2", "TRUNG TÂM GDNN-GDTX MỎ CÀY NAM", { font: { size: 10, bold: true } });

  worksheet.mergeCells("A4:L4");
  setCell(worksheet, "A4", `BẢNG KÊ GIỜ THÁNG ${String(bcNumber).padStart(2, "0")} NĂM HỌC ${schoolYear} (BIÊN CHẾ)`, {
    font: { size: 14, bold: true },
    alignment: { horizontal: "center", vertical: "middle" }
  });

  worksheet.mergeCells("A5:L5");
  setCell(worksheet, "A5", `Môn : ${subject?.name || "Toán"}`, {
    font: { size: 11, bold: true },
    alignment: { horizontal: "center", vertical: "middle" }
  });
};

const createTeacherInfo = (worksheet, teacher, mainClass, records, weeksCount) => {
  setCell(worksheet, "A7", `Họ và tên giáo viên:   ${teacher.name}`, { font: { size: 11 } });
  setCell(worksheet, "A8", "* Phân công giảng dạy:", { font: { size: 10 } });

  // Tính phân công giảng dạy
  const classInfo = {};
  const teachingRecords = records.filter(r => r.recordType === "teaching" || !r.recordType);
  
  teachingRecords.forEach(r => {
    const className = r.classId?.name || "";
    if (className) classInfo[className] = (classInfo[className] || 0) + (r.periods || 0);
  });

  const phanCongParts = Object.entries(classInfo).map(
    ([cls, total]) => `Lớp: ${cls} giảng dạy ${Math.round(total / weeksCount)} tiết/tuần`
  );

  setCell(worksheet, "B8", phanCongParts.length > 0 ? `- ${phanCongParts.join("; ")}` : "", { font: { size: 10 } });

  const totalTeachingPerWeek = Math.round(
    teachingRecords.reduce((sum, r) => sum + (r.periods || 0), 0) / weeksCount
  );

  worksheet.mergeCells("H9:L9");
  setCell(worksheet, "H9", `Tổng cộng số tiết giảng dạy/tuần: ${String(totalTeachingPerWeek).padStart(2, "0")} Tiết`, {
    font: { size: 10 },
    alignment: { horizontal: "left" }
  });

  // Phân công kiêm nhiệm
  setCell(worksheet, "A10", "* Phân công kiêm nhiệm:", { font: { size: 10 } });
  setCell(worksheet, "B10", `-Chủ nhiệm lớp: ${mainClass?.name || ".........."} tiết/tuần`, { font: { size: 10 } });

  const extraRecords = records.filter(r => r.recordType === "extra");
  const totalExtraPerWeek = Math.round(
    extraRecords.reduce((sum, r) => sum + (r.periods || 0), 0) / weeksCount
  );

  setCell(worksheet, "B11", `-Kiêm nhiệm: ${totalExtraPerWeek > 0 ? totalExtraPerWeek : "............."} tiết/tuần`, { font: { size: 10 } });

  worksheet.mergeCells("H11:L11");
  setCell(worksheet, "H11", `Tổng cộng số tiết kiêm nhiệm/tuần: ${totalExtraPerWeek > 0 ? String(totalExtraPerWeek).padStart(2, "0") : "......"} tiết.`, {
    font: { size: 10 },
    alignment: { horizontal: "left" }
  });
};

const createTableHeader = (worksheet, weeksInMonth) => {
  const mergeCells = ["A13:A14", "B13:B14", "C13:F13", "G13:G14", "H13:H14", "I13:I14", "J13:J14", "K13:K14", "L13:L14"];
  mergeCells.forEach(range => worksheet.mergeCells(range));

  const headers = {
    A13: "TT", B13: "Phân công", C13: "THỜI GIAN",
    G13: "Tổng số tiết thực dạy, kiêm nhiệm", H13: "Giờ tiêu chuẩn",
    I13: "Giờ dư", J13: "Đơn giá", K13: "Thành tiền", L13: "Phụ chú"
  };

  Object.entries(headers).forEach(([addr, val]) => {
    setCell(worksheet, addr, val, {
      font: { bold: true, size: 9 },
      alignment: { horizontal: "center", vertical: "middle", wrapText: true },
      border: true
    });
  });

  // Tuần headers
  const weeks = weeksInMonth.slice(0, 4);
  for (let i = 0; i < 4; i++) {
    const col = String.fromCharCode(67 + i);
    if (weeks[i]) {
      const s = new Date(weeks[i].startDate);
      const e = new Date(weeks[i].endDate);
      setCell(worksheet, `${col}14`, `Tuần ${i + 1}\nTừ ${s.toLocaleDateString("vi-VN")}\nđến ${e.toLocaleDateString("vi-VN")}`, {
        font: { bold: true, size: 9 },
        alignment: { wrapText: true, vertical: "middle", horizontal: "center" },
        border: true
      });
    } else {
      setCell(worksheet, `${col}14`, `Tuần ${i + 1}`, {
        font: { bold: true, size: 9 },
        alignment: { vertical: "middle", horizontal: "center" },
        border: true
      });
    }
  }

  worksheet.getRow(13).height = 25;
  worksheet.getRow(14).height = 50;
};

const createDataRows = (worksheet, records, weeksInMonth) => {
  const categories = [
    { label: "Khối 12", grades: ["12"], recordTypes: ["teaching", null, undefined] },
    { label: "Khối 11", grades: ["11"], recordTypes: ["teaching", null, undefined] },
    { label: "Khối 10", grades: ["10"], recordTypes: ["teaching", null, undefined] },
    { label: "TN-HN 1", grades: [], recordTypes: ["tn-hn1"] },
    { label: "TN-HN 2", grades: [], recordTypes: ["tn-hn2"] },
    { label: "TN-HN 3", grades: [], recordTypes: ["tn-hn3"] },
    { label: "Kiêm nhiệm", grades: [], recordTypes: ["extra"] },
    { label: "Coi thi", grades: [], recordTypes: ["exam"] }
  ];

  let rowIndex = 15;
  let grandTotal = 0;
  const weekTotals = [0, 0, 0, 0];
  const weeks = weeksInMonth.slice(0, 4);

  categories.forEach((cat, idx) => {
    setCell(worksheet, `A${rowIndex}`, idx + 1, { border: true, alignment: { horizontal: "center", vertical: "middle" } });
    setCell(worksheet, `B${rowIndex}`, cat.label, { border: true, alignment: { horizontal: "center", vertical: "middle" } });

    let rowTotal = 0;

    for (let i = 0; i < 4; i++) {
      const col = String.fromCharCode(67 + i);
      let weekPeriods = 0;

      if (weeks[i]) {
        const weekId = weeks[i]._id?.toString();
        const weekRecs = records.filter(r => {
          const rWeekId = r.weekId?._id?.toString() || r.weekId?.toString();
          const rType = r.recordType || "teaching";
          const rGrade = r.classId?.grade;

          if (rWeekId !== weekId) return false;
          if (!cat.recordTypes.includes(rType)) return false;
          if (cat.grades.length > 0) return cat.grades.includes(rGrade);
          return true;
        });

        weekPeriods = weekRecs.reduce((sum, r) => sum + (r.periods || 0), 0);
      }

      setCell(worksheet, `${col}${rowIndex}`, weekPeriods, { border: true, alignment: { horizontal: "center", vertical: "middle" } });
      rowTotal += weekPeriods;
      weekTotals[i] += weekPeriods;
    }

    setCell(worksheet, `G${rowIndex}`, rowTotal, { border: true, alignment: { horizontal: "center", vertical: "middle" } });
    grandTotal += rowTotal;

    // Apply border to remaining cells
    for (let c = 7; c < 12; c++) {
      applyBorder(worksheet.getCell(rowIndex, c + 1));
    }

    rowIndex++;
  });

  // Tổng cộng row
  setCell(worksheet, `B${rowIndex}`, "Tổng cộng", { font: { bold: true, size: 10 }, border: true, alignment: { horizontal: "center", vertical: "middle" } });

  for (let i = 0; i < 4; i++) {
    setCell(worksheet, `${String.fromCharCode(67 + i)}${rowIndex}`, weekTotals[i], { font: { bold: true, size: 10 }, border: true, alignment: { horizontal: "center", vertical: "middle" } });
  }

  const standardHours = 68;
  setCell(worksheet, `G${rowIndex}`, grandTotal, { font: { bold: true, size: 10 }, border: true, alignment: { horizontal: "center", vertical: "middle" } });
  setCell(worksheet, `H${rowIndex}`, standardHours, { font: { bold: true, size: 10 }, border: true, alignment: { horizontal: "center", vertical: "middle" } });
  setCell(worksheet, `I${rowIndex}`, grandTotal - standardHours, { font: { bold: true, size: 10 }, border: true, alignment: { horizontal: "center", vertical: "middle" } });

  for (let c = 0; c < 3; c++) {
    applyBorder(worksheet.getCell(rowIndex, c + 1));
    worksheet.getCell(rowIndex, c + 1).font = { bold: true, size: 10 };
    worksheet.getCell(rowIndex, c + 1).alignment = { horizontal: "center", vertical: "middle" };
  }

  for (let c = 9; c < 12; c++) {
    applyBorder(worksheet.getCell(rowIndex, c + 1));
  }

  return rowIndex;
};

const createFooter = (worksheet, rowIndex) => {
  rowIndex += 2;
  setCell(worksheet, `A${rowIndex}`, "Số tiền đề nghị thanh toán...............................đồng. (Ghi bằng chữ:.......................................................................)");

  rowIndex += 2;
  const today = new Date();
  const dateStr = `Mỏ Cày, ngày ${String(today.getDate()).padStart(2, "0")} tháng ${String(today.getMonth() + 1).padStart(2, "0")} năm ${today.getFullYear()}`;

  setCell(worksheet, `D${rowIndex}`, dateStr, { font: { size: 10, italic: true } });
  setCell(worksheet, `J${rowIndex}`, dateStr, { font: { size: 10, italic: true } });

  rowIndex++;
  setCell(worksheet, `A${rowIndex}`, "PHÓ GIÁM ĐỐC", { font: { bold: true, size: 10 } });
  setCell(worksheet, `D${rowIndex}`, "TỔ TRƯỞNG DUYỆT", { font: { bold: true, size: 10 } });
  setCell(worksheet, `J${rowIndex}`, "GIÁO VIÊN KÊ GIỜ", { font: { bold: true, size: 10 } });
};

const createBCSheet = async (workbook, sheetName, teacher, subject, mainClass, records, weeksInMonth, bcNumber, schoolYear) => {
  const worksheet = workbook.addWorksheet(sheetName.substring(0, 31));
  worksheet.views = [{ showGridLines: false }];

  const weeksCount = Math.max(weeksInMonth.length, 1);

  createHeader(worksheet, schoolYear, subject, bcNumber);
  createTeacherInfo(worksheet, teacher, mainClass, records, weeksCount);
  createTableHeader(worksheet, weeksInMonth);
  const lastRowIndex = createDataRows(worksheet, records, weeksInMonth);
  createFooter(worksheet, lastRowIndex);

  worksheet.getRow(4).height = 25;
};

// ============ EXPORT FUNCTIONS ============

const exportReport = async (teacherIds, schoolYearId, options = {}) => {
  try {
    const { type = "bc", bcNumber, weekId, weekIds, semester } = options;
    const teacherIdArray = Array.isArray(teacherIds) ? teacherIds : [teacherIds];

    const [allWeeks, schoolYearDoc] = await Promise.all([
      Week.find({ schoolYearId }).sort({ weekNumber: 1 }),
      SchoolYear.findById(schoolYearId)
    ]);

    if (!schoolYearDoc) {
      return {
        success: false,
        statusCode: 404,
        message: "Năm học không tồn tại"
      };
    }

    const schoolYearString = schoolYearDoc.year;
    const workbook = new ExcelJS.Workbook();
    let sheetCount = 0;
    let primaryTeacher = null;

    for (const teacherId of teacherIdArray) {
      const teacher = await Teacher.findById(teacherId)
        .populate("subjectIds", "name")
        .populate("mainClassId", "name grade");

      if (!teacher) continue;
      if (!primaryTeacher) primaryTeacher = teacher;

      // Build query
      let query = { teacherId, schoolYearId };

      if (type === "week" && weekId) {
        query.weekId = weekId;
      } else if (type === "week" && weekIds?.length > 0) {
        query.weekId = { $in: weekIds };
      } else if (type === "semester" && semester) {
        const semesterWeeks = allWeeks.filter(w => {
          const wn = w.weekNumber || 0;
          return semester === 1 ? wn >= 1 && wn <= 18 : wn >= 19 && wn <= 35;
        });
        query.weekId = { $in: semesterWeeks.map(w => w._id) };
      }

      const records = await TeachingRecords.find(query)
        .populate("weekId", "weekNumber startDate endDate")
        .populate("subjectId", "name")
        .populate("classId", "name grade")
        .sort({ "weekId.weekNumber": 1 });

      if (records.length === 0) continue;

      const monthGroups = groupRecordsByMonth(records, allWeeks);
      let monthsToExport = Object.keys(monthGroups).map(Number);

      if (bcNumber) monthsToExport = monthsToExport.filter(m => m === bcNumber);

      for (const month of monthsToExport.sort((a, b) => {
        const orderA = a >= 9 ? a - 9 : a + 3;
        const orderB = b >= 9 ? b - 9 : b + 3;
        return orderA - orderB;
      })) {
        const monthData = monthGroups[month];
        if (!monthData?.records.length) continue;

        const weeksInMonth = await getWeeksInMonth(month, schoolYearId);
        const teacherShortName = teacher.name.split(" ").pop();
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
          schoolYearString
        );
        sheetCount++;
      }
    }

    if (sheetCount === 0) {
      return {
        success: false,
        statusCode: 404,
        message: `Không tìm thấy dữ liệu giảng dạy cho năm học ${schoolYearString}.\n\nGiáo viên chưa nhập tiết dạy hoặc dữ liệu thuộc năm học khác.`
      };
    }

    const fileName = generateFileName(primaryTeacher, schoolYearString, options);

    return {
      success: true,
      data: { workbook, sheetCount, fileName }
    };
  } catch (error) {
    console.error("❌ exportReport error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi hệ thống khi xuất báo cáo. Vui lòng thử lại sau!"
    };
  }
};

// Export wrappers
const exportBCReport = (teacherIds, schoolYearId, bcNumber) => 
  exportReport(teacherIds, schoolYearId, { type: "bc", bcNumber });

const exportMonthReport = (teacherId, schoolYearId, month, bcNumber = null) => 
  exportReport(teacherId, schoolYearId, { type: "bc", bcNumber: bcNumber || month });

const exportWeekReport = async (teacherId, weekId, schoolYearId) => {
  const week = await Week.findById(weekId);
  if (!week) return { success: false, statusCode: 404, message: "Không tìm thấy tuần học" };
  
  return exportReport(teacherId, schoolYearId || week.schoolYearId, { type: "week", weekId });
};

const exportWeekRangeReport = async (teacherId, weekIds, schoolYearId) => {
  if (!weekIds?.length) return { success: false, statusCode: 400, message: "Phải cung cấp weekIds" };
  
  const week = await Week.findById(weekIds[0]);
  if (!week) return { success: false, statusCode: 404, message: "Không tìm thấy tuần học" };
  
  return exportReport(teacherId, schoolYearId || week.schoolYearId, { type: "week", weekIds });
};

const exportSemesterReport = (teacherId, schoolYearId, semester) => 
  exportReport(teacherId, schoolYearId, { type: "semester", semester });

const exportYearReport = (teacherId, schoolYearId) => 
  exportReport(teacherId, schoolYearId, { type: "year" });

const exportAllBCReport = (teacherId, schoolYearId) => 
  exportReport(teacherId, schoolYearId, { type: "year" });

const getBCReport = async (teacherId, schoolYearId, bcNumber) => {
  try {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return { success: false, statusCode: 404, message: "Không tìm thấy giáo viên" };

    const [records, schoolYearDoc] = await Promise.all([
      TeachingRecords.find({ teacherId, schoolYearId })
        .populate("weekId", "weekNumber startDate endDate")
        .populate("subjectId", "name")
        .populate("classId", "name grade"),
      SchoolYear.findById(schoolYearId)
    ]);

    if (records.length === 0) {
      return {
        success: false,
        statusCode: 404,
        message: `Không có dữ liệu giảng dạy cho năm học ${schoolYearDoc?.year || "này"}`
      };
    }

    return {
      success: true,
      data: {
        teacher: { id: teacher._id, name: teacher.name },
        schoolYear: schoolYearDoc?.year,
        bcNumber,
        records,
        totalPeriods: records.reduce((sum, r) => sum + (r.periods || 0), 0)
      }
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
    if (filters.schoolYearId) query.schoolYearId = filters.schoolYearId;

    const [records, schoolYearDoc] = await Promise.all([
      TeachingRecords.find(query)
        .populate("weekId", "weekNumber startDate endDate")
        .populate("subjectId", "name")
        .populate("classId", "name grade")
        .sort({ "weekId.weekNumber": 1 }),
      filters.schoolYearId ? SchoolYear.findById(filters.schoolYearId) : null
    ]);

    if (records.length === 0) {
      return {
        success: false,
        statusCode: 404,
        message: filters.schoolYearId
          ? `Không có dữ liệu giảng dạy cho năm học ${schoolYearDoc?.year || "này"}`
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
          totalRecords: records.length
        }
      }
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
  generateFileName
};