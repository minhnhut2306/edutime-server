const Teacher = require("../models/teacherModel");
const User = require("../models/userModel");
const TeachingRecords = require("../models/teachingRecordsModel");
const Class = require("../models/classesModel");
const SchoolYear = require("../models/schoolYearModel");
const { findSubjectByNameFlexible } = require("./subjectService");
const XLSX = require("xlsx");

const POPULATE_OPTIONS = [
  { path: "userId", select: "email" },
  { path: "subjectIds", select: "name" },
  { path: "mainClassId", select: "name grade" }
];

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

const getActiveSchoolYearId = async () => {
  const activeYear = await SchoolYear.findOne({ status: "active" });
  if (!activeYear) {
    throw new Error("Không có năm học đang hoạt động. Vui lòng tạo năm học mới");
  }
  return activeYear._id;
};

const getSchoolYearId = async (schoolYear) => {
  if (!schoolYear) return await getActiveSchoolYearId();
  
  const year = await SchoolYear.findOne({ year: schoolYear });
  if (!year) {
    throw new Error(`Không tìm thấy năm học ${schoolYear}`);
  }
  return year._id;
};

const getRowValue = (row, fieldName) => {
  const key = Object.keys(row).find(k => k.toLowerCase() === fieldName.toLowerCase());
  return key ? row[key] : null;
};

const normalizePhone = (phone) => {
  if (!phone) return null;
  const phoneStr = String(phone).trim();
  if (phoneStr === '') return null;
  return phoneStr.length === 9 && !phoneStr.startsWith("0") ? "0" + phoneStr : phoneStr;
};

const findClassFlexible = async (className, schoolYearId) => {
  if (!className) return null;

  const normalizedName = removeVietnameseTones(className);
  const allClasses = await Class.find({ schoolYearId, status: "active" });

  return allClasses.find(c => removeVietnameseTones(c.name) === normalizedName);
};

const validateUniquePhone = async (phone, excludeId = null) => {
  if (!phone || phone.trim() === '') return;
  
  const normalizedPhone = phone.trim();
  const query = { phone: normalizedPhone };
  if (excludeId) query._id = { $ne: excludeId };
  
  const existing = await Teacher.findOne(query);
  if (existing) {
    throw new Error(`Số điện thoại "${normalizedPhone}" đã được sử dụng bởi giáo viên ${existing.name}`);
  }
};

const validateUniqueUserId = async (userId, excludeId = null) => {
  if (!userId) return;
  
  const query = { userId };
  if (excludeId) query._id = { $ne: excludeId };
  
  const [existing, user] = await Promise.all([
    Teacher.findOne(query),
    User.findById(userId)
  ]);
  
  if (existing) {
    throw new Error(`Tài khoản này đã được gán cho giáo viên ${existing.name}`);
  }
  if (!user) {
    throw new Error("Tài khoản không tồn tại trong hệ thống");
  }
};

const validateUniqueHomeroom = async (mainClassId, schoolYearId, excludeId = null) => {
  if (!mainClassId || mainClassId.trim() === '') return;
  
  const query = { mainClassId, schoolYearId };
  if (excludeId) query._id = { $ne: excludeId };
  
  const existing = await Teacher.findOne(query).populate('mainClassId', 'name');
  if (existing) {
    throw new Error(
      `Lớp ${existing.mainClassId?.name || 'này'} đã có giáo viên chủ nhiệm là "${existing.name}". Mỗi lớp chỉ có 1 giáo viên chủ nhiệm`
    );
  }
};

const processSubjectNames = async (subjectNames, schoolYearId) => {
  const subjectNameList = subjectNames.split(",").map(s => s.trim());
  const subjectIds = [];
  
  for (const subjectName of subjectNameList) {
    const subject = await findSubjectByNameFlexible(subjectName, schoolYearId);
    if (!subject) {
      const schoolYear = await SchoolYear.findById(schoolYearId);
      throw new Error(
        `Môn học "${subjectName}" không tồn tại trong năm học ${schoolYear?.year || "hiện tại"}. Các tên có thể dùng: Toán, Văn, Anh, Lý, Hóa, Sinh, Sử, Địa, Địa lý, GDCD, Tin, TD, QP, Công, Âm, Mỹ`
      );
    }
    subjectIds.push(subject._id);
  }
  
  if (subjectIds.length === 0) {
    throw new Error("Không tìm thấy môn học nào hợp lệ");
  }
  
  return subjectIds;
};

