// src/services/schoolYear.service.js
const SchoolYear = require('../models/schoolYearModel');
const Teacher = require('../models/teacherModel');
const Class = require('../models/classesModel');
const Subject = require('../models/subjectModel');
const Week = require('../models/weekModel');
const TeachingRecord = require('../models/teachingRecordsModel');

class SchoolYearService {
  /**
   * Lấy danh sách tất cả năm học (sắp xếp theo năm mới nhất)
   */
  async getSchoolYears() {
    const years = await SchoolYear.find({}, { year: 1 })
      .sort({ year: -1 })
      .lean();
    
    return years.map(y => y.year);
  }

  /**
   * Lấy chi tiết năm học cụ thể
   */
  async getSchoolYearData(year) {
    return await SchoolYear.findOne({ year })
      .populate('teachers')
      .populate('classes')
      .populate('subjects')
      .populate('weeks')
      .populate('teachingRecords')
      .lean();
  }

  /**
   * Tạo năm học mới (nếu chưa tồn tại)
   */
  async createSchoolYear(year) {
    const existing = await SchoolYear.findOne({ year });
    
    if (existing) {
      return existing;
    }

    const newYear = new SchoolYear({
      year,
      teachers: [],
      classes: [],
      subjects: [],
      weeks: [],
      teachingRecords: [],
      status: 'active'
    });

    return await newYear.save();
  }

  /**
   * Kết thúc năm học hiện tại và tạo năm mới
   */
  async finishSchoolYear(currentYear) {
    // 1. Kiểm tra năm học hiện tại
    const currentSchoolYear = await SchoolYear.findOne({ year: currentYear });
    
    if (!currentSchoolYear) {
      throw new Error('Năm học hiện tại không tồn tại!');
    }

    if (currentSchoolYear.status === 'archived') {
      throw new Error('Năm học này đã được kết thúc trước đó!');
    }

    // 2. Tạo năm học mới
    const [startYear] = currentYear.split('-').map(Number);
    const newYear = `${startYear + 1}-${startYear + 2}`;

    // Kiểm tra năm mới đã tồn tại chưa
    const existingNewYear = await SchoolYear.findOne({ year: newYear });
    if (existingNewYear) {
      throw new Error(`Năm học ${newYear} đã tồn tại!`);
    }

    // 3. Copy teachers, classes, subjects từ năm cũ sang năm mới
    const teachers = await Teacher.find({ schoolYear: currentYear });
    const classes = await Class.find({ schoolYear: currentYear });
    const subjects = await Subject.find({ schoolYear: currentYear });

    const newSchoolYear = await this.createSchoolYear(newYear);

    // Copy và tạo mới teachers
    const newTeachers = await Promise.all(
      teachers.map(async (t) => {
        const teacherObj = t.toObject();
        delete teacherObj._id;
        delete teacherObj.__v;
        
        const newTeacher = new Teacher({
          ...teacherObj,
          schoolYear: newYear,
          createdAt: new Date()
        });
        return await newTeacher.save();
      })
    );

    // Copy và tạo mới classes
    const newClasses = await Promise.all(
      classes.map(async (c) => {
        const classObj = c.toObject();
        delete classObj._id;
        delete classObj.__v;
        
        const newClass = new Class({
          ...classObj,
          schoolYear: newYear,
          createdAt: new Date()
        });
        return await newClass.save();
      })
    );

    // Copy và tạo mới subjects
    const newSubjects = await Promise.all(
      subjects.map(async (s) => {
        const subjectObj = s.toObject();
        delete subjectObj._id;
        delete subjectObj.__v;
        
        const newSubject = new Subject({
          ...subjectObj,
          schoolYear: newYear,
          createdAt: new Date()
        });
        return await newSubject.save();
      })
    );

    // 4. Cập nhật references cho năm mới
    newSchoolYear.teachers = newTeachers.map(t => t._id);
    newSchoolYear.classes = newClasses.map(c => c._id);
    newSchoolYear.subjects = newSubjects.map(s => s._id);
    await newSchoolYear.save();

    // 5. Đánh dấu năm hiện tại là "archived"
    currentSchoolYear.status = 'archived';
    currentSchoolYear.endedAt = new Date();
    await currentSchoolYear.save();

    return {
      archivedYear: currentYear,
      newYear,
      newSchoolYearId: newSchoolYear._id.toString()
    };
  }

  /**
   * Kiểm tra năm học có tồn tại không
   */
  async exists(year) {
    const count = await SchoolYear.countDocuments({ year });
    return count > 0;
  }

  /**
   * Lấy năm học đang active
   */
  async getActiveSchoolYear() {
    return await SchoolYear.findOne({ status: 'active' })
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Xóa năm học (chỉ admin)
   */
  async deleteSchoolYear(year) {
    const schoolYear = await SchoolYear.findOne({ year });
    
    if (!schoolYear) {
      throw new Error('Năm học không tồn tại!');
    }

    // Xóa tất cả dữ liệu liên quan
    await Teacher.deleteMany({ schoolYear: year });
    await Class.deleteMany({ schoolYear: year });
    await Subject.deleteMany({ schoolYear: year });
    await Week.deleteMany({ schoolYear: year });
    await TeachingRecord.deleteMany({ schoolYear: year });
    
    await SchoolYear.deleteOne({ year });
    
    return true;
  }
}

module.exports = new SchoolYearService();