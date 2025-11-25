// ============================================
// src/scripts/migrateSchoolYear.js
// ============================================
// Script để migrate dữ liệu cũ: chuyển từ schoolYear (string) sang schoolYearId (ObjectId)
// Chạy 1 lần duy nhất sau khi update model

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Teacher = require('../models/teacherModel');
const Class = require('../models/classesModel');
const Subject = require('../models/subjectModel');
const Week = require('../models/weekModel');
const TeachingRecords = require('../models/teachingRecordsModel');
const SchoolYear = require('../models/schoolYearModel');

// ✅ CẤU HÌNH: Đặt năm học mặc định cho dữ liệu cũ
const DEFAULT_SCHOOL_YEAR = '2025-2026';

async function migrateData() {
  try {
    console.log('🚀 Bắt đầu migrate dữ liệu...\n');

    // Kết nối MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB\n');

    // 1️⃣ Tạo năm học mặc định nếu chưa có
    console.log('📅 Kiểm tra năm học...');
    let schoolYear = await SchoolYear.findOne({ year: DEFAULT_SCHOOL_YEAR });
    
    if (!schoolYear) {
      schoolYear = await SchoolYear.create({
        year: DEFAULT_SCHOOL_YEAR,
        status: 'active',
        teachers: [],
        classes: [],
        subjects: [],
        weeks: [],
        teachingRecords: []
      });
      console.log(`✅ Đã tạo năm học: ${DEFAULT_SCHOOL_YEAR}\n`);
    } else {
      console.log(`✅ Năm học ${DEFAULT_SCHOOL_YEAR} đã tồn tại\n`);
    }

    const schoolYearId = schoolYear._id;

    // 2️⃣ Migrate Teachers
    console.log('👨‍🏫 Migrate Teachers...');
    const teachersWithOldField = await Teacher.find({ 
      $or: [
        { schoolYear: { $exists: true } }, // Field cũ tồn tại
        { schoolYearId: { $exists: false } }, // Field mới chưa có
        { status: { $exists: false } } // Thiếu status
      ]
    });

    if (teachersWithOldField.length > 0) {
      for (const teacher of teachersWithOldField) {
        const updateData = {};
        const unsetData = {};

        // Chuyển schoolYear (string) → schoolYearId (ObjectId)
        if (teacher.schoolYear && !teacher.schoolYearId) {
          updateData.schoolYearId = schoolYearId;
        }
        // Nếu thiếu schoolYearId, gán mặc định
        if (!teacher.schoolYearId) {
          updateData.schoolYearId = schoolYearId;
        }
        // Gán status
        if (!teacher.status) {
          updateData.status = 'active';
        }
        // Đánh dấu xóa field cũ
        if (teacher.schoolYear) {
          unsetData.schoolYear = "";
        }

        // Thực hiện update và unset
        await Teacher.updateOne(
          { _id: teacher._id },
          { 
            $set: updateData,
            $unset: unsetData 
          }
        );
      }
      console.log(`✅ Đã migrate ${teachersWithOldField.length} giáo viên\n`);
    } else {
      console.log('✅ Tất cả giáo viên đã có schoolYearId và status\n');
    }

    // 3️⃣ Migrate Classes
    console.log('🏫 Migrate Classes...');
    const classesWithOldField = await Class.find({ 
      $or: [
        { schoolYear: { $exists: true } },
        { schoolYearId: { $exists: false } },
        { status: { $exists: false } }
      ]
    });

    if (classesWithOldField.length > 0) {
      for (const classItem of classesWithOldField) {
        const updateData = {};
        const unsetData = {};

        if (classItem.schoolYear && !classItem.schoolYearId) {
          updateData.schoolYearId = schoolYearId;
        }
        if (!classItem.schoolYearId) {
          updateData.schoolYearId = schoolYearId;
        }
        if (!classItem.status) {
          updateData.status = 'active';
        }
        if (classItem.schoolYear) {
          unsetData.schoolYear = "";
        }

        await Class.updateOne(
          { _id: classItem._id },
          { 
            $set: updateData,
            $unset: unsetData 
          }
        );
      }
      console.log(`✅ Đã migrate ${classesWithOldField.length} lớp học\n`);
    } else {
      console.log('✅ Tất cả lớp học đã có schoolYearId và status\n');
    }

    // 4️⃣ Migrate Subjects
    console.log('📚 Migrate Subjects...');
    const subjectsWithOldField = await Subject.find({ 
      $or: [
        { schoolYear: { $exists: true } },
        { schoolYearId: { $exists: false } },
        { status: { $exists: false } }
      ]
    });

    if (subjectsWithOldField.length > 0) {
      for (const subject of subjectsWithOldField) {
        const updateData = {};
        const unsetData = {};

        if (subject.schoolYear && !subject.schoolYearId) {
          updateData.schoolYearId = schoolYearId;
        }
        if (!subject.schoolYearId) {
          updateData.schoolYearId = schoolYearId;
        }
        if (!subject.status) {
          updateData.status = 'active';
        }
        if (subject.schoolYear) {
          unsetData.schoolYear = "";
        }

        await Subject.updateOne(
          { _id: subject._id },
          { 
            $set: updateData,
            $unset: unsetData 
          }
        );
      }
      console.log(`✅ Đã migrate ${subjectsWithOldField.length} môn học\n`);
    } else {
      console.log('✅ Tất cả môn học đã có schoolYearId và status\n');
    }

    // 5️⃣ Migrate Weeks
    console.log('📅 Migrate Weeks...');
    const weeksWithOldField = await Week.find({ 
      $or: [
        { schoolYear: { $exists: true } },
        { schoolYearId: { $exists: false } },
        { status: { $exists: false } }
      ]
    });

    if (weeksWithOldField.length > 0) {
      for (const week of weeksWithOldField) {
        const updateData = {};
        const unsetData = {};

        if (week.schoolYear) {
          // Nếu có field schoolYear cũ, tìm hoặc tạo SchoolYear tương ứng
          let weekSchoolYear = await SchoolYear.findOne({ year: week.schoolYear });
          if (!weekSchoolYear) {
            weekSchoolYear = await SchoolYear.create({
              year: week.schoolYear,
              status: 'archived',
              teachers: [],
              classes: [],
              subjects: [],
              weeks: [],
              teachingRecords: []
            });
          }
          updateData.schoolYearId = weekSchoolYear._id;
          unsetData.schoolYear = "";
        } else if (!week.schoolYearId) {
          // Nếu không có cả 2, xác định từ startDate
          const startDate = new Date(week.startDate);
          const month = startDate.getMonth() + 1;
          const year = startDate.getFullYear();
          
          const schoolYearStr = month >= 9 
            ? `${year}-${year + 1}`
            : `${year - 1}-${year}`;
          
          let weekSchoolYear = await SchoolYear.findOne({ year: schoolYearStr });
          if (!weekSchoolYear) {
            weekSchoolYear = await SchoolYear.create({
              year: schoolYearStr,
              status: schoolYearStr === DEFAULT_SCHOOL_YEAR ? 'active' : 'archived',
              teachers: [],
              classes: [],
              subjects: [],
              weeks: [],
              teachingRecords: []
            });
          }
          updateData.schoolYearId = weekSchoolYear._id;
        }
        
        if (!week.status) {
          updateData.status = 'active';
        }

        await Week.updateOne(
          { _id: week._id },
          { 
            $set: updateData,
            ...(Object.keys(unsetData).length > 0 && { $unset: unsetData })
          }
        );
      }
      console.log(`✅ Đã migrate ${weeksWithOldField.length} tuần học\n`);
    } else {
      console.log('✅ Tất cả tuần học đã có schoolYearId và status\n');
    }

    // 6️⃣ Migrate TeachingRecords
    console.log('📝 Migrate TeachingRecords...');
    const recordsWithOldField = await TeachingRecords.find({ 
      $or: [
        { schoolYear: { $exists: true } },
        { schoolYearId: { $exists: false } }
      ]
    });

    if (recordsWithOldField.length > 0) {
      for (const record of recordsWithOldField) {
        const updateData = {};
        const unsetData = {};

        if (record.schoolYear) {
          let recordSchoolYear = await SchoolYear.findOne({ year: record.schoolYear });
          if (!recordSchoolYear) {
            recordSchoolYear = await SchoolYear.create({
              year: record.schoolYear,
              status: 'archived',
              teachers: [],
              classes: [],
              subjects: [],
              weeks: [],
              teachingRecords: []
            });
          }
          updateData.schoolYearId = recordSchoolYear._id;
          unsetData.schoolYear = "";
        } else if (!record.schoolYearId) {
          updateData.schoolYearId = schoolYearId;
        }

        await TeachingRecords.updateOne(
          { _id: record._id },
          { 
            $set: updateData,
            ...(Object.keys(unsetData).length > 0 && { $unset: unsetData })
          }
        );
      }
      console.log(`✅ Đã migrate ${recordsWithOldField.length} bản ghi giảng dạy\n`);
    } else {
      console.log('✅ Tất cả bản ghi giảng dạy đã có schoolYearId\n');
    }

    // 7️⃣ Tổng kết
    console.log('📊 Thống kê sau migrate:');
    const stats = {
      teachers: await Teacher.countDocuments({ schoolYearId, status: 'active' }),
      classes: await Class.countDocuments({ schoolYearId, status: 'active' }),
      subjects: await Subject.countDocuments({ schoolYearId, status: 'active' }),
      weeks: await Week.countDocuments({ schoolYearId, status: 'active' }),
      teachingRecords: await TeachingRecords.countDocuments({ schoolYearId })
    };

    console.table(stats);

    console.log('\n✅ Hoàn thành migrate dữ liệu!');
    console.log('\n💡 Lưu ý:');
    console.log('- Tất cả dữ liệu đã được chuyển từ schoolYear (string) → schoolYearId (ObjectId)');
    console.log('- Năm học mặc định:', DEFAULT_SCHOOL_YEAR);
    console.log('- Tất cả dữ liệu có status: active');
    console.log('- Field "schoolYear" cũ đã bị xóa\n');

  } catch (error) {
    console.error('❌ Lỗi khi migrate:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Đã ngắt kết nối MongoDB');
    process.exit(0);
  }
}

// Chạy migration
migrateData();

// ============================================
// HƯỚNG DẪN SỬ DỤNG:
// ============================================
/*

1️⃣ Chỉnh sửa năm học mặc định (nếu cần):
   - Sửa dòng: const DEFAULT_SCHOOL_YEAR = '2025-2026';

2️⃣ Chạy script:
   node src/scripts/migrateSchoolYear.js

3️⃣ Kiểm tra kết quả trong MongoDB:
   - Tất cả collections đã có schoolYearId (ObjectId)
   - Field schoolYear (string) đã bị xóa
   - Tất cả đã có status: 'active'

4️⃣ Nếu có lỗi:
   - Kiểm tra kết nối MongoDB
   - Kiểm tra models đã update chưa
   - Chạy lại script (idempotent - chạy nhiều lần không sao)

⚠️ LƯU Ý:
   - Script này AN TOÀN, chỉ UPDATE không XÓA dữ liệu
   - Chạy 1 lần duy nhất sau khi update models
   - Backup database trước khi chạy (khuyến nghị)

*/