const mongoose = require('mongoose');
const reportsService = require("../services/reportsService");
const asyncHandler = require("../middleware/asyncHandler");
const SchoolYear = require("../models/schoolYearModel");
const Teacher = require("../models/teacherModel");
const {
  successResponse,
  notFoundResponse,
  badRequestResponse,
  serverErrorResponse,
  STATUS_CODES
} = require("../helper/createResponse.helper");

const isValidObjectId = (id) => !!(id && mongoose.Types.ObjectId.isValid(id));

const resolveSchoolYearId = async (schoolYearId, schoolYearLabel) => {
  if (schoolYearId) return schoolYearId;
  if (!schoolYearLabel) return null;

  if (isValidObjectId(schoolYearLabel)) return schoolYearLabel;

  try {
    const sy = await SchoolYear.findOne({
      $or: [{ year: schoolYearLabel }, { label: schoolYearLabel }]
    });
    return sy?._id || null;
  } catch (err) {
    return null;
  }
};

const handleServiceResult = (result, res, successMsg) => {
  if (!result.success) {
    const statusCode = result.statusCode || 500;
    if (statusCode === 404) {
      return res.status(404).json(notFoundResponse(result.message));
    }
    return res.status(statusCode).json(serverErrorResponse(result.message));
  }
  return res.json(successResponse(successMsg, result.data));
};

const parseArrayParam = (param) => {
  if (!param) return null;
  if (Array.isArray(param)) return param;
  try {
    return JSON.parse(param);
  } catch (e) {
    return [param];
  }
};

const setExcelHeaders = (res, fileName) => {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
};

// TenGV_GIO-BIEN-CHE_(Thang/Tuan/HocKy/CaNam)2025_2026.xlsx
const generateFileName = async (teachers, type, params, schoolYearLabel) => {
  // Log để debug
  console.log('[GENERATE FILENAME] Input:', { 
    teachersCount: teachers?.length, 
    type, 
    params, 
    schoolYearLabel 
  });

  // 1 GV: lấy tên GV, nhiều GV: TatCaGV
  let baseName;
  if (teachers && teachers.length === 1) {
    const teacherName = (teachers[0].name || 'GIAO-VIEN')
      .trim()
      .replace(/\s+/g, '_'); // đổi dấu cách thành _
    baseName = `${teacherName}_GIO-BIEN-CHE`;
  } else {
    baseName = `TatCaGV_GIO-BIEN-CHE`;
  }

  // Nhãn phạm vi (trong ngoặc)
  let scopeLabel = '';
  if (type === 'bc') {
    // tháng
    if (params.bcNumbers && params.bcNumbers.length > 0) {
      scopeLabel = `Thang${params.bcNumbers.join('-')}`;
    } else if (params.bcNumber) {
      scopeLabel = `Thang${params.bcNumber}`;
    } else {
      scopeLabel = `Thang`;
    }
  } else if (type === 'week') {
    // Lấy thông tin tuần để hiển thị số tuần hoặc ngày
    if (params.weekIds && params.weekIds.length > 0) {
      // Nhiều tuần: lấy thông tin tuần đầu và cuối
      try {
        const Week = require("../models/weekModel");
        const weeks = await Week.find({ _id: { $in: params.weekIds } }).sort({ weekNumber: 1 });
        if (weeks.length > 0) {
          const firstWeek = weeks[0];
          const lastWeek = weeks[weeks.length - 1];
          if (weeks.length === 1) {
            // 1 tuần: Tuan5_09-09
            const startDate = new Date(firstWeek.startDate);
            const day = String(startDate.getDate()).padStart(2, '0');
            const month = String(startDate.getMonth() + 1).padStart(2, '0');
            scopeLabel = `Tuan${firstWeek.weekNumber}_${day}-${month}`;
          } else {
            // Nhiều tuần: Tuan5-8
            scopeLabel = `Tuan${firstWeek.weekNumber}-${lastWeek.weekNumber}`;
          }
        } else {
          scopeLabel = `Tuan${params.weekIds.length}tuan`;
        }
      } catch (err) {
        scopeLabel = `Tuan${params.weekIds.length}tuan`;
      }
    } else if (params.weekId) {
      // 1 tuần: Tuan5_09-09
      try {
        const Week = require("../models/weekModel");
        const week = await Week.findById(params.weekId);
        if (week) {
          const startDate = new Date(week.startDate);
          const day = String(startDate.getDate()).padStart(2, '0');
          const month = String(startDate.getMonth() + 1).padStart(2, '0');
          scopeLabel = `Tuan${week.weekNumber}_${day}-${month}`;
        } else {
          scopeLabel = 'Tuan';
        }
      } catch (err) {
        scopeLabel = 'Tuan';
      }
    } else {
      scopeLabel = 'Tuan';
    }
  } else if (type === 'semester') {
    scopeLabel = `HocKy${params.semester || ''}`;
  } else if (type === 'year') {
    scopeLabel = 'CaNam';
  }

  // Năm học: "2025-2026" -> "2025_2026"
  const normalizedSchoolYear = (schoolYearLabel || 'NAMHOC')
    .toString()
    .replace(/\s+/g, '')
    .replace(/-/g, '_');

  // Ghép tên: TenGV_GIO-BIEN-CHE_(scope)2025_2026.xlsx
  let fileName = baseName;
  if (scopeLabel) {
    fileName += `_(${scopeLabel})`;
  }
  fileName += `_${normalizedSchoolYear}`;

  const finalName = fileName + '.xlsx';

  // Log để kiểm tra cấu trúc tên file khi xuất Excel
  console.log('[EXPORT EXCEL] fileName:', finalName, {
    type,
    params,
    schoolYearLabel: schoolYearLabel,
    normalizedSchoolYear,
  });

  return finalName;
};

