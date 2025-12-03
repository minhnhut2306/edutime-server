const Subject = require("../models/subjectModel");
const SchoolYear = require("../models/schoolYearModel");

const SUBJECT_ALIASES = {
  'toan': ['toan', 'toán', 'toán học', 'toan hoc'],
  'van': ['van', 'văn', 'ngữ văn', 'ngu van', 'văn học', 'van hoc'],
  'anh': ['anh', 'tiếng anh', 'tieng anh', 'english', 'anh văn', 'anh van', 't.anh', 'ta'],
  'ly': ['ly', 'lý', 'vật lý', 'vat ly', 'v.lý', 'v.ly', 'vatly'],
  'hoa': ['hoa', 'hóa', 'hóa học', 'hoa hoc', 'h.hóa', 'h.hoa', 'hoahoc'],
  'sinh': ['sinh', 'sinh học', 'sinh hoc', 's.học', 's.hoc', 'sinhhoc'],
  'su': ['su', 'sử', 'lịch sử', 'lich su', 'l.sử', 'l.su', 'lichsu'],
  'dia': ['dia', 'địa', 'địa lý', 'dia ly', 'd.lý', 'd.ly', 'dialy', 'địa ly', 'dia lí', 'địa lí'],
  'gdcd': ['gdcd', 'giáo dục công dân', 'giao duc cong dan', 'cd', 'cong dan', 'công dân'],
  'tin': ['tin', 'tin học', 'tin hoc', 't.học', 't.hoc', 'cntt', 'công nghệ thông tin', 'cong nghe thong tin'],
  'td': ['td', 'thể dục', 'the duc', 't.dục', 't.duc', 'tdtt', 'thể thao', 'the thao'],
  'qp': ['qp', 'quốc phòng', 'quoc phong', 'an ninh', 'gdqp', 'giáo dục quốc phòng'],
  'cong': ['cong', 'công nghệ', 'cong nghe', 'kỹ thuật', 'ky thuat', 'cn'],
  'am': ['am', 'âm nhạc', 'am nhac', 'a.nhạc', 'a.nhac', 'nhạc', 'nhac'],
  'my': ['my', 'mỹ thuật', 'my thuat', 'm.thuật', 'm.thuat', 'hội họa', 'hoi hoa']
};

const removeVietnameseTones = (str) => {
  if (!str) return "";
  
  return str.toLowerCase().trim()
    .replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a")
    .replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e")
    .replace(/ì|í|ị|ỉ|ĩ/g, "i")
    .replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o")
    .replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u")
    .replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y")
    .replace(/đ/g, "d");
};

const normalizeSubjectName = (name) => {
  if (!name) return "";
  const normalized = removeVietnameseTones(name);
  
  for (const [key, aliases] of Object.entries(SUBJECT_ALIASES)) {
    for (const alias of aliases) {
      if (normalized === removeVietnameseTones(alias)) {
        return key;
      }
    }
  }
  
  return normalized;
};

const getActiveSchoolYearId = async () => {
  const activeYear = await SchoolYear.findOne({ status: 'active' });
  if (!activeYear) {
    throw new Error('Không có năm học đang hoạt động. Vui lòng tạo năm học mới');
  }
  return activeYear._id;
};

const findSubjectByNameFlexible = async (subjectName, schoolYearId) => {
  if (!subjectName) return null;

  const allSubjects = await Subject.find({ schoolYearId, status: "active" });
  const inputNormalized = normalizeSubjectName(subjectName);
  
  return allSubjects.find(s => normalizeSubjectName(s.name) === inputNormalized);
};

const getSubjects = async (filters = {}) => {
  const schoolYearId = filters.schoolYearId || await getActiveSchoolYearId();
  
  const query = { schoolYearId };

  if (filters.name) {
    query.name = { $regex: filters.name, $options: "i" };
  }

  return await Subject.find(query).sort({ createdAt: -1 });
};

const createSubject = async (data) => {
  const { name } = data;
  const schoolYearId = await getActiveSchoolYearId();

  if (!name?.trim()) {
    throw new Error("Tên môn học là bắt buộc");
  }

  const trimmedName = name.trim();
  const existingSubject = await findSubjectByNameFlexible(trimmedName, schoolYearId);
  
  if (existingSubject) {
    throw new Error(`Môn học đã tồn tại với tên "${existingSubject.name}"`);
  }

  return await Subject.create({ 
    name: trimmedName,
    schoolYearId,
    status: 'active'
  });
};

const deleteSubject = async (id) => {
  const subject = await Subject.findByIdAndDelete(id);
  if (!subject) {
    throw new Error("Không tìm thấy môn học");
  }
  
  return {
    message: "Xóa môn học thành công",
    deletedSubject: {
      id: subject._id,
      name: subject.name
    }
  };
};

module.exports = {
  getSubjects,
  createSubject,
  deleteSubject,
  findSubjectByNameFlexible,
  normalizeSubjectName
};