const Week = require("../models/weekModel");
const SchoolYear = require("../models/schoolYearModel");

const getActiveSchoolYearId = async () => {
  const activeYear = await SchoolYear.findOne({ status: 'active' });
  if (!activeYear) {
    throw new Error('Không có năm học đang hoạt động. Vui lòng tạo năm học mới!');
  }
  return activeYear._id;
};

// ✅ FIX: Nhận schoolYearId từ controller
const getWeeks = async (filters = {}) => {
  const schoolYearId = filters.schoolYearId || await getActiveSchoolYearId();
  
  const query = {
    schoolYearId,
  };

  if (filters.weekNumber) {
    query.weekNumber = filters.weekNumber;
  }

  const weeks = await Week.find(query).sort({ weekNumber: 1 });
  return weeks;
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

  return Week.findOne(query);
};

const createWeek = async (data) => {
  const { startDate, endDate } = data;
  const schoolYearId = await getActiveSchoolYearId();

  if (!startDate || !endDate) {
    throw new Error("Start date and end date are required");
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end <= start) {
    throw new Error("End date must be after start date");
  }

  const overlappingWeek = await checkDateOverlap(start, end, schoolYearId);

  if (overlappingWeek) {
    throw new Error("Week period overlaps with existing week");
  }

  const lastWeek = await Week.findOne({ schoolYearId, status: 'active' })
    .sort({ weekNumber: -1 });
  const weekNumber = lastWeek ? lastWeek.weekNumber + 1 : 1;

  const week = await Week.create({
    weekNumber,
    startDate: start,
    endDate: end,
    schoolYearId,
    status: 'active'
  });

  return week;
};

const updateWeek = async (id, data) => {
  const week = await Week.findById(id);
  if (!week) {
    throw new Error("Week not found");
  }

  const { startDate, endDate } = data;

  const checkStartDate = startDate ? new Date(startDate) : week.startDate;
  const checkEndDate = endDate ? new Date(endDate) : week.endDate;

  if (checkEndDate <= checkStartDate) {
    throw new Error("End date must be after start date");
  }

  const overlappingWeek = await checkDateOverlap(
    checkStartDate, 
    checkEndDate, 
    week.schoolYearId,
    id
  );

  if (overlappingWeek) {
    throw new Error("Week period overlaps with existing week");
  }

  const updateData = {};
  if (startDate) updateData.startDate = checkStartDate;
  if (endDate) updateData.endDate = checkEndDate;

  const updatedWeek = await Week.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  );

  return updatedWeek;
};

const deleteWeek = async (id) => {
  const week = await Week.findByIdAndDelete(id);
  
  if (!week) {
    throw new Error("Week not found");
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
    message: "Week deleted successfully",
    deletedWeek: {
      id: week._id,
      weekNumber: week.weekNumber,
      startDate: week.startDate,
      endDate: week.endDate,
    },
  };
};

module.exports = {
  getWeeks,
  createWeek,
  updateWeek,
  deleteWeek,
};