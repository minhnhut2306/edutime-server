const Subject = require("../models/subjectModel");
const SchoolYear = require("../models/schoolYearModel");

const getActiveSchoolYear = async () => {
  const activeYear = await SchoolYear.findOne({ status: 'active' });
  if (!activeYear) {
    throw new Error('Không có năm học đang hoạt động. Vui lòng tạo năm học mới!');
  }
  return activeYear.year;
};

const getSubjects = async (filters = {}) => {
  const schoolYear = await getActiveSchoolYear(); // ✅ Tự động lấy năm active
  
  const query = {
    schoolYear,      // ✅ Lọc theo năm học
    status: 'active' // ✅ Chỉ lấy active
  };

  if (filters.name) {
    query.name = { $regex: filters.name, $options: "i" };
  }

  const subjects = await Subject.find(query).sort({ createdAt: -1 });
  return subjects;
};

const createSubject = async (data) => {
  const { name } = data;
  const schoolYear = await getActiveSchoolYear(); // ✅ Tự động lấy năm học

  if (!name || name.trim() === "") {
    throw new Error("Subject name is required");
  }

  // ✅ Check trùng trong năm học
  const existingSubject = await Subject.findOne({ 
    name: { $regex: `^${name.trim()}$`, $options: "i" },
    schoolYear,
    status: 'active'
  });
  
  if (existingSubject) {
    throw new Error("Subject name already exists");
  }

  const subject = await Subject.create({ 
    name: name.trim(),
    schoolYear,      // ✅ Tự động thêm năm học
    status: 'active'
  });
  
  return subject;
};

const deleteSubject = async (id) => {
  const subject = await Subject.findByIdAndDelete(id);
  if (!subject) {
    throw new Error("Subject not found");
  }
  return {
    message: "Subject deleted successfully",
    deletedSubject: {
      id: subject._id,
      name: subject.name,
    },
  };
};

module.exports = {
  getSubjects,
  createSubject,
  deleteSubject,
};