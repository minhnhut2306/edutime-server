// ============================================
// src/scripts/migrateSchoolYear.js
// ============================================
// Script để migrate dữ liệu cũ: thêm schoolYear và status
// Chạy 1 lần duy nhất sau khi update model

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Teacher = require('../models/teacherModel');
const Class = require('../models/classesModel');
const Subject = require('../models/subjectModel');
const Week = require('../models/weekModel');
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

    // 2️⃣ Migrate Teachers
    console.log('👨‍🏫 Migrate Teachers...');
    const teachersWithoutYear = await Teacher.find({ 
      $or: [
        { schoolYear: { $exists: false } },
        { status: { $exists: false } }
      ]
    });

    if (teachersWithoutYear.length > 0) {
      for (const teacher of teachersWithoutYear) {
        if (!teacher.schoolYear) teacher.schoolYear = DEFAULT_SCHOOL_YEAR;
        if (!teacher.status) teacher.status = 'active';
        await teacher.save();
      }
      console.log(`✅ Đã migrate ${teachersWithoutYear.length} giáo viên\n`);
    } else {
      console.log('✅ Tất cả giáo viên đã có schoolYear và status\n');
    }

    // 3️⃣ Migrate Classes
    console.log('🏫 Migrate Classes...');
    const classesWithoutYear = await Class.find({ 
      $or: [
        { schoolYear: { $exists: false } },
        { status: { $exists: false } }
      ]
    });

    if (classesWithoutYear.length > 0) {
      for (const classItem of classesWithoutYear) {
        if (!classItem.schoolYear) classItem.schoolYear = DEFAULT_SCHOOL_YEAR;
        if (!classItem.status) classItem.status = 'active';
        await classItem.save();
      }
      console.log(`✅ Đã migrate ${classesWithoutYear.length} lớp học\n`);
    } else {
      console.log('✅ Tất cả lớp học đã có schoolYear và status\n');
    }

    // 4️⃣ Migrate Subjects
    console.log('📚 Migrate Subjects...');
    const subjectsWithoutYear = await Subject.find({ 
      $or: [
        { schoolYear: { $exists: false } },
        { status: { $exists: false } }
      ]
    });

    if (subjectsWithoutYear.length > 0) {
      for (const subject of subjectsWithoutYear) {
        if (!subject.schoolYear) subject.schoolYear = DEFAULT_SCHOOL_YEAR;
        if (!subject.status) subject.status = 'active';
        await subject.save();
      }
      console.log(`✅ Đã migrate ${subjectsWithoutYear.length} môn học\n`);
    } else {
      console.log('✅ Tất cả môn học đã có schoolYear và status\n');
    }

    // 5️⃣ Migrate Weeks
    console.log('📅 Migrate Weeks...');
    const weeksWithoutYear = await Week.find({ 
      $or: [
        { schoolYear: { $exists: false } },
        { status: { $exists: false } }
      ]
    });

    if (weeksWithoutYear.length > 0) {
      for (const week of weeksWithoutYear) {
        if (!week.schoolYear) {
          // Tự động xác định năm học từ startDate
          const startDate = new Date(week.startDate);
          const month = startDate.getMonth() + 1; // 1-12
          const year = startDate.getFullYear();
          
          // Nếu tháng 9-12 thì năm học là year-year+1
          // Nếu tháng 1-8 thì năm học là year-1-year
          const schoolYearStr = month >= 9 
            ? `${year}-${year + 1}`
            : `${year - 1}-${year}`;
          
          week.schoolYear = schoolYearStr;
        }
        if (!week.status) week.status = 'active';
        await week.save();
      }
      console.log(`✅ Đã migrate ${weeksWithoutYear.length} tuần học\n`);
    } else {
      console.log('✅ Tất cả tuần học đã có schoolYear và status\n');
    }

    // 6️⃣ Tổng kết
    console.log('📊 Thống kê sau migrate:');
    const stats = {
      teachers: await Teacher.countDocuments({ schoolYear: DEFAULT_SCHOOL_YEAR, status: 'active' }),
      classes: await Class.countDocuments({ schoolYear: DEFAULT_SCHOOL_YEAR, status: 'active' }),
      subjects: await Subject.countDocuments({ schoolYear: DEFAULT_SCHOOL_YEAR, status: 'active' }),
      weeks: await Week.countDocuments({ status: 'active' })
    };

    console.table(stats);

    console.log('\n✅ Hoàn thành migrate dữ liệu!');
    console.log('\n💡 Lưu ý:');
    console.log('- Tất cả dữ liệu cũ đã được gán năm học:', DEFAULT_SCHOOL_YEAR);
    console.log('- Tất cả dữ liệu có status: active');
    console.log('- Bạn có thể kiểm tra lại trong database');
    console.log('- Nếu sai, chỉnh sửa DEFAULT_SCHOOL_YEAR và chạy lại script\n');

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
   - Sửa dòng: const DEFAULT_SCHOOL_YEAR = '2024-2025';

2️⃣ Chạy script:
   node src/scripts/migrateSchoolYear.js

3️⃣ Kiểm tra kết quả trong MongoDB:
   - Tất cả teachers/classes/subjects/weeks đã có schoolYear
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