const getTeacherReport = asyncHandler(async (req, res) => {
  const { id: teacherId } = req.params;
  const { type = 'year', schoolYearId, month, weekId, semester, bcNumber } = req.query;

  if (!teacherId) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("teacherId là bắt buộc")
    );
  }

  if (schoolYearId && !isValidObjectId(schoolYearId)) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("schoolYearId không hợp lệ")
    );
  }

  const filters = { schoolYearId, month, weekId, semester };

  if (type === 'bc' && bcNumber) {
    const result = await reportsService.getBCReport(teacherId, schoolYearId, parseInt(bcNumber));
    return handleServiceResult(result, res, "Lấy báo cáo BC thành công");
  }

  const result = await reportsService.getTeacherReport(teacherId, type, filters);
  return handleServiceResult(result, res, "Lấy báo cáo thành công");
});

const exportReport = asyncHandler(async (req, res) => {
  let { teacherId, teacherIds, schoolYearId, schoolYear, type = 'bc', bcNumber, bcNumbers, weekId, weekIds, semester } = req.query;

  console.log('[EXPORT REPORT] Query params:', { teacherId, teacherIds, type, bcNumber, bcNumbers, weekId, weekIds, semester });

  const resolvedSchoolYearId = await resolveSchoolYearId(schoolYearId, schoolYear);

  const targetTeacherIds = parseArrayParam(teacherIds) || (teacherId ? [teacherId] : null);

  if (!targetTeacherIds) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("teacherId hoặc teacherIds là bắt buộc")
    );
  }

  if (!resolvedSchoolYearId) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("schoolYearId là bắt buộc hoặc không tìm thấy schoolYear tương ứng")
    );
  }

  if (!isValidObjectId(resolvedSchoolYearId)) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("schoolYearId không hợp lệ")
    );
  }

  const options = { type, schoolYearId: resolvedSchoolYearId };
  
  // Xử lý tham số BC (có thể nhiều tháng)
  if (bcNumbers) {
    const parsed = parseArrayParam(bcNumbers);
    options.bcNumbers = parsed ? parsed.map(n => parseInt(n)) : null;
  } else if (bcNumber) {
    options.bcNumber = parseInt(bcNumber);
  }
  
  // Xử lý weekId và weekIds
  if (weekIds) {
    const parsed = parseArrayParam(weekIds);
    options.weekIds = parsed;
    console.log('[EXPORT REPORT] Parsed weekIds:', parsed);
  } else if (weekId) {
    options.weekId = weekId;
    console.log('[EXPORT REPORT] Single weekId:', weekId);
  }
  
  if (semester) options.semester = parseInt(semester);

  console.log('[EXPORT REPORT] Final options:', options);

  const result = await reportsService.exportReport(targetTeacherIds, resolvedSchoolYearId, options);

  if (!result.success) {
    const statusCode = result.statusCode || 500;
    if (statusCode === 404) {
      return res.status(404).json(notFoundResponse(result.message));
    }
    return res.status(statusCode).json(serverErrorResponse(result.message));
  }

  // Lấy thông tin giáo viên để đặt tên file
  const teachers = await Teacher.find({ _id: { $in: targetTeacherIds } }).select('name');
  
  const fileName = await generateFileName(
    teachers, 
    type, 
    { 
      bcNumber: options.bcNumber, 
      bcNumbers: options.bcNumbers, 
      weekId: options.weekId,
      weekIds: options.weekIds, 
      semester: options.semester 
    },
    result.data.schoolYearLabel
  );
  
  setExcelHeaders(res, fileName);

  await result.data.workbook.xlsx.write(res);
  res.end();
});

