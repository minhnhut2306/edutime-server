// src/services/schoolYearService.js
const SchoolYear = require('../models/schoolYearModel');
const Teacher = require('../models/teacherModel');
const Class = require('../models/classesModel');
const Subject = require('../models/subjectModel');
const Week = require('../models/weekModel');
const TeachingRecord = require('../models/teachingRecordsModel');
const ExcelJS = require('exceljs');

class SchoolYearService {
  // ✅ Lấy danh sách năm học
  async getSchoolYears() {
    return await SchoolYear.find().sort({ year: -1 }).lean();
  }

  // ✅ Lấy năm học active
  async getActiveSchoolYear() {
    return await SchoolYear.findOne({ status: 'active' })
      .sort({ createdAt: -1 })
      .lean();
  }

  // ✅ Tạo năm học mới
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

  // ✅ KẾT THÚC NĂM HỌC - Archive toàn bộ dữ liệu
  async finishSchoolYear(currentYear) {
    const currentSchoolYear = await SchoolYear.findOne({ year: currentYear });
    
    if (!currentSchoolYear) {
      throw new Error('Năm học hiện tại không tồn tại!');
    }

    if (currentSchoolYear.status === 'archived') {
      throw new Error('Năm học này đã được kết thúc trước đó!');
    }

    const [startYear] = currentYear.split('-').map(Number);
    const newYear = `${startYear + 1}-${startYear + 2}`;

    const existingNewYear = await SchoolYear.findOne({ year: newYear });
    if (existingNewYear) {
      throw new Error(`Năm học ${newYear} đã tồn tại!`);
    }

    // 🔥 ARCHIVE TẤT CẢ DỮ LIỆU CŨ (chuyển status thành 'archived')
    await Promise.all([
      Teacher.updateMany(
        { schoolYearId: currentSchoolYear._id },
        { status: 'archived' }
      ),
      Class.updateMany(
        { schoolYearId: currentSchoolYear._id },
        { status: 'archived' }
      ),
      Subject.updateMany(
        { schoolYearId: currentSchoolYear._id },
        { status: 'archived' }
      ),
      Week.updateMany(
        { schoolYearId: currentSchoolYear._id },
        { status: 'archived' }
      )
    ]);

    // Tạo năm học mới
    const newSchoolYear = await this.createSchoolYear(newYear);

    // Archive năm học cũ
    await SchoolYear.updateOne(
      { year: currentYear },
      { status: 'archived', endedAt: new Date() }
    );

    return {
      archivedYear: currentYear,
      newYear,
      newSchoolYearId: newSchoolYear._id.toString(),
      message: '✅ Đã kết thúc năm học. Dữ liệu cũ đã được lưu trữ. Bạn có thể import dữ liệu cho năm mới!'
    };
  }

  // ✅ XUẤT EXCEL DỮ LIỆU NĂM CŨ (Giáo viên, Lớp, Môn)
  async exportYearData(schoolYearId) {
    const schoolYear = await SchoolYear.findById(schoolYearId);
    if (!schoolYear) {
      throw new Error('Năm học không tồn tại');
    }

    const [teachers, classes, subjects] = await Promise.all([
      Teacher.find({ schoolYearId, status: 'archived' })
        .populate('subjectIds', 'name')
        .populate('mainClassId', 'name grade')
        .lean(),
      Class.find({ schoolYearId, status: 'archived' }).lean(),
      Subject.find({ schoolYearId, status: 'archived' }).lean()
    ]);

    // Tạo Excel workbook
    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Giáo viên
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

    // Sheet 2: Lớp học
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

    // Sheet 3: Môn học
    const subjectSheet = workbook.addWorksheet('Danh sách môn');
    subjectSheet.columns = [
      { header: 'Tên môn học', key: 'name', width: 25 }
    ];

    subjects.forEach(s => {
      subjectSheet.addRow({ name: s.name });
    });

    // Format header cho tất cả sheets
    [teacherSheet, classSheet, subjectSheet].forEach(sheet => {
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9E1F2' }
      };
    });

    return {
      workbook,
      fileName: `DuLieu_NamHoc_${schoolYear.year}.xlsx`,
      stats: {
        teachers: teachers.length,
        classes: classes.length,
        subjects: subjects.length
      }
    };
  }

  // ✅ XÓA NĂM HỌC & TẤT CẢ DỮ LIỆU LIÊN QUAN
  async deleteSchoolYear(year) {
    const schoolYear = await SchoolYear.findOne({ year });
    if (!schoolYear) {
      throw new Error('Năm học không tồn tại!');
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