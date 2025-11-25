const SchoolYear = require('../models/schoolYearModel');
const Teacher = require('../models/teacherModel');
const Class = require('../models/classesModel');
const Subject = require('../models/subjectModel');
const Week = require('../models/weekModel');
const TeachingRecord = require('../models/teachingRecordsModel');

class SchoolYearService {
  async getSchoolYears() {
    const years = await SchoolYear.find()
      .sort({ year: -1 })
      .lean();
    
    return years; 
  }

  async getSchoolYearData(year) {
    return await SchoolYear.findOne({ year })
      .populate('teachers')
      .populate('classes')
      .populate('subjects')
      .populate('weeks')
      .populate('teachingRecords')
      .lean();
  }

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

    // Archive tất cả dữ liệu của năm học cũ
    await Promise.all([
      Teacher.updateMany(
        { schoolYear: currentYear },
        { status: 'archived' }
      ),
      Class.updateMany(
        { schoolYear: currentYear },
        { status: 'archived' }
      ),
      Subject.updateMany(
        { schoolYear: currentYear },
        { status: 'archived' }
      ),
      Week.updateMany(
        { schoolYear: currentYear },
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
      message: 'Đã kết thúc năm học. Vui lòng import dữ liệu cho năm học mới!'
    };
  }

  async exists(year) {
    const count = await SchoolYear.countDocuments({ year });
    return count > 0;
  }

  async getActiveSchoolYear() {
    return await SchoolYear.findOne({ status: 'active' })
      .sort({ createdAt: -1 })
      .lean();
  }

  async deleteSchoolYear(year) {
    const schoolYear = await SchoolYear.findOne({ year });
    
    if (!schoolYear) {
      throw new Error('Năm học không tồn tại!');
    }

    await Promise.all([
      Teacher.deleteMany({ schoolYear: year }),
      Class.deleteMany({ schoolYear: year }),
      Subject.deleteMany({ schoolYear: year }),
      Week.deleteMany({ schoolYear: year }),
      TeachingRecord.deleteMany({ schoolYear: year }),
      SchoolYear.deleteOne({ year })
    ]);
    
    return true;
  }

  // Export dữ liệu năm học cũ để import cho năm mới
  async exportYearData(year) {
    const [teachers, classes, subjects] = await Promise.all([
      Teacher.find({ schoolYear: year, status: 'active' })
        .populate('subjectIds', 'name')
        .populate('mainClassId', 'name grade')
        .lean(),
      Class.find({ schoolYear: year, status: 'active' }).lean(),
      Subject.find({ schoolYear: year, status: 'active' }).lean()
    ]);

    return {
      teachers: teachers.map(t => ({
        name: t.name,
        phone: t.phone || '',
        subjects: t.subjectIds.map(s => s.name).join(', '),
        mainClass: t.mainClassId?.name || ''
      })),
      classes: classes.map(c => ({
        name: c.name,
        grade: c.grade,
        studentCount: c.studentCount
      })),
      subjects: subjects.map(s => ({
        name: s.name
      }))
    };
  }
}

module.exports = new SchoolYearService();