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
    
    return years; // Trả về array objects có {year, status, ...}
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

    const [teachers, classes, subjects] = await Promise.all([
      Teacher.find({ schoolYear: currentYear }).lean(),
      Class.find({ schoolYear: currentYear }).lean(),
      Subject.find({ schoolYear: currentYear }).lean()
    ]);

    const newSchoolYear = await this.createSchoolYear(newYear);

    const copyWithNewYear = (items) => {
      return items.map(item => {
        const { _id, __v, ...rest } = item;
        return {
          ...rest,
          schoolYear: newYear,
          createdAt: new Date()
        };
      });
    };

    const [newTeachers, newClasses, newSubjects] = await Promise.all([
      Teacher.insertMany(copyWithNewYear(teachers)),
      Class.insertMany(copyWithNewYear(classes)),
      Subject.insertMany(copyWithNewYear(subjects))
    ]);

    newSchoolYear.teachers = newTeachers.map(t => t._id);
    newSchoolYear.classes = newClasses.map(c => c._id);
    newSchoolYear.subjects = newSubjects.map(s => s._id);

    const [updatedNewYear] = await Promise.all([
      newSchoolYear.save(),
      SchoolYear.updateOne(
        { year: currentYear },
        { status: 'archived', endedAt: new Date() }
      )
    ]);

    return {
      archivedYear: currentYear,
      newYear,
      newSchoolYearId: updatedNewYear._id.toString()
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
}

module.exports = new SchoolYearService();