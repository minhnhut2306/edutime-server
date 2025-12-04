const mongoose = require("mongoose");
const TeachingRecords = require("../models/teachingRecordsModel");
const Teacher = require("../models/teacherModel");
const Week = require("../models/weekModel");
const SchoolYear = require("../models/schoolYearModel");
const ExcelJS = require("exceljs");
const { createBCSheet } = require("./reportsSheetBuilder");

const isValidObjectId = (id) => !!(id && mongoose.Types.ObjectId.isValid(id));

const getMonthFromWeek = (week) => {
  if (!week?.startDate) return 9;
  return new Date(week.startDate).getMonth() + 1;
};

const getWeeksInMonth = async (month, schoolYearLabel) => {
  const allWeeks = await Week.find({}).sort({ weekNumber: 1 });
  if (!schoolYearLabel) {
    return allWeeks.filter(w => getMonthFromWeek(w) === month);
  }
  const [startYear, endYear] = schoolYearLabel.split('-').map(Number);
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

const resolveSchoolYearLabel = async (schoolYearId) => {
  if (!schoolYearId || !isValidObjectId(schoolYearId)) {
    return null;
  }
  
  try {
    const sy = await SchoolYear.findById(schoolYearId);
    if (!sy) return null;
    return sy.year || sy.label || (sy.startYear && sy.endYear ? `${sy.startYear}-${sy.endYear}` : String(sy._id));
  } catch (e) {
    return null;
  }
};


const exportReport = async (teacherIds, schoolYearId, options = {}) => {
  try {
    const { type = 'bc', bcNumber, bcNumbers, weekId, weekIds, semester } = options;
    const teacherIdArray = Array.isArray(teacherIds) ? teacherIds : [teacherIds];

    const allWeeks = await Week.find({}).sort({ weekNumber: 1 });

    let schoolYearLabel = null;
    let resolvedSchoolYearId = schoolYearId;
    
    if (schoolYearId) {
      if (!isValidObjectId(schoolYearId)) {
        return { success: false, statusCode: 400, message: "schoolYearId không hợp lệ" };
      }
      const sy = await SchoolYear.findById(schoolYearId);
      if (!sy) {
        return { success: false, statusCode: 404, message: "Không tìm thấy năm học" };
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
        
        if (!teacher) continue;

        let query = { teacherId };
        if (resolvedSchoolYearId) query.schoolYearId = resolvedSchoolYearId;

        const allRecords = await TeachingRecords.find(query)
          .populate("weekId", "weekNumber startDate endDate")
          .populate("subjectId", "name")
          .populate("classId", "name grade")
          .sort({ "weekId.weekNumber": 1 });

        // Xử lý theo loại báo cáo
        let monthsToExport = [];
        let weeksToExport = [];
        
        if (type === 'bc') {
          if (bcNumbers && bcNumbers.length > 0) {
            // Nhiều tháng được chọn - LUÔN xuất tất cả tháng đã chọn
            monthsToExport = bcNumbers;
          } else if (bcNumber) {
            // Một tháng được chọn - LUÔN xuất tháng này
            monthsToExport = [bcNumber];
          } else {
            // Tự động: tất cả tháng có dữ liệu
            const monthGroups = groupRecordsByMonth(allRecords, allWeeks);
            monthsToExport = Object.keys(monthGroups).map(Number);
            // Nếu không có dữ liệu nào, xuất tất cả 12 tháng
            if (monthsToExport.length === 0) {
              monthsToExport = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];
            }
          }
        } else if (type === 'week') {
          // Xử lý tuần: LUÔN xuất tất cả tuần được chọn
          if (weekIds && weekIds.length > 0) {
            weeksToExport = allWeeks.filter(w => weekIds.includes(w._id.toString()));
          } else if (weekId) {
            weeksToExport = allWeeks.filter(w => w._id.toString() === weekId);
          }
          
          // Nhóm tuần theo tháng
          const monthSet = new Set();
          weeksToExport.forEach(w => {
            monthSet.add(getMonthFromWeek(w));
          });
          monthsToExport = Array.from(monthSet);
        } else if (type === 'semester') {
          // Học kỳ: LUÔN xuất tất cả tuần trong học kỳ (có hoặc không có dữ liệu)
          const semesterWeeks = allWeeks.filter(w => {
            const wn = w.weekNumber || 0;
            return semester === 1 ? (wn >= 1 && wn <= 18) : (wn >= 19 && wn <= 35);
          });
          
          // Nếu chưa có tuần nào được tạo cho học kỳ này, xuất file rỗng
          if (semesterWeeks.length === 0) {
            // Tạo một sheet trống cho học kỳ
            const teacherShortName = teacher.name.split(' ').pop();
            const sheetName = teacherIdArray.length > 1 
              ? `${teacherShortName}_HK${semester}`
              : `HK${semester}`;
            
            await createBCSheet(
              workbook,
              sheetName,
              teacher,
              teacher.subjectIds?.[0] || null,
              teacher.mainClassId,
              [],
              [],
              semester === 1 ? 9 : 1,
              schoolYearLabel
            );
            sheetCount++;
            continue;
          }
          
          const monthSet = new Set();
          semesterWeeks.forEach(w => {
            monthSet.add(getMonthFromWeek(w));
          });
          monthsToExport = Array.from(monthSet);
        } else if (type === 'year') {
          // Cả năm: LUÔN xuất tất cả tuần từ tuần 1 đến tuần cao nhất
          const maxWeek = Math.max(...allWeeks.map(w => w.weekNumber || 0));
          
          if (maxWeek === 0) {
            // Không có tuần nào, xuất 12 tháng trống
            monthsToExport = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];
          } else {
            // Xuất tất cả tháng có trong các tuần
            const monthSet = new Set();
            allWeeks.forEach(w => {
              monthSet.add(getMonthFromWeek(w));
            });
            monthsToExport = Array.from(monthSet);
            
            // Nếu vẫn không có tháng nào, xuất 12 tháng mặc định
            if (monthsToExport.length === 0) {
              monthsToExport = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];
            }
          }
        }

        // Sắp xếp tháng theo thứ tự năm học
        monthsToExport.sort((a, b) => {
          const orderA = a >= 9 ? a - 9 : a + 3;
          const orderB = b >= 9 ? b - 9 : b + 3;
          return orderA - orderB;
        });

        // Xuất từng tháng - LUÔN xuất ngay cả khi không có dữ liệu
        for (const month of monthsToExport) {
          const weeksInMonth = await getWeeksInMonth(month, schoolYearLabel);
          
          // Lọc records cho tháng này (có thể rỗng)
          const monthRecords = allRecords.filter(r => {
            const weekId = r.weekId?._id?.toString() || r.weekId?.toString();
            return weeksInMonth.some(w => (w._id?.toString() || w.id) === weekId);
          });

          const teacherShortName = teacher.name.split(' ').pop();
          const sheetName = teacherIdArray.length > 1 
            ? `${teacherShortName}_BC${month}`
            : `BC${month}`;

          // LUÔN tạo sheet, kể cả khi monthRecords rỗng
          await createBCSheet(
            workbook,
            sheetName,
            teacher,
            teacher.subjectIds?.[0] || null,
            teacher.mainClassId,
            monthRecords, // Có thể rỗng
            weeksInMonth, // Có thể rỗng nếu chưa tạo tuần
            month,
            schoolYearLabel
          );
          sheetCount++;
        }
      } catch (innerErr) {
        console.error("Error processing teacher:", innerErr);
        continue;
      }
    }

    if (sheetCount === 0) {
      return { 
        success: false, 
        statusCode: 404, 
        message: `Không thể tạo báo cáo cho năm học ${schoolYearLabel || schoolYearId}` 
      };
    }

    return { 
      success: true, 
      data: { 
        workbook, 
        sheetCount, 
        schoolYearLabel, 
        fileName: `BaoCao_${schoolYearLabel || 'report'}.xlsx`,
        teachers: teacherIdArray 
      } 
    };
  } catch (error) {
    console.error("Export error:", error);
    return { 
      success: false, 
      statusCode: 500, 
      message: "Lỗi hệ thống khi xuất báo cáo: " + (error.message || '') 
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

const inferSchoolYearId = async (weekDate) => {
  const year = weekDate.getFullYear();
  const month = weekDate.getMonth() + 1;
  const schoolYearStr = month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  const sy = await SchoolYear.findOne({ year: schoolYearStr });
  return sy?._id || null;
};

const exportWeekReport = async (teacherId, weekId, schoolYearId) => {
  try {
    const week = await Week.findById(weekId);
    if (!week) {
      return { success: false, statusCode: 404, message: "Không tìm thấy tuần học" };
    }
    
    const resolvedSchoolYearId = schoolYearId || await inferSchoolYearId(new Date(week.startDate));
    
    return await exportReport(teacherId, resolvedSchoolYearId, { type: 'week', weekId });
  } catch (error) {
    return { success: false, statusCode: 500, message: "Lỗi khi xuất báo cáo tuần: " + (error.message || '') };
  }
};

const exportWeekRangeReport = async (teacherId, weekIds, schoolYearId) => {
  try {
    if (!weekIds || weekIds.length === 0) {
      return { success: false, statusCode: 400, message: "Phải cung cấp weekIds" };
    }
    
    const week = await Week.findById(weekIds[0]);
    if (!week) {
      return { success: false, statusCode: 404, message: "Không tìm thấy tuần học" };
    }
    
    const resolvedSchoolYearId = schoolYearId || await inferSchoolYearId(new Date(week.startDate));
    
    return await exportReport(teacherId, resolvedSchoolYearId, { type: 'week', weekIds });
  } catch (error) {
    return { success: false, statusCode: 500, message: "Lỗi khi xuất báo cáo nhiều tuần: " + (error.message || '') };
  }
};

const exportSemesterReport = async (teacherId, schoolYearId, semester) => {
  try {
    return await exportReport(teacherId, schoolYearId, { type: 'semester', semester });
  } catch (error) {
    return { success: false, statusCode: 500, message: "Lỗi khi xuất báo cáo học kỳ: " + (error.message || '') };
  }
};

const exportYearReport = async (teacherId, schoolYearId) => {
  try {
    return await exportReport(teacherId, schoolYearId, { type: 'year' });
  } catch (error) {
    return { success: false, statusCode: 500, message: "Lỗi khi xuất báo cáo năm: " + (error.message || '') };
  }
};

const exportAllBCReport = async (teacherId, schoolYearId) => {
  return await exportReport(teacherId, schoolYearId, { type: 'year' });
};

const getBCReport = async (teacherId, schoolYearId, bcNumber) => {
  try {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return { success: false, statusCode: 404, message: "Không tìm thấy giáo viên" };
    }

    const query = { teacherId };
    if (schoolYearId) query.schoolYearId = schoolYearId;

    const records = await TeachingRecords.find(query)
      .populate("weekId", "weekNumber startDate endDate")
      .populate("subjectId", "name")
      .populate("classId", "name grade");

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
    return { success: false, statusCode: 500, message: "Lỗi hệ thống: " + (error.message || '') };
  }
};

const getTeacherReport = async (teacherId, type, filters = {}) => {
  try {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return { success: false, statusCode: 404, message: "Không tìm thấy giáo viên" };
    }

    const query = { teacherId };
    if (filters.schoolYearId) query.schoolYearId = filters.schoolYearId;

    const records = await TeachingRecords.find(query)
      .populate("weekId", "weekNumber startDate endDate")
      .populate("subjectId", "name")
      .populate("classId", "name grade")
      .sort({ "weekId.weekNumber": 1 });

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
    return { success: false, statusCode: 500, message: "Lỗi hệ thống: " + (error.message || '') };
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