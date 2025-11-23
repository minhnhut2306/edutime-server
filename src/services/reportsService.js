const TeachingRecords = require("../models/teachingRecordsModel");
const Teacher = require("../models/teacherModel");
const Week = require("../models/weekModel");
const Subject = require("../models/subjectModel");
const Class = require("../models/classesModel");
const ExcelJS = require("exceljs");

/**
 * Lấy báo cáo giáo viên theo BC
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

    const allRecords = await TeachingRecords.find({
      teacherId,
      schoolYear
    })
      .populate("weekId", "weekNumber startDate endDate")
      .populate("subjectId", "name")
      .populate("classId", "name grade")
      .sort({ "weekId.weekNumber": 1 });

    console.log(`📊 Found ${allRecords.length} records for teacher ${teacherId} in year ${schoolYear}`);

    if (allRecords.length === 0) {
      return {
        success: false,
        statusCode: 404,
        message: "Không có dữ liệu giảng dạy trong năm học này",
      };
    }

    return {
      success: true,
      data: {
        teacher: {
          id: teacher._id,
          name: teacher.name,
        },
        schoolYear,
        records: allRecords,
        totalPeriods: allRecords.reduce((sum, r) => sum + (r.periods || 0), 0),
      },
    };
  } catch (error) {
    console.error("❌ Error in getBCReport:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi tạo báo cáo BC: " + error.message,
    };
  }
};

/**
 * Xuất Excel báo cáo BC
 */
const exportBCReport = async (teacherId, schoolYear, bcNumber) => {
  try {
    console.log(`📤 Exporting BC report for teacher ${teacherId}, year ${schoolYear}, BC ${bcNumber}`);
    
    const reportData = await getBCReport(teacherId, schoolYear, bcNumber);

    if (!reportData.success) {
      console.error("❌ Failed to get report data:", reportData.message);
      return reportData;
    }

    console.log(`✅ Got report data with ${reportData.data.records.length} records`);

    const workbook = await createBCExcelReport(reportData.data, bcNumber);

    return {
      success: true,
      data: { workbook },
    };
  } catch (error) {
    console.error("❌ Error in exportBCReport:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi xuất báo cáo BC Excel: " + error.message,
    };
  }
};

/**
 * Xuất Excel báo cáo tháng
 */
const exportMonthReport = async (teacherId, schoolYear, month) => {
  try {
    console.log(`📤 Exporting month report for teacher ${teacherId}, year ${schoolYear}, month ${month}`);
    
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy giáo viên",
      };
    }

    const allRecords = await TeachingRecords.find({
      teacherId,
      schoolYear
    })
      .populate("weekId", "weekNumber startDate endDate")
      .populate("subjectId", "name")
      .populate("classId", "name grade")
      .sort({ "weekId.weekNumber": 1 });

    console.log(`📊 Found ${allRecords.length} total records`);

    const monthRecords = allRecords.filter(r => {
      if (!r.weekId || !r.weekId.startDate) return false;
      const weekDate = new Date(r.weekId.startDate);
      return weekDate.getMonth() + 1 === parseInt(month);
    });

    console.log(`📊 Filtered to ${monthRecords.length} records for month ${month}`);

    if (monthRecords.length === 0) {
      return {
        success: false,
        statusCode: 404,
        message: `Không có dữ liệu giảng dạy trong tháng ${month}`,
      };
    }

    const workbook = await createMonthExcelReport({
      teacher: {
        id: teacher._id,
        name: teacher.name,
      },
      schoolYear,
      month,
      records: monthRecords,
      totalPeriods: monthRecords.reduce((sum, r) => sum + (r.periods || 0), 0),
    });

    return {
      success: true,
      data: { workbook },
    };
  } catch (error) {
    console.error("❌ Error in exportMonthReport:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi xuất báo cáo tháng Excel: " + error.message,
    };
  }
};

/**
 * Xuất Excel báo cáo tuần
 */
