const Week = require("../models/weekModel");

const getWeeks = async (filters = {}) => {
  const query = {};

  const weeks = await Week.find(query).sort({ weekNumber: 1 });

  return weeks;
};

const createWeek = async (data) => {
  const { startDate, endDate } = data;

  // Kiểm tra ngày kết thúc phải sau ngày bắt đầu
  if (new Date(endDate) <= new Date(startDate)) {
    throw new Error("End date must be after start date");
  }

  // Kiểm tra trùng lặp khoảng thời gian
  const overlappingWeek = await Week.findOne({
    $or: [
      // startDate nằm trong khoảng tuần đã có
      { startDate: { $lte: new Date(startDate) }, endDate: { $gte: new Date(startDate) } },
      // endDate nằm trong khoảng tuần đã có
      { startDate: { $lte: new Date(endDate) }, endDate: { $gte: new Date(endDate) } },
      // Tuần mới bao trùm tuần cũ
      { startDate: { $gte: new Date(startDate) }, endDate: { $lte: new Date(endDate) } }
    ]
  });

  if (overlappingWeek) {
    throw new Error("Week period overlaps with existing week");
  }

  // Tự động tính weekNumber (số tuần tiếp theo)
  const lastWeek = await Week.findOne().sort({ weekNumber: -1 });
  const weekNumber = lastWeek ? lastWeek.weekNumber + 1 : 1;

  const week = await Week.create({
    weekNumber,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  });

  return week;
};

const updateWeek = async (id, data) => {
  const week = await Week.findById(id);
  if (!week) {
    throw new Error("Week not found");
  }

  const { startDate, endDate } = data;

  // Kiểm tra ngày kết thúc phải sau ngày bắt đầu
  if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
    throw new Error("End date must be after start date");
  }

  // Kiểm tra trùng lặp khoảng thời gian (ngoại trừ chính nó)
  const checkStartDate = startDate ? new Date(startDate) : week.startDate;
  const checkEndDate = endDate ? new Date(endDate) : week.endDate;

  const overlappingWeek = await Week.findOne({
    _id: { $ne: id },
    $or: [
      { startDate: { $lte: checkStartDate }, endDate: { $gte: checkStartDate } },
      { startDate: { $lte: checkEndDate }, endDate: { $gte: checkEndDate } },
      { startDate: { $gte: checkStartDate }, endDate: { $lte: checkEndDate } }
    ]
  });

  if (overlappingWeek) {
    throw new Error("Week period overlaps with existing week");
  }

  const updateData = {};
  if (startDate) updateData.startDate = new Date(startDate);
  if (endDate) updateData.endDate = new Date(endDate);

  const updatedWeek = await Week.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  );

  return updatedWeek;
};

const deleteWeek = async (id) => {
  const week = await Week.findById(id);
  if (!week) {
    throw new Error("Week not found");
  }

  const deletedWeekNumber = week.weekNumber;

  await Week.findByIdAndDelete(id);

  // Tự động sắp xếp lại số tuần
  await Week.updateMany(
    { weekNumber: { $gt: deletedWeekNumber } },
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