const Week = require("../models/weekModel");
const SchoolYear = require("../models/schoolYearModel");

const getActiveSchoolYear = async () => {
  const activeYear = await SchoolYear.findOne({ status: 'active' });
  if (!activeYear) {
    throw new Error('Không có năm học đang hoạt động. Vui lòng tạo năm học mới!');
  }
  return activeYear.year;
};

const getWeeks = async (filters = {}) => {
  const schoolYear = await getActiveSchoolYear(); // ✅ Tự động lấy năm active
  
  const query = {
    schoolYear,      // ✅ Lọc theo năm học
    status: 'active' // ✅ Chỉ lấy active
  };

  if (filters.weekNumber) {
    query.weekNumber = filters.weekNumber;
  }

  const weeks = await Week.find(query).sort({ weekNumber: 1 });
  return weeks;
};

const checkDateOverlap = async (startDate, endDate, schoolYear, excludeId = null) => {
  const query = {
    schoolYear, // ✅ Check trùng trong cùng năm học
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
  const schoolYear = await getActiveSchoolYear(); // ✅ Tự động lấy năm học

  if (!startDate || !endDate) {
    throw new Error("Start date and end date are required");
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end <= start) {
    throw new Error("End date must be after start date");
  }

  // ✅ Check overlap trong năm học
  const overlappingWeek = await checkDateOverlap(start, end, schoolYear);

  if (overlappingWeek) {
    throw new Error("Week period overlaps with existing week");
  }

  // ✅ Tính weekNumber trong năm học
  const lastWeek = await Week.findOne({ schoolYear, status: 'active' })
    .sort({ weekNumber: -1 });
  const weekNumber = lastWeek ? lastWeek.weekNumber + 1 : 1;

  const week = await Week.create({
    weekNumber,
    startDate: start,
    endDate: end,
    schoolYear,      // ✅ Tự động thêm năm học
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

  // ✅ Check overlap trong năm học
  const overlappingWeek = await checkDateOverlap(
    checkStartDate, 
    checkEndDate, 
    week.schoolYear, 
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

  // ✅ Cập nhật weekNumber trong cùng năm học
  await Week.updateMany(
    { 
      weekNumber: { $gt: week.weekNumber },
      schoolYear: week.schoolYear,
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