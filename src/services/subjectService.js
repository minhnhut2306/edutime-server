const Subject = require("../models/subjectModel");
const SchoolYear = require("../models/schoolYearModel");

const getActiveSchoolYearId = async () => {
  const activeYear = await SchoolYear.findOne({ status: "active" });
  if (!activeYear) {
    throw new Error("Hiện chưa có năm học đang hoạt động. Vui lòng tạo hoặc chọn năm học.");
  }
  return activeYear._id;
};

const removeVietnameseTones = (str) => {
  if (!str) return "";
  str = str.toLowerCase().trim();
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  return str;
};

const SUBJECT_ALIASES = {
  toan: ["toan", "toán", "toán học", "toan hoc"],
  van: ["van", "văn", "ngữ văn", "ngu van", "văn học", "van hoc"],
  anh: ["anh", "tiếng anh", "tieng anh", "english", "anh văn", "anh van", "t.anh", "ta"],
  ly: ["ly", "lý", "vật lý", "vat ly", "v.lý", "v.ly", "vatly"],
  hoa: ["hoa", "hóa", "hóa học", "hoa hoc", "h.hóa", "h.hoa", "hoahoc"],
  sinh: ["sinh", "sinh học", "sinh hoc", "s.học", "s.hoc", "sinhhoc"],
  su: ["su", "sử", "lịch sử", "lich su", "l.sử", "l.su", "lichsu"],
  dia: ["dia", "địa", "địa lý", "dia ly", "d.lý", "d.ly", "dialy", "địa ly", "dia li", "địa li"],
  gdcd: ["gdcd", "giáo dục công dân", "giao duc cong dan", "cd", "cong dan", "công dân"],
  tin: ["tin", "tin học", "tin hoc", "t.học", "t.hoc", "cntt", "công nghệ thông tin", "cong nghe thong tin"],
  td: ["td", "thể dục", "the duc", "t.dục", "t.duc", "tdtt", "thể thao", "the thao"],
  qp: ["qp", "quốc phòng", "quoc phong", "an ninh", "gdqp", "giáo dục quốc phòng"],
  cong: ["cong", "công nghệ", "cong nghe", "kỹ thuật", "ky thuat", "cn"],
  am: ["am", "âm nhạc", "am nhac", "a.nhac", "nhạc", "nhac"],
  my: ["my", "mỹ thuật", "my thuat", "m.thuat", "hội họa", "hoi hoa"]
};

const normalizeSubjectName = (name) => {
  if (!name) return "";
  const normalized = removeVietnameseTones(name);
  for (const aliases of Object.values(SUBJECT_ALIASES)) {
    for (const alias of aliases) {
      if (removeVietnameseTones(alias) === normalized) {
        return removeVietnameseTones(aliases[0]);
      }
    }
  }
  return normalized;
};

const findSubjectByNameFlexible = async (subjectName, schoolYearId) => {
  if (!subjectName) return null;
  const list = await Subject.find({ schoolYearId, status: "active" }).lean();
  const inputNormalized = normalizeSubjectName(subjectName);
  const exact = list.find((s) => normalizeSubjectName(s.name) === inputNormalized);
  if (exact) return exact;
  const partial = list.find((s) => normalizeSubjectName(s.name).includes(inputNormalized) || inputNormalized.includes(normalizeSubjectName(s.name)));
  return partial || null;
};

const getSubjects = async (filters = {}) => {
  const schoolYearId = filters.schoolYearId || (await getActiveSchoolYearId());
  const query = { schoolYearId };
  if (filters.name) {
    query.name = { $regex: filters.name.trim(), $options: "i" };
  }
  const subjects = await Subject.find(query).sort({ createdAt: -1 });
  return subjects;
};

const createSubject = async (data) => {
  const nameRaw = data?.name;
  const providedSchoolYearId = data?.schoolYearId;
  const schoolYearId = providedSchoolYearId || (await getActiveSchoolYearId());
  if (!nameRaw || nameRaw.trim() === "") {
    throw new Error("Vui lòng nhập tên môn học");
  }
  const name = nameRaw.trim();
  const existing = await findSubjectByNameFlexible(name, schoolYearId);
  if (existing) {
    throw new Error(`Môn học "${existing.name}" đã tồn tại trong năm học này`);
  }
  const subject = await Subject.create({
    name,
    schoolYearId,
    status: "active"
  });
  return subject;
};

const deleteSubject = async (id) => {
  const subject = await Subject.findByIdAndDelete(id);
  if (!subject) {
    throw new Error("Không tìm thấy môn học. Vui lòng kiểm tra lại lựa chọn");
  }
  return {
    message: "Đã xóa môn học thành công",
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