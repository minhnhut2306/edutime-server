const Week = require("../models/weekModel");
const SchoolYear = require("../models/schoolYearModel");

// ✅ THAY ĐỔI 1: Helper function
const getActiveSchoolYearId = async () => {
  const activeYear = await SchoolYear.findOne({ status: 'active' });
  if (!activeYear) {
    throw new Error('Không có năm học đang hoạt động. Vui lòng tạo năm học mới!');
  }
  return activeYear._id;  // ✅ Trả về _id
};

// ✅ THAY ĐỔI 2: getWeeks
const getWeeks = async (filters = {}) => {
  const schoolYearId = await getActiveSchoolYearId();  // ✅ Đổi tên biến
  
  const query = {
    schoolYearId,      // ✅ Đổi tên field
    status: 'active'
  };

  if (filters.weekNumber) {
    query.weekNumber = filters.weekNumber;
  }

  const weeks = await Week.find(query).sort({ weekNumber: 1 });
  return weeks;
};

// ✅ THAY ĐỔI 3: checkDateOverlap
const checkDateOverlap = async (startDate, endDate, schoolYearId, excludeId = null) => {
  // ✅ Đổi tên tham số: schoolYear → schoolYearId
  
  const query = {
    schoolYearId,  // ✅ Đổi tên field
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

// ✅ THAY ĐỔI 4: createWeek
const createWeek = async (data) => {
  const { startDate, endDate } = data;
  const schoolYearId = await getActiveSchoolYearId();  // ✅ Đổi tên biến

  if (!startDate || !endDate) {
    throw new Error("Start date and end date are required");
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end <= start) {
    throw new Error("End date must be after start date");
  }

  // ✅ Truyền schoolYearId vào checkDateOverlap
  const overlappingWeek = await checkDateOverlap(start, end, schoolYearId);

  if (overlappingWeek) {
    throw new Error("Week period overlaps with existing week");
  }

  // ✅ Tính weekNumber trong năm học
  const lastWeek = await Week.findOne({ schoolYearId, status: 'active' })
    .sort({ weekNumber: -1 });
  const weekNumber = lastWeek ? lastWeek.weekNumber + 1 : 1;

  const week = await Week.create({
    weekNumber,
    startDate: start,
    endDate: end,
    schoolYearId,      // ✅ Đổi tên field
    status: 'active'
  });

  return week;
};

// ✅ THAY ĐỔI 5: updateWeek
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

  // ✅ Truyền week.schoolYearId
  const overlappingWeek = await checkDateOverlap(
    checkStartDate, 
    checkEndDate, 
    week.schoolYearId,  // ✅ Đổi tên field
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

// ✅ THAY ĐỔI 6: deleteWeek
const deleteWeek = async (id) => {
  const week = await Week.findByIdAndDelete(id);
  
  if (!week) {
    throw new Error("Week not found");
  }

  // ✅ Cập nhật weekNumber trong cùng năm học
  await Week.updateMany(
    { 
      weekNumber: { $gt: week.weekNumber },
      schoolYearId: week.schoolYearId,  // ✅ Đổi tên field
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