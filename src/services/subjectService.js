const Subject = require("../models/subjectModel");

const getSubjects = async (filters = {}) => {
  const query = {};

  if (filters.name) {
    query.name = { $regex: filters.name, $options: "i" };
  }

  const subjects = await Subject.find(query).sort({ createdAt: -1 });

  return subjects;
};

const createSubject = async (data) => {
  const { name } = data;

  const existingSubject = await Subject.findOne({ name });
  if (existingSubject) {
    throw new Error("Subject name already exists");
  }

  const subject = await Subject.create({ name });

  return subject;
};

const deleteSubject = async (id) => {
  const subject = await Subject.findById(id);
  if (!subject) {
    throw new Error("Subject not found");
  }

  await Subject.findByIdAndDelete(id);

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