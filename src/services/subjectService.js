const Subject = require("../models/subjectModel");
const SchoolYear = require("../models/schoolYearModel");

const getActiveSchoolYearId = async () => {
  const activeYear = await SchoolYear.findOne({ status: 'active' });
  if (!activeYear) {
    throw new Error('Không có năm học đang hoạt động. Vui lòng tạo năm học mới!');
  }
  return activeYear._id;
};

// ✅ FIX: Nhận schoolYearId từ controller
const getSubjects = async (filters = {}) => {
  const schoolYearId = filters.schoolYearId || await getActiveSchoolYearId();
  
  const query = {
    schoolYearId,
  };

  if (filters.name) {
    query.name = { $regex: filters.name, $options: "i" };
  }

  const subjects = await Subject.find(query).sort({ createdAt: -1 });
  return subjects;
};

const createSubject = async (data) => {
  const { name } = data;
  const schoolYearId = await getActiveSchoolYearId();

  if (!name || name.trim() === "") {
    throw new Error("Subject name is required");
  }

  const existingSubject = await Subject.findOne({ 
    name: { $regex: `^${name.trim()}$`, $options: "i" },
    schoolYearId,
    status: 'active'
  });
  
  if (existingSubject) {
    throw new Error("Subject name already exists");
  }

  const subject = await Subject.create({ 
    name: name.trim(),
    schoolYearId,
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