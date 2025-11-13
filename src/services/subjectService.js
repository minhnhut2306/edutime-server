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
  if (!name || name.trim() === "") {
    throw new Error("Subject name is required");
  }
  const existingSubject = await Subject.findOne({ 
    name: { $regex: `^${name.trim()}$`, $options: "i" } 
  });
  
  if (existingSubject) {
    throw new Error("Subject name already exists");
  }

  const subject = await Subject.create({ name: name.trim() });
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