const exportWeekReport = async (teacherId, weekId) => {
  try {
    console.log(`📤 Exporting week report for teacher ${teacherId}, week ${weekId}`);
    
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy giáo viên",
      };
    }

    const week = await Week.findById(weekId);
    if (!week) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy tuần học",
      };
    }

    const records = await TeachingRecords.find({
      teacherId,
      weekId
    })
      .populate("weekId", "weekNumber startDate endDate")
      .populate("subjectId", "name")
      .populate("classId", "name grade");

    console.log(`📊 Found ${records.length} records for week ${weekId}`);

    if (records.length === 0) {
      return {
        success: false,
        statusCode: 404,
        message: "Không có dữ liệu giảng dạy trong tuần này",
      };
    }

    const workbook = await createWeekExcelReport({
      teacher: {
        id: teacher._id,
        name: teacher.name,
      },
      week: {
        weekNumber: week.weekNumber,
        startDate: week.startDate,
        endDate: week.endDate,
      },
      records,
      totalPeriods: records.reduce((sum, r) => sum + (r.periods || 0), 0),
    });

    return {
      success: true,
      data: { workbook },
    };
  } catch (error) {
    console.error("❌ Error in exportWeekReport:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi xuất báo cáo tuần Excel: " + error.message,
    };
  }
};

/**
 * Xuất Excel báo cáo nhiều tuần
 */
const exportWeekRangeReport = async (teacherId, weekIds) => {
  try {
    console.log(`📤 Exporting week range report for teacher ${teacherId}, weeks:`, weekIds);
    
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
      weekId: { $in: weekIds }
    })
      .populate("weekId", "weekNumber startDate endDate")
      .populate("subjectId", "name")
      .populate("classId", "name grade")
      .sort({ "weekId.weekNumber": 1 });

    console.log(`📊 Found ${records.length} records for ${weekIds.length} weeks`);

    if (records.length === 0) {
      return {
        success: false,
        statusCode: 404,
        message: "Không có dữ liệu cho các tuần đã chọn",
      };
    }

    const weeks = await Week.find({ _id: { $in: weekIds } }).sort({ weekNumber: 1 });

    const workbook = await createWeekRangeExcelReport({
      teacher: {
        id: teacher._id,
        name: teacher.name,
      },
      weeks,
      records,
      totalPeriods: records.reduce((sum, r) => sum + (r.periods || 0), 0),
    });

    return {
      success: true,
      data: { 
        workbook,
        bcInfo: [{
          bcNumber: 1,
          weeks: weeks.map(w => ({ weekNumber: w.weekNumber }))
        }]
      },
    };
  } catch (error) {
    console.error("❌ Error in exportWeekRangeReport:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi xuất báo cáo nhiều tuần Excel: " + error.message,
    };
  }
};

/**
 * Xuất Excel báo cáo học kỳ
 */
const exportSemesterReport = async (teacherId, schoolYear, semester) => {
  try {
    console.log(`📤 Exporting semester report for teacher ${teacherId}, year ${schoolYear}, semester ${semester}`);
    
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy giáo viên",
      };
    }

    const allRecords = await TeachingRecords.find({
      teacherId,
      schoolYear
    })
      .populate("weekId", "weekNumber startDate endDate")
      .populate("subjectId", "name")
      .populate("classId", "name grade")
      .sort({ "weekId.weekNumber": 1 });

    const semesterRecords = allRecords.filter(r => {
      if (!r.weekId) return false;
      const weekNum = r.weekId.weekNumber;
      if (semester === 1) {
        return weekNum >= 1 && weekNum <= 18;
      } else {
        return weekNum >= 19 && weekNum <= 35;
      }
    });

    console.log(`📊 Found ${semesterRecords.length} records for semester ${semester}`);

    if (semesterRecords.length === 0) {
      return {
        success: false,
        statusCode: 404,
        message: `Không có dữ liệu giảng dạy trong học kỳ ${semester}`,
      };
    }

    const workbook = await createSemesterExcelReport({
      teacher: {
        id: teacher._id,
        name: teacher.name,
      },
      schoolYear,
      semester,
      records: semesterRecords,
      totalPeriods: semesterRecords.reduce((sum, r) => sum + (r.periods || 0), 0),
    });

    return {
      success: true,
      data: { workbook },
    };
  } catch (error) {
    console.error("❌ Error in exportSemesterReport:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi xuất báo cáo học kỳ Excel: " + error.message,
    };
  }
};

/**
 * Xuất Excel báo cáo năm
 */
const exportYearReport = async (teacherId, schoolYear) => {
  try {
    console.log(`📤 Exporting year report for teacher ${teacherId}, year ${schoolYear}`);
    
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
      .populate("weekId", "weekNumber startDate endDate")
      .populate("subjectId", "name")
      .populate("classId", "name grade")
      .sort({ "weekId.weekNumber": 1 });

    console.log(`📊 Found ${records.length} records for year ${schoolYear}`);

    if (records.length === 0) {
      return {
        success: false,
        statusCode: 404,
        message: "Không có dữ liệu giảng dạy trong năm học này",
      };
    }

    const workbook = await createYearExcelReport({
      teacher: {
        id: teacher._id,
        name: teacher.name,
      },
      schoolYear,
      records,
      totalPeriods: records.reduce((sum, r) => sum + (r.periods || 0), 0),
    });

    return {
      success: true,
      data: { workbook },
    };
  } catch (error) {
    console.error("❌ Error in exportYearReport:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi xuất báo cáo năm Excel: " + error.message,
    };
  }
};

