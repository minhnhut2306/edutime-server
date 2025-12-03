const Week = require("../models/weekModel");
const SchoolYear = require("../models/schoolYearModel");

const getActiveSchoolYearId = async () => {
  const activeYear = await SchoolYear.findOne({ status: 'active' });
  if (!activeYear) {
    throw new Error('Không có năm học đang hoạt động. Vui lòng tạo năm học mới');
  }
  return activeYear._id;
};

const checkDateOverlap = async (startDate, endDate, schoolYearId, excludeId = null) => {
  const query = {
    schoolYearId,
    status: 'active',
    $or: [
      { startDate: { $lte: startDate }, endDate: { $gte: startDate } },
      { startDate: { $lte: endDate }, endDate: { $gte: endDate } },
      { startDate: { $gte: startDate }, endDate: { $lte: endDate } }
    ]
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return await Week.findOne(query);
};

const validateDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end <= start) {
    throw new Error("Ngày kết thúc phải sau ngày bắt đầu");
  }

  return { start, end };
};

const getNextWeekNumber = async (schoolYearId) => {
  const lastWeek = await Week.findOne({ schoolYearId, status: 'active' })
    .sort({ weekNumber: -1 });
  return lastWeek ? lastWeek.weekNumber + 1 : 1;
};

const getWeeks = async (filters = {}) => {
  const schoolYearId = filters.schoolYearId || await getActiveSchoolYearId();
  
  const query = { schoolYearId };

  if (filters.weekNumber) {
    query.weekNumber = filters.weekNumber;
  }

  return await Week.find(query).sort({ weekNumber: 1 });
};

const createWeek = async (data) => {
  const { startDate, endDate } = data;
  const schoolYearId = await getActiveSchoolYearId();

  if (!startDate || !endDate) {
    throw new Error("Ngày bắt đầu và ngày kết thúc là bắt buộc");
  }

  const { start, end } = validateDateRange(startDate, endDate);

  const overlappingWeek = await checkDateOverlap(start, end, schoolYearId);
  if (overlappingWeek) {
    throw new Error("Khoảng thời gian bị trùng với tuần học đã tồn tại");
  }

  const weekNumber = await getNextWeekNumber(schoolYearId);

  return await Week.create({
    weekNumber,
    startDate: start,
    endDate: end,
    schoolYearId,
    status: 'active'
  });
};

const updateWeek = async (id, data) => {
  const week = await Week.findById(id);
  if (!week) {
    throw new Error("Không tìm thấy tuần học");
  }

  const { startDate, endDate } = data;

  const checkStartDate = startDate ? new Date(startDate) : week.startDate;
  const checkEndDate = endDate ? new Date(endDate) : week.endDate;

  if (checkEndDate <= checkStartDate) {
    throw new Error("Ngày kết thúc phải sau ngày bắt đầu");
  }

  const overlappingWeek = await checkDateOverlap(
    checkStartDate, 
    checkEndDate, 
    week.schoolYearId,
    id
  );

  if (overlappingWeek) {
    throw new Error("Khoảng thời gian bị trùng với tuần học đã tồn tại");
  }

  const updateData = {};
  if (startDate) updateData.startDate = checkStartDate;
  if (endDate) updateData.endDate = checkEndDate;

  return await Week.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  );
};

const deleteWeek = async (id) => {
  const week = await Week.findByIdAndDelete(id);
  
  if (!week) {
    throw new Error("Không tìm thấy tuần học");
  }

  await Week.updateMany(
    { 
      weekNumber: { $gt: week.weekNumber },
      schoolYearId: week.schoolYearId,
      status: 'active'
    },
    { $inc: { weekNumber: -1 } }
  );

  return {
    message: "Xóa tuần học thành công",
    deletedWeek: {
      id: week._id,
      weekNumber: week.weekNumber,
      startDate: week.startDate,
      endDate: week.endDate
    }
  };
};

module.exports = {
  getWeeks,
  createWeek,
  updateWeek,
  deleteWeek
};