const getTeachers = async (filters = {}) => {
  const schoolYearId = await getSchoolYearId(filters.schoolYear);

  const query = { schoolYearId };

  if (filters.name) {
    query.name = { $regex: filters.name, $options: "i" };
  }

  if (filters.phone) {
    query.phone = { $regex: filters.phone, $options: "i" };
  }

  if (filters.subjectId) {
    query.subjectIds = filters.subjectId;
  }

  if (filters.mainClassId) {
    query.mainClassId = filters.mainClassId;
  }

  return await Teacher.find(query)
    .populate(POPULATE_OPTIONS)
    .sort({ createdAt: -1 });
};

const getTeacherById = async (id) => {
  const teacher = await Teacher.findById(id).populate(POPULATE_OPTIONS);

  if (!teacher) {
    throw new Error("Không tìm thấy giáo viên");
  }

  return teacher;
};

const createTeacher = async (data) => {
  const { name, phone, userId, subjectIds, mainClassId } = data;
  const schoolYearId = await getActiveSchoolYearId();

  if (!name || !subjectIds) {
    throw new Error("Họ tên và môn dạy là bắt buộc");
  }

  const normalizedPhone = phone && phone.trim() !== '' ? phone.trim() : null;
  const normalizedMainClassId = mainClassId && mainClassId.trim() !== '' ? mainClassId.trim() : null;

  await Promise.all([
    validateUniquePhone(normalizedPhone),
    validateUniqueUserId(userId),
    validateUniqueHomeroom(normalizedMainClassId, schoolYearId)
  ]);

  const teacher = await Teacher.create({
    name,
    phone: normalizedPhone,
    userId: userId || null,
    subjectIds,
    mainClassId: normalizedMainClassId,
    schoolYearId,
    status: "active"
  });

  return await teacher.populate(POPULATE_OPTIONS);
};

const updateTeacher = async (id, data) => {
  const teacher = await Teacher.findById(id);
  if (!teacher) {
    throw new Error("Không tìm thấy giáo viên");
  }

  if (!data.name || data.name.trim() === '') {
    throw new Error("Họ tên giáo viên không được để trống");
  }

  if (!data.subjectIds || data.subjectIds.length === 0) {
    throw new Error("Phải chọn ít nhất một môn dạy");
  }

  const checks = [];

  const normalizedPhone = data.phone && data.phone.trim() !== '' ? data.phone.trim() : null;
  const currentPhone = teacher.phone;

  if (normalizedPhone !== currentPhone) {
    checks.push(validateUniquePhone(normalizedPhone, id));
  }

  if (data.userId && data.userId !== teacher.userId?.toString()) {
    checks.push(validateUniqueUserId(data.userId, id));
  }

  const normalizedMainClassId = data.mainClassId && data.mainClassId.trim() !== '' ? data.mainClassId.trim() : null;

  if (normalizedMainClassId !== teacher.mainClassId?.toString()) {
    checks.push(validateUniqueHomeroom(normalizedMainClassId, teacher.schoolYearId, id));
  }

  if (checks.length > 0) {
    await Promise.all(checks);
  }

  return await Teacher.findByIdAndUpdate(
    id,
    { ...data, phone: normalizedPhone, mainClassId: normalizedMainClassId, updatedAt: Date.now() },
    { new: true, runValidators: true }
  ).populate(POPULATE_OPTIONS);
};

const updateTeacherUserId = async (teacherId, userId) => {
  const teacher = await Teacher.findById(teacherId);
  if (!teacher) {
    throw new Error("Không tìm thấy giáo viên");
  }

  await validateUniqueUserId(userId, teacherId);

  teacher.userId = userId;
  teacher.updatedAt = Date.now();
  await teacher.save();

  return await teacher.populate(POPULATE_OPTIONS);
};

