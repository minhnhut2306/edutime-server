const SchoolYear = require('../models/schoolYearModel');
const Teacher = require('../models/teacherModel');
const Class = require('../models/classesModel');
const Subject = require('../models/subjectModel');
const Week = require('../models/weekModel');
const TeachingRecord = require('../models/teachingRecordsModel');
const ExcelJS = require('exceljs');

class SchoolYearService {
  async getSchoolYears() {
    return await SchoolYear.find().sort({ year: -1 }).lean();
  }

  async getActiveSchoolYear() {
    return await SchoolYear.findOne({ status: 'active' }).sort({ createdAt: -1 }).lean();
  }

  async createSchoolYear(year) {
    const existing = await SchoolYear.findOne({ year });
    if (existing) return existing;
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

  async finishSchoolYear(currentYear) {
    const currentSchoolYear = await SchoolYear.findOne({ year: currentYear });
    if (!currentSchoolYear) {
      throw new Error('Không tìm thấy năm học hiện tại. Vui lòng kiểm tra lại lựa chọn.');
    }
    if (currentSchoolYear.status === 'archived') {
      throw new Error('Năm học này đã được kết thúc trước đó.');
    }
    const [startYear] = currentYear.split('-').map(Number);
    const newYear = `${startYear + 1}-${startYear + 2}`;
    const existingNewYear = await SchoolYear.findOne({ year: newYear });
    if (existingNewYear) {
      throw new Error(`Năm học ${newYear} đã tồn tại. Vui lòng kiểm tra lại.`);
    }
    await Promise.all([
      Teacher.updateMany({ schoolYearId: currentSchoolYear._id }, { status: 'archived' }),
      Class.updateMany({ schoolYearId: currentSchoolYear._id }, { status: 'archived' }),
      Subject.updateMany({ schoolYearId: currentSchoolYear._id }, { status: 'archived' }),
      Week.updateMany({ schoolYearId: currentSchoolYear._id }, { status: 'archived' })
    ]);
    const newSchoolYear = await this.createSchoolYear(newYear);
    await SchoolYear.updateOne({ year: currentYear }, { status: 'archived', endedAt: new Date() });
    return {
      archivedYear: currentYear,
      newYear,
      newSchoolYearId: newSchoolYear._id.toString(),
      message: 'Đã kết thúc năm học. Dữ liệu cũ đã được lưu trữ. Bạn có thể nhập dữ liệu cho năm mới.'
    };
  }

  async getSchoolYearData(yearOrId) {
    const query = {};
    const schoolYear = await SchoolYear.findOne({ $or: [{ _id: yearOrId }, { year: yearOrId }] });
    if (!schoolYear) {
      throw new Error('Không tìm thấy năm học. Vui lòng kiểm tra lựa chọn của bạn.');
    }
    const [teachersCount, classesCount, subjectsCount, weeksCount, recordsCount] = await Promise.all([
      Teacher.countDocuments({ schoolYearId: schoolYear._id }),
      Class.countDocuments({ schoolYearId: schoolYear._id }),
      Subject.countDocuments({ schoolYearId: schoolYear._id }),
      Week.countDocuments({ schoolYearId: schoolYear._id }),
      TeachingRecord.countDocuments({ schoolYearId: schoolYear._id })
    ]);
    return {
      schoolYear: {
        id: schoolYear._id.toString(),
        year: schoolYear.year,
        status: schoolYear.status,
        createdAt: schoolYear.createdAt,
        endedAt: schoolYear.endedAt || null
      },
      stats: {
        teachers: teachersCount,
        classes: classesCount,
        subjects: subjectsCount,
        weeks: weeksCount,
        teachingRecords: recordsCount
      }
    };
  }

  async exportYearData(yearOrId) {
    const schoolYear = await SchoolYear.findOne({ $or: [{ _id: yearOrId }, { year: yearOrId }] });
    if (!schoolYear) {
      throw new Error('Không tìm thấy năm học. Vui lòng kiểm tra lựa chọn của bạn.');
    }
    const [teachers, classes, subjects] = await Promise.all([
      Teacher.find({ schoolYearId: schoolYear._id }).populate('subjectIds', 'name').populate('mainClassId', 'name grade').lean(),
      Class.find({ schoolYearId: schoolYear._id }).lean(),
      Subject.find({ schoolYearId: schoolYear._id }).lean()
    ]);
    const workbook = new ExcelJS.Workbook();
    const teacherSheet = workbook.addWorksheet('Danh sách GV');
    teacherSheet.columns = [
      { header: 'Họ và tên', key: 'name', width: 25 },
      { header: 'Số điện thoại', key: 'phone', width: 15 },
      { header: 'Môn dạy', key: 'subjects', width: 30 },
      { header: 'Lớp chủ nhiệm', key: 'mainClass', width: 15 }
    ];
    teachers.forEach(t => {
      teacherSheet.addRow({
        name: t.name,
        phone: t.phone || '',
        subjects: t.subjectIds?.map(s => s.name).join(', ') || '',
        mainClass: t.mainClassId?.name || ''
      });
    });
    const classSheet = workbook.addWorksheet('Danh sách lớp');
    classSheet.columns = [
      { header: 'Tên lớp', key: 'name', width: 15 },
      { header: 'Khối', key: 'grade', width: 10 },
      { header: 'Sĩ số', key: 'studentCount', width: 10 }
    ];
    classes.forEach(c => {
      classSheet.addRow({
        name: c.name,
        grade: c.grade,
        studentCount: c.studentCount || 0
      });
    });
    const subjectSheet = workbook.addWorksheet('Danh sách môn');
    subjectSheet.columns = [{ header: 'Tên môn học', key: 'name', width: 25 }];
    subjects.forEach(s => {
      subjectSheet.addRow({ name: s.name });
    });
    [teacherSheet, classSheet, subjectSheet].forEach(sheet => {
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9E1F2' }
      };
    });
    return workbook;
  }

  async deleteSchoolYear(year) {
    const schoolYear = await SchoolYear.findOne({ year });
    if (!schoolYear) {
      throw new Error('Không tìm thấy năm học. Vui lòng kiểm tra lại.');
    }
    await Promise.all([
      Teacher.deleteMany({ schoolYearId: schoolYear._id }),
      Class.deleteMany({ schoolYearId: schoolYear._id }),
      Subject.deleteMany({ schoolYearId: schoolYear._id }),
      Week.deleteMany({ schoolYearId: schoolYear._id }),
      TeachingRecord.deleteMany({ schoolYearId: schoolYear._id }),
      SchoolYear.deleteOne({ year })
    ]);
    return true;
  }
}

module.exports = new SchoolYearService();