/**
 * Xuất tất cả BC
 */
const exportAllBCReport = async (teacherId, schoolYear) => {
  try {
    return await exportYearReport(teacherId, schoolYear);
  } catch (error) {
    console.error("❌ Error in exportAllBCReport:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi xuất báo cáo tổng hợp BC: " + error.message,
    };
  }
};

/**
 * Lấy báo cáo giáo viên theo loại (month/week/semester/year)
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
        
        const allRecordsForMonth = await TeachingRecords.find({
          teacherId,
          schoolYear: filters.schoolYear
        })
          .populate("weekId", "weekNumber startDate endDate")
          .populate("subjectId", "name")
          .populate("classId", "name grade");
        
        records = allRecordsForMonth.filter(r => {
          if (!r.weekId || !r.weekId.startDate) return false;
          const weekDate = new Date(r.weekId.startDate);
          return weekDate.getMonth() + 1 === parseInt(filters.month);
        });
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
        records = await TeachingRecords.find(query)
          .populate("weekId", "weekNumber startDate endDate")
          .populate("subjectId", "name")
          .populate("classId", "name grade");
        break;
        
      case 'semester':
        if (!filters.semester || !filters.schoolYear) {
          return {
            success: false,
            statusCode: 400,
            message: "Thiếu semester hoặc schoolYear",
          };
        }
        
        const allRecordsForSemester = await TeachingRecords.find({
          teacherId,
          schoolYear: filters.schoolYear
        })
          .populate("weekId", "weekNumber startDate endDate")
          .populate("subjectId", "name")
          .populate("classId", "name grade");
        
        const semester = parseInt(filters.semester);
        records = allRecordsForSemester.filter(r => {
          if (!r.weekId) return false;
          const weekNum = r.weekId.weekNumber;
          if (semester === 1) {
            return weekNum >= 1 && weekNum <= 18;
          } else {
            return weekNum >= 19 && weekNum <= 35;
          }
        });
        break;
        
      case 'year':
        if (!filters.schoolYear) {
          return {
            success: false,
            statusCode: 400,
            message: "Thiếu schoolYear",
          };
        }
        records = await TeachingRecords.find(query)
          .populate("weekId", "weekNumber startDate endDate")
          .populate("subjectId", "name")
          .populate("classId", "name grade")
          .sort({ "weekId.weekNumber": 1 });
        break;
        
      default:
        return {
          success: false,
          statusCode: 400,
          message: "Type không hợp lệ",
        };
    }

    if (records.length === 0) {
      return {
        success: false,
        statusCode: 404,
        message: "Không có dữ liệu giảng dạy",
      };
    }

    const statistics = {
      totalPeriods: records.reduce((sum, r) => sum + (r.periods || 0), 0),
      totalRecords: records.length,
    };

    return {
      success: true,
      data: {
        teacher: {
          id: teacher._id,
          name: teacher.name,
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
      message: "Lỗi khi tạo báo cáo: " + error.message,
    };
  }
};

// ==================== EXCEL CREATION FUNCTIONS ====================

const createBCExcelReport = async (data, bcNumber) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`BC ${bcNumber}`);

  worksheet.mergeCells('A1:F1');
  worksheet.getCell('A1').value = 'BÁO CÁO BIÊN CHẾ';
  worksheet.getCell('A1').font = { bold: true, size: 14 };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  worksheet.getCell('A2').value = `Giáo viên: ${data.teacher.name}`;
  worksheet.getCell('A3').value = `Năm học: ${data.schoolYear}`;
  worksheet.getCell('A4').value = `BC: ${bcNumber}`;

  worksheet.getCell('A6').value = 'Tuần';
  worksheet.getCell('B6').value = 'Lớp';
  worksheet.getCell('C6').value = 'Môn';
  worksheet.getCell('D6').value = 'Số tiết';
  worksheet.getCell('E6').value = 'Ngày bắt đầu';
  worksheet.getCell('F6').value = 'Ngày kết thúc';

  for (let col = 1; col <= 6; col++) {
    const cell = worksheet.getCell(6, col);
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  }

  let rowIndex = 7;
  data.records.forEach(record => {
    worksheet.getCell(`A${rowIndex}`).value = record.weekId?.weekNumber || '';
    worksheet.getCell(`B${rowIndex}`).value = record.classId?.name || '';
    worksheet.getCell(`C${rowIndex}`).value = record.subjectId?.name || '';
    worksheet.getCell(`D${rowIndex}`).value = record.periods || 0;
    worksheet.getCell(`E${rowIndex}`).value = record.weekId?.startDate 
      ? new Date(record.weekId.startDate).toLocaleDateString('vi-VN') 
      : '';
    worksheet.getCell(`F${rowIndex}`).value = record.weekId?.endDate 
      ? new Date(record.weekId.endDate).toLocaleDateString('vi-VN') 
      : '';
    
    rowIndex++;
  });

  worksheet.getCell(`A${rowIndex}`).value = 'TỔNG CỘNG';
  worksheet.getCell(`A${rowIndex}`).font = { bold: true };
  worksheet.getCell(`D${rowIndex}`).value = data.totalPeriods;
  worksheet.getCell(`D${rowIndex}`).font = { bold: true };

  worksheet.getColumn(1).width = 10;
  worksheet.getColumn(2).width = 15;
  worksheet.getColumn(3).width = 20;
  worksheet.getColumn(4).width = 10;
  worksheet.getColumn(5).width = 15;
  worksheet.getColumn(6).width = 15;

  return workbook;
};

const createMonthExcelReport = async (data) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`Tháng ${data.month}`);

  worksheet.mergeCells('A1:F1');
  worksheet.getCell('A1').value = `BÁO CÁO THÁNG ${data.month}`;
  worksheet.getCell('A1').font = { bold: true, size: 14 };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  worksheet.getCell('A2').value = `Giáo viên: ${data.teacher.name}`;
  worksheet.getCell('A3').value = `Năm học: ${data.schoolYear}`;

  worksheet.getCell('A5').value = 'Tuần';
  worksheet.getCell('B5').value = 'Lớp';
  worksheet.getCell('C5').value = 'Môn';
  worksheet.getCell('D5').value = 'Số tiết';
  worksheet.getCell('E5').value = 'Ngày bắt đầu';
  worksheet.getCell('F5').value = 'Ngày kết thúc';

  let rowIndex = 6;
  data.records.forEach(record => {
    worksheet.getCell(`A${rowIndex}`).value = record.weekId?.weekNumber || '';
    worksheet.getCell(`B${rowIndex}`).value = record.classId?.name || '';
    worksheet.getCell(`C${rowIndex}`).value = record.subjectId?.name || '';
    worksheet.getCell(`D${rowIndex}`).value = record.periods || 0;
    worksheet.getCell(`E${rowIndex}`).value = record.weekId?.startDate 
      ? new Date(record.weekId.startDate).toLocaleDateString('vi-VN') 
      : '';
    worksheet.getCell(`F${rowIndex}`).value = record.weekId?.endDate 
      ? new Date(record.weekId.endDate).toLocaleDateString('vi-VN') 
      : '';
    rowIndex++;
  });

  worksheet.getCell(`A${rowIndex}`).value = 'TỔNG CỘNG';
  worksheet.getCell(`A${rowIndex}`).font = { bold: true };
  worksheet.getCell(`D${rowIndex}`).value = data.totalPeriods;
  worksheet.getCell(`D${rowIndex}`).font = { bold: true };

  worksheet.getColumn(1).width = 10;
  worksheet.getColumn(2).width = 15;
  worksheet.getColumn(3).width = 20;
  worksheet.getColumn(4).width = 10;
  worksheet.getColumn(5).width = 15;
  worksheet.getColumn(6).width = 15;

  return workbook;
};

const createWeekExcelReport = async (data) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`Tuần ${data.week.weekNumber}`);

  worksheet.mergeCells('A1:E1');
  worksheet.getCell('A1').value = `BÁO CÁO TUẦN ${data.week.weekNumber}`;
  worksheet.getCell('A1').font = { bold: true, size: 14 };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  worksheet.getCell('A2').value = `Giáo viên: ${data.teacher.name}`;
  worksheet.getCell('A3').value = `Từ ${new Date(data.week.startDate).toLocaleDateString('vi-VN')} đến ${new Date(data.week.endDate).toLocaleDateString('vi-VN')}`;

  worksheet.getCell('A5').value = 'STT';
  worksheet.getCell('B5').value = 'Lớp';
  worksheet.getCell('C5').value = 'Môn';
  worksheet.getCell('D5').value = 'Số tiết';
  worksheet.getCell('E5').value = 'Ghi chú';

  let rowIndex = 6;
  data.records.forEach((record, index) => {
    worksheet.getCell(`A${rowIndex}`).value = index + 1;
    worksheet.getCell(`B${rowIndex}`).value = record.classId?.name || '';
    worksheet.getCell(`C${rowIndex}`).value = record.subjectId?.name || '';
    worksheet.getCell(`D${rowIndex}`).value = record.periods || 0;
    worksheet.getCell(`E${rowIndex}`).value = '';
    rowIndex++;
  });

  worksheet.getCell(`B${rowIndex}`).value = 'TỔNG CỘNG';
  worksheet.getCell(`B${rowIndex}`).font = { bold: true };
  worksheet.getCell(`D${rowIndex}`).value = data.totalPeriods;
  worksheet.getCell(`D${rowIndex}`).font = { bold: true };

  worksheet.getColumn(1).width = 8;
  worksheet.getColumn(2).width = 15;
  worksheet.getColumn(3).width = 20;
  worksheet.getColumn(4).width = 10;
  worksheet.getColumn(5).width = 20;

  return workbook;
};

const createWeekRangeExcelReport = async (data) => {
  const workbook = new ExcelJS.Workbook();
  const weekNumbers = data.weeks.map(w => w.weekNumber).join(', ');
  const worksheet = workbook.addWorksheet(`Tuần ${weekNumbers}`);

  worksheet.mergeCells('A1:E1');
  worksheet.getCell('A1').value = `BÁO CÁO NHIỀU TUẦN`;
  worksheet.getCell('A1').font = { bold: true, size: 14 };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  worksheet.getCell('A2').value = `Giáo viên: ${data.teacher.name}`;
  worksheet.getCell('A3').value = `Các tuần: ${weekNumbers}`;

  worksheet.getCell('A5').value = 'Tuần';
  worksheet.getCell('B5').value = 'Lớp';
  worksheet.getCell('C5').value = 'Môn';
  worksheet.getCell('D5').value = 'Số tiết';
  worksheet.getCell('E5').value = 'Thời gian';

  let rowIndex = 6;
  data.records.forEach(record => {
    worksheet.getCell(`A${rowIndex}`).value = record.weekId?.weekNumber || '';
    worksheet.getCell(`B${rowIndex}`).value = record.classId?.name || '';
    worksheet.getCell(`C${rowIndex}`).value = record.subjectId?.name || '';
    worksheet.getCell(`D${rowIndex}`).value = record.periods || 0;
    worksheet.getCell(`E${rowIndex}`).value = record.weekId?.startDate && record.weekId?.endDate
      ? `${new Date(record.weekId.startDate).toLocaleDateString('vi-VN')} - ${new Date(record.weekId.endDate).toLocaleDateString('vi-VN')}`
      : '';
    rowIndex++;
  });

  worksheet.getCell(`B${rowIndex}`).value = 'TỔNG CỘNG';
  worksheet.getCell(`B${rowIndex}`).font = { bold: true };
  worksheet.getCell(`D${rowIndex}`).value = data.totalPeriods;
  worksheet.getCell(`D${rowIndex}`).font = { bold: true };

  worksheet.getColumn(1).width = 10;
  worksheet.getColumn(2).width = 15;
  worksheet.getColumn(3).width = 20;
  worksheet.getColumn(4).width = 10;
  worksheet.getColumn(5).width = 25;

  return workbook;
};

const createSemesterExcelReport = async (data) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`Học kỳ ${data.semester}`);

  worksheet.mergeCells('A1:F1');
  worksheet.getCell('A1').value = `BÁO CÁO HỌC KỲ ${data.semester}`;
  worksheet.getCell('A1').font = { bold: true, size: 14 };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  worksheet.getCell('A2').value = `Giáo viên: ${data.teacher.name}`;
  worksheet.getCell('A3').value = `Năm học: ${data.schoolYear}`;

  worksheet.getCell('A5').value = 'Tuần';
  worksheet.getCell('B5').value = 'Lớp';
  worksheet.getCell('C5').value = 'Môn';
  worksheet.getCell('D5').value = 'Số tiết';
  worksheet.getCell('E5').value = 'Ngày bắt đầu';
  worksheet.getCell('F5').value = 'Ngày kết thúc';

  let rowIndex = 6;
  data.records.forEach(record => {
    worksheet.getCell(`A${rowIndex}`).value = record.weekId?.weekNumber || '';
    worksheet.getCell(`B${rowIndex}`).value = record.classId?.name || '';
    worksheet.getCell(`C${rowIndex}`).value = record.subjectId?.name || '';
    worksheet.getCell(`D${rowIndex}`).value = record.periods || 0;
    worksheet.getCell(`E${rowIndex}`).value = record.weekId?.startDate 
      ? new Date(record.weekId.startDate).toLocaleDateString('vi-VN') 
      : '';
    worksheet.getCell(`F${rowIndex}`).value = record.weekId?.endDate 
      ? new Date(record.weekId.endDate).toLocaleDateString('vi-VN') 
      : '';
    rowIndex++;
  });

  worksheet.getCell(`A${rowIndex}`).value = 'TỔNG CỘNG';
  worksheet.getCell(`A${rowIndex}`).font = { bold: true };
  worksheet.getCell(`D${rowIndex}`).value = data.totalPeriods;
  worksheet.getCell(`D${rowIndex}`).font = { bold: true };

  worksheet.getColumn(1).width = 10;
  worksheet.getColumn(2).width = 15;
  worksheet.getColumn(3).width = 20;
  worksheet.getColumn(4).width = 10;
  worksheet.getColumn(5).width = 15;
  worksheet.getColumn(6).width = 15;

  return workbook;
};

const createYearExcelReport = async (data) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Báo cáo năm');

  worksheet.mergeCells('A1:F1');
  worksheet.getCell('A1').value = `BÁO CÁO NĂM HỌC ${data.schoolYear}`;
  worksheet.getCell('A1').font = { bold: true, size: 14 };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };

  worksheet.getCell('A2').value = `Giáo viên: ${data.teacher.name}`;

  worksheet.getCell('A4').value = 'Tuần';
  worksheet.getCell('B4').value = 'Lớp';
  worksheet.getCell('C4').value = 'Môn';
  worksheet.getCell('D4').value = 'Số tiết';
  worksheet.getCell('E4').value = 'Ngày bắt đầu';
  worksheet.getCell('F4').value = 'Ngày kết thúc';

  // Style header row
  for (let col = 1; col <= 6; col++) {
    const cell = worksheet.getCell(4, col);
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  }

  let rowIndex = 5;
  data.records.forEach(record => {
    worksheet.getCell(`A${rowIndex}`).value = record.weekId?.weekNumber || '';
    worksheet.getCell(`B${rowIndex}`).value = record.classId?.name || '';
    worksheet.getCell(`C${rowIndex}`).value = record.subjectId?.name || '';
    worksheet.getCell(`D${rowIndex}`).value = record.periods || 0;
    worksheet.getCell(`E${rowIndex}`).value = record.weekId?.startDate 
      ? new Date(record.weekId.startDate).toLocaleDateString('vi-VN') 
      : '';
    worksheet.getCell(`F${rowIndex}`).value = record.weekId?.endDate 
      ? new Date(record.weekId.endDate).toLocaleDateString('vi-VN') 
      : '';
    
    // Add borders to data cells
    for (let col = 1; col <= 6; col++) {
      const cell = worksheet.getCell(rowIndex, col);
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    }
    
    rowIndex++;
  });

  // Total row
  worksheet.getCell(`A${rowIndex}`).value = 'TỔNG CỘNG';
  worksheet.getCell(`A${rowIndex}`).font = { bold: true };
  worksheet.getCell(`D${rowIndex}`).value = data.totalPeriods;
  worksheet.getCell(`D${rowIndex}`).font = { bold: true };
  
  // Add borders and style to total row
  for (let col = 1; col <= 6; col++) {
    const cell = worksheet.getCell(rowIndex, col);
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD700' } };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  }

  // Set column widths
  worksheet.getColumn(1).width = 10;
  worksheet.getColumn(2).width = 15;
  worksheet.getColumn(3).width = 20;
  worksheet.getColumn(4).width = 10;
  worksheet.getColumn(5).width = 15;
  worksheet.getColumn(6).width = 15;

  return workbook;
};

module.exports = {
  // Báo cáo BC
  getBCReport,
  exportBCReport,
  exportAllBCReport,
  
  // Báo cáo thông thường
  getTeacherReport,
  exportMonthReport,
  exportWeekReport,
  exportWeekRangeReport,
  exportSemesterReport,
  exportYearReport,
};