const exportMonthReport = asyncHandler(async (req, res) => {
  const { teacherId, teacherIds, schoolYearId, schoolYear, month, bcNumber, bcNumbers } = req.query;

  const resolvedSchoolYearId = await resolveSchoolYearId(schoolYearId, schoolYear);

  if (!resolvedSchoolYearId || !isValidObjectId(resolvedSchoolYearId)) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("schoolYearId là bắt buộc và phải hợp lệ")
    );
  }

  const targetIds = parseArrayParam(teacherIds) || teacherId;

  if (!month && !bcNumber && !bcNumbers) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("month, bcNumber hoặc bcNumbers là bắt buộc")
    );
  }

  const options = { type: 'bc', schoolYearId: resolvedSchoolYearId };
  
  if (bcNumbers) {
    const parsed = parseArrayParam(bcNumbers);
    options.bcNumbers = parsed ? parsed.map(n => parseInt(n)) : null;
  } else {
    const bc = bcNumber ? parseInt(bcNumber) : parseInt(month);
    options.bcNumber = bc;
  }

  const result = await reportsService.exportReport(
    Array.isArray(targetIds) ? targetIds : [targetIds], 
    resolvedSchoolYearId, 
    options
  );

  if (!result.success) {
    return handleServiceResult(result, res, "");
  }

  const teachers = await Teacher.find({ 
    _id: { $in: Array.isArray(targetIds) ? targetIds : [targetIds] } 
  }).select('name');
  
  const fileName = await generateFileName(
    teachers,
    'bc',
    { bcNumber: options.bcNumber, bcNumbers: options.bcNumbers },
    result.data.schoolYearLabel
  );
  
  setExcelHeaders(res, fileName);

  await result.data.workbook.xlsx.write(res);
  res.end();
});

const exportWeekReport = asyncHandler(async (req, res) => {
  const { teacherId, weekId, weekIds, schoolYearId, schoolYear } = req.query;

  console.log('[EXPORT WEEK] Query params:', { teacherId, weekId, weekIds, schoolYearId, schoolYear });

  if (!teacherId) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("teacherId là bắt buộc")
    );
  }
  if (!weekId && !weekIds) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("weekId hoặc weekIds là bắt buộc")
    );
  }

  const resolvedSchoolYearId = await resolveSchoolYearId(schoolYearId, schoolYear);

  if (resolvedSchoolYearId && !isValidObjectId(resolvedSchoolYearId)) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("schoolYearId không hợp lệ")
    );
  }

  const options = { type: 'week' };
  if (weekIds) {
    const parsed = parseArrayParam(weekIds);
    options.weekIds = parsed;
    console.log('[EXPORT WEEK] Parsed weekIds:', parsed);
  } else {
    options.weekId = weekId;
    console.log('[EXPORT WEEK] Single weekId:', weekId);
  }

  const result = await reportsService.exportReport([teacherId], resolvedSchoolYearId, options);

  if (!result.success) {
    return handleServiceResult(result, res, "");
  }

  const teachers = await Teacher.find({ _id: teacherId }).select('name');
  
  const fileName = await generateFileName(
    teachers,
    'week',
    { weekId: options.weekId, weekIds: options.weekIds },
    result.data.schoolYearLabel
  );
  
  setExcelHeaders(res, fileName);

  await result.data.workbook.xlsx.write(res);
  res.end();
});

const exportSemesterReport = asyncHandler(async (req, res) => {
  const { teacherId, schoolYearId, schoolYear, semester } = req.query;

  const resolvedSchoolYearId = await resolveSchoolYearId(schoolYearId, schoolYear);

  if (!teacherId || !resolvedSchoolYearId || !semester) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("teacherId, schoolYearId, semester là bắt buộc")
    );
  }

  if (!isValidObjectId(resolvedSchoolYearId)) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("schoolYearId không hợp lệ")
    );
  }

  const result = await reportsService.exportReport(
    [teacherId], 
    resolvedSchoolYearId, 
    { type: 'semester', semester: parseInt(semester) }
  );

  if (!result.success) {
    return handleServiceResult(result, res, "");
  }

  const teachers = await Teacher.find({ _id: teacherId }).select('name');
  
  const fileName = await generateFileName(
    teachers,
    'semester',
    { semester: parseInt(semester) },
    result.data.schoolYearLabel
  );
  
  setExcelHeaders(res, fileName);

  await result.data.workbook.xlsx.write(res);
  res.end();
});

const exportYearReport = asyncHandler(async (req, res) => {
  const { teacherId, schoolYearId, schoolYear, allBC } = req.query;

  const resolvedSchoolYearId = await resolveSchoolYearId(schoolYearId, schoolYear);

  if (!teacherId || !resolvedSchoolYearId) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("teacherId, schoolYearId là bắt buộc")
    );
  }

  if (!isValidObjectId(resolvedSchoolYearId)) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("schoolYearId không hợp lệ")
    );
  }

  const result = await reportsService.exportReport(
    [teacherId], 
    resolvedSchoolYearId, 
    { type: 'year' }
  );

  if (!result.success) {
    return handleServiceResult(result, res, "");
  }

  const teachers = await Teacher.find({ _id: teacherId }).select('name');
  
  const fileName = await generateFileName(
    teachers,
    'year',
    {},
    result.data.schoolYearLabel
  );
  
  setExcelHeaders(res, fileName);

  await result.data.workbook.xlsx.write(res);
  res.end();
});

module.exports = {
  getTeacherReport,
  exportReport,
  exportMonthReport,
  exportWeekReport,
  exportSemesterReport,
  exportYearReport
};