const SchoolYear = require('../models/schoolYearModel');
const Teacher = require('../models/teacherModel');
const Class = require('../models/classesModel');
const Subject = require('../models/subjectModel');
const Week = require('../models/weekModel');
const TeachingRecord = require('../models/teachingRecordsModel');
const ExcelJS = require('exceljs');

const archiveEntities = async (schoolYearId) => {
  await Promise.all([
    Teacher.updateMany({ schoolYearId }, { status: 'archived' }),
    Class.updateMany({ schoolYearId }, { status: 'archived' }),
    Subject.updateMany({ schoolYearId }, { status: 'archived' }),
    Week.updateMany({ schoolYearId }, { status: 'archived' })
  ]);
};

const deleteEntities = async (schoolYearId) => {
  await Promise.all([
    Teacher.deleteMany({ schoolYearId }),
    Class.deleteMany({ schoolYearId }),
    Subject.deleteMany({ schoolYearId }),
    Week.deleteMany({ schoolYearId }),
    TeachingRecord.deleteMany({ schoolYearId })
  ]);
};

const calculateNextYear = (currentYear) => {
  const [startYear] = currentYear.split('-').map(Number);
  return `${startYear + 1}-${startYear + 2}`;
};

const formatExcelSheet = (sheet) => {
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9E1F2' }
  };
};

const createTeacherSheet = (workbook, teachers) => {
  const sheet = workbook.addWorksheet('Danh sách GV');
  sheet.columns = [
    { header: 'Họ và tên', key: 'name', width: 25 },
    { header: 'Số điện thoại', key: 'phone', width: 15 },
    { header: 'Môn dạy', key: 'subjects', width: 30 },
    { header: 'Lớp chủ nhiệm', key: 'mainClass', width: 15 }
  ];

  teachers.forEach(t => {
    sheet.addRow({
      name: t.name,
      phone: t.phone || '',
      subjects: t.subjectIds?.map(s => s.name).join(', ') || '',
      mainClass: t.mainClassId?.name || ''
    });
  });

  formatExcelSheet(sheet);
  return sheet;
};

const createClassSheet = (workbook, classes) => {
  const sheet = workbook.addWorksheet('Danh sách lớp');
  sheet.columns = [
    { header: 'Tên lớp', key: 'name', width: 15 },
    { header: 'Khối', key: 'grade', width: 10 },
    { header: 'Sĩ số', key: 'studentCount', width: 10 }
  ];

  classes.forEach(c => {
    sheet.addRow({
      name: c.name,
      grade: c.grade,
      studentCount: c.studentCount || 0
    });
  });

  formatExcelSheet(sheet);
  return sheet;
};

const createSubjectSheet = (workbook, subjects) => {
  const sheet = workbook.addWorksheet('Danh sách môn');
  sheet.columns = [
    { header: 'Tên môn học', key: 'name', width: 25 }
  ];

  subjects.forEach(s => {
    sheet.addRow({ name: s.name });
  });

  formatExcelSheet(sheet);
  return sheet;
};

class SchoolYearService {
  async getSchoolYears() {
    return await SchoolYear.find().sort({ year: -1 }).lean();
  }

  async getActiveSchoolYear() {
    return await SchoolYear.findOne({ status: 'active' })
      .sort({ createdAt: -1 })
      .lean();
  }

  async getSchoolYearData(year) {
    return await SchoolYear.findOne({ year }).lean();
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
      throw new Error('Năm học hiện tại không tồn tại');
    }

    if (currentSchoolYear.status === 'archived') {
      throw new Error('Năm học này đã được kết thúc trước đó');
    }

    const newYear = calculateNextYear(currentYear);

    const existingNewYear = await SchoolYear.findOne({ year: newYear });
    if (existingNewYear) {
      throw new Error(`Năm học ${newYear} đã tồn tại`);
    }

    await archiveEntities(currentSchoolYear._id);

    const newSchoolYear = await this.createSchoolYear(newYear);

    await SchoolYear.updateOne(
      { year: currentYear },
      { status: 'archived', endedAt: new Date() }
    );

    return {
      archivedYear: currentYear,
      newYear,
      newSchoolYearId: newSchoolYear._id.toString(),
      message: 'Đã kết thúc năm học. Dữ liệu cũ đã được lưu trữ. Bạn có thể import dữ liệu cho năm mới'
    };
  }

  async exportYearData(year) {
    const schoolYear = await SchoolYear.findOne({ year });
    if (!schoolYear) {
      throw new Error('Năm học không tồn tại');
    }

    const [teachers, classes, subjects] = await Promise.all([
      Teacher.find({ schoolYearId: schoolYear._id, status: 'archived' })
        .populate('subjectIds', 'name')
        .populate('mainClassId', 'name grade')
        .lean(),
      Class.find({ schoolYearId: schoolYear._id, status: 'archived' }).lean(),
      Subject.find({ schoolYearId: schoolYear._id, status: 'archived' }).lean()
    ]);

    const workbook = new ExcelJS.Workbook();

    createTeacherSheet(workbook, teachers);
    createClassSheet(workbook, classes);
    createSubjectSheet(workbook, subjects);

    return workbook;
  }

  async deleteSchoolYear(year) {
    const schoolYear = await SchoolYear.findOne({ year });
    if (!schoolYear) {
      throw new Error('Năm học không tồn tại');
    }

    await deleteEntities(schoolYear._id);
    await SchoolYear.deleteOne({ year });
    
    return true;
  }
}

module.exports = new SchoolYearService();