const deleteTeacher = async (id) => {
  const teacher = await Teacher.findById(id);
  if (!teacher) {
    throw new Error("Không tìm thấy giáo viên");
  }

  const teachingRecordsCount = await TeachingRecords.countDocuments({ teacherId: id });
  if (teachingRecordsCount > 0) {
    throw new Error(
      `Không thể xóa giáo viên "${teacher.name}" vì có ${teachingRecordsCount} bản ghi giảng dạy. Vui lòng xóa các bản ghi giảng dạy trước.`
    );
  }

  await Teacher.findByIdAndDelete(id);

  return {
    message: "Xóa giáo viên thành công",
    deletedTeacher: {
      id: teacher._id,
      name: teacher.name
    }
  };
};

const importTeachers = async (file) => {
  if (!file) {
    throw new Error("Không có file được tải lên");
  }

  const schoolYearId = await getActiveSchoolYearId();

  const workbook = XLSX.read(file.buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);

  if (data.length === 0) {
    throw new Error("File Excel trống");
  }

  const results = {
    success: [],
    failed: []
  };

  const existingHomerooms = await Teacher.find({ schoolYearId })
    .populate('mainClassId', 'name')
    .select('mainClassId name');
  
  const homeroomMap = new Map();
  existingHomerooms.forEach(t => {
    if (t.mainClassId?._id) {
      homeroomMap.set(
        t.mainClassId._id.toString(), 
        { teacherName: t.name, className: t.mainClassId.name }
      );
    }
  });

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 2;

    try {
      const name = getRowValue(row, "Họ và tên");
      const phone = normalizePhone(getRowValue(row, "Số điện thoại"));
      const subjectNames = getRowValue(row, "Môn dạy");
      const className = getRowValue(row, "Lớp chủ nhiệm");

      if (!name || !subjectNames || !className) {
        throw new Error("Thiếu thông tin bắt buộc (Họ và tên, Môn dạy, Lớp chủ nhiệm)");
      }

      if (phone) {
        const existingTeacher = await Teacher.findOne({ phone });
        if (existingTeacher) {
          throw new Error(`Số điện thoại ${phone} đã được sử dụng bởi giáo viên ${existingTeacher.name}`);
        }
      }

      const subjectIds = await processSubjectNames(subjectNames, schoolYearId);

      const classInfo = await findClassFlexible(className, schoolYearId);
      if (!classInfo) {
        const schoolYear = await SchoolYear.findById(schoolYearId);
        throw new Error(
          `Lớp "${className}" không tồn tại trong năm học ${schoolYear?.year || "hiện tại"}`
        );
      }

      const classIdStr = classInfo._id.toString();
      if (homeroomMap.has(classIdStr)) {
        const existing = homeroomMap.get(classIdStr);
        throw new Error(
          `Lớp "${existing.className}" đã có giáo viên chủ nhiệm là "${existing.teacherName}". Mỗi lớp chỉ có 1 giáo viên chủ nhiệm`
        );
      }

      const teacher = await Teacher.create({
        name: name.trim(),
        phone: phone || null,
        subjectIds,
        mainClassId: classInfo._id,
        schoolYearId,
        status: "active"
      });

      homeroomMap.set(classIdStr, { 
        teacherName: teacher.name, 
        className: classInfo.name 
      });

      const populatedTeacher = await Teacher.findById(teacher._id)
        .populate("subjectIds", "name")
        .populate("mainClassId", "name grade");

      results.success.push({
        row: rowNumber,
        teacher: populatedTeacher
      });
    } catch (error) {
      results.failed.push({
        row: rowNumber,
        data: row,
        reason: error.message
      });
    }
  }

  return {
    total: data.length,
    successCount: results.success.length,
    failedCount: results.failed.length,
    success: results.success,
    failed: results.failed,
    schoolYearId
  };
};

const exportTeachers = async () => {
  const schoolYearId = await getActiveSchoolYearId();

  const teachers = await Teacher.find({ schoolYearId, status: "active" })
    .populate("subjectIds", "name")
    .populate("mainClassId", "name grade")
    .sort({ name: 1 });

  return {
    teachers: teachers.map(t => ({
      "Họ và tên": t.name,
      "Số điện thoại": t.phone || "",
      "Môn dạy": t.subjectIds.map(s => s.name).join(", "),
      "Lớp chủ nhiệm": t.mainClassId?.name || ""
    })),
    schoolYearId
  };
};

module.exports = {
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  updateTeacherUserId,
  deleteTeacher,
  importTeachers,
  exportTeachers
};