const Week = require("../models/weekModel");
const SchoolYear = require("../models/schoolYearModel");

const getActiveSchoolYearId = async () => {
  const activeYear = await SchoolYear.findOne({ status: "active" });
  if (!activeYear) {
    throw new Error("Hiện chưa có năm học đang hoạt động. Vui lòng tạo hoặc chọn năm học.");
  }
  return activeYear._id;
};

const getWeeks = async (filters = {}) => {
  const schoolYearId = filters.schoolYearId || (await getActiveSchoolYearId());
  const query = { schoolYearId };

  if (filters.weekNumber !== undefined) {
    query.weekNumber = Number(filters.weekNumber);
  }

  const weeks = await Week.find(query).sort({ weekNumber: 1 });
  return weeks;
};

const checkDateOverlap = async (startDate, endDate, schoolYearId, excludeId = null) => {
  const query = {
    schoolYearId,
    status: "active",
    $or: [
      { startDate: { $lte: startDate }, endDate: { $gte: startDate } },
      { startDate: { $lte: endDate }, endDate: { $gte: endDate } },
      { startDate: { $gte: startDate }, endDate: { $lte: endDate } }
    ]
  };
  if (excludeId) query._id = { $ne: excludeId };
  return Week.findOne(query);
};

const createWeek = async (data) => {
  const { startDate, endDate, schoolYearId: providedSchoolYearId } = data;
  const schoolYearId = providedSchoolYearId || (await getActiveSchoolYearId());

  if (!startDate || !endDate) {
    throw new Error("Vui lòng cung cấp cả ngày bắt đầu và ngày kết thúc");
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start) || isNaN(end)) {
    throw new Error("Ngày không hợp lệ. Vui lòng sử dụng định dạng ngày hợp lệ");
  }

  if (end <= start) {
    throw new Error("Ngày kết thúc phải sau ngày bắt đầu");
  }

  const overlappingWeek = await checkDateOverlap(start, end, schoolYearId);
  if (overlappingWeek) {
    throw new Error("Khoảng thời gian tuần học chồng lên tuần đã tồn tại. Vui lòng kiểm tra lại");
  }

  const lastWeek = await Week.findOne({ schoolYearId, status: "active" }).sort({ weekNumber: -1 });
  const weekNumber = lastWeek ? lastWeek.weekNumber + 1 : 1;

  const week = await Week.create({
    weekNumber,
    startDate: start,
    endDate: end,
    schoolYearId,
    status: "active",
  });

  return week;
};

const updateWeek = async (id, data) => {
  const week = await Week.findById(id);
  if (!week) {
    const err = new Error("Không tìm thấy tuần học. Vui lòng kiểm tra lại");
    err.statusCode = 404;
    throw err;
  }

  const start = data.startDate ? new Date(data.startDate) : week.startDate;
  const end = data.endDate ? new Date(data.endDate) : week.endDate;

  if (isNaN(new Date(start)) || isNaN(new Date(end))) {
    const err = new Error("Ngày không hợp lệ. Vui lòng sử dụng định dạng ngày hợp lệ");
    err.statusCode = 400;
    throw err;
  }

  if (end <= start) {
    const err = new Error("Ngày kết thúc phải sau ngày bắt đầu");
    err.statusCode = 400;
    throw err;
  }

  const overlappingWeek = await checkDateOverlap(start, end, week.schoolYearId, id);
  if (overlappingWeek) {
    const err = new Error("Khoảng thời gian tuần học chồng lên tuần đã tồn tại. Vui lòng kiểm tra lại");
    err.statusCode = 400;
    throw err;
  }

  const updateData = {};
  if (data.startDate) updateData.startDate = start;
  if (data.endDate) updateData.endDate = end;

  const updatedWeek = await Week.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
  return updatedWeek;
};

const deleteWeek = async (id) => {
  const week = await Week.findByIdAndDelete(id);
  if (!week) {
    const err = new Error("Không tìm thấy tuần học. Vui lòng kiểm tra lại");
    err.statusCode = 404;
    throw err;
  }

  await Week.updateMany(
    {
      weekNumber: { $gt: week.weekNumber },
      schoolYearId: week.schoolYearId,
      status: "active"
    },
    { $inc: { weekNumber: -1 } }
  );

  return {
    message: "Xóa tuần học thành công",
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