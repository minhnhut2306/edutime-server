// ============================================
// src/scripts/cleanupSchoolYearField.js
// ============================================
// Script để xóa field schoolYear (string) cũ khỏi tất cả collections
// Chạy sau khi đã migrate sang schoolYearId (ObjectId)

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Teacher = require('../models/teacherModel');
const Class = require('../models/classesModel');
const Subject = require('../models/subjectModel');
const Week = require('../models/weekModel');
const TeachingRecords = require('../models/teachingRecordsModel');
const SchoolYear = require('../models/schoolYearModel');

async function cleanupSchoolYearField() {
  try {
    console.log('🚀 Bắt đầu xóa field schoolYear cũ...\n');

    // Kết nối MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB\n');

    const collections = [
      { name: 'Teachers', model: Teacher },
      { name: 'Classes', model: Class },
      { name: 'Subjects', model: Subject },
      { name: 'Weeks', model: Week },
      { name: 'TeachingRecords', model: TeachingRecords }
    ];

    let totalCleaned = 0;

    for (const { name, model } of collections) {
      console.log(`🔍 Kiểm tra ${name}...`);

      // Đếm số documents có field schoolYear
      const docsWithOldField = await model.find({ 
        schoolYear: { $exists: true } 
      }).select('_id schoolYear').lean();

      const countWithOldField = docsWithOldField.length;

      if (countWithOldField > 0) {
        console.log(`   ⚠️  Tìm thấy ${countWithOldField} documents có field schoolYear`);
        console.log(`   📋 Danh sách: ${docsWithOldField.map(d => d.schoolYear).join(', ')}`);
        
        // Phương pháp 1: Thử updateMany với $unset
        try {
          const result1 = await model.updateMany(
            { schoolYear: { $exists: true } },
            { $unset: { schoolYear: 1 } }
          );
          console.log(`   🔄 Phương pháp 1: matchedCount=${result1.matchedCount}, modifiedCount=${result1.modifiedCount}`);
          totalCleaned += result1.modifiedCount || 0;
        } catch (err) {
          console.log(`   ❌ Phương pháp 1 thất bại: ${err.message}`);
        }

        // Phương pháp 2: Xóa từng document
        let individualCount = 0;
        for (const doc of docsWithOldField) {
          try {
            await model.collection.updateOne(
              { _id: doc._id },
              { $unset: { schoolYear: 1 } }
            );
            individualCount++;
          } catch (err) {
            console.log(`   ❌ Không thể xóa doc ${doc._id}: ${err.message}`);
          }
        }
        console.log(`   🔄 Phương pháp 2: Đã xóa ${individualCount}/${countWithOldField} documents`);

        // Verify
        const remainingCount = await model.countDocuments({ 
          schoolYear: { $exists: true } 
        });
        
        if (remainingCount === 0) {
          console.log(`   ✅ Xác nhận: Không còn field schoolYear trong ${name}\n`);
        } else {
          console.log(`   ⚠️  Cảnh báo: Còn ${remainingCount} documents chưa xóa được`);
          
          // Debug: Hiển thị documents còn lại
          const remaining = await model.find({ 
            schoolYear: { $exists: true } 
          }).select('_id schoolYear').lean();
          console.log(`   🔍 Documents còn lại:`, remaining);
          console.log('');
        }
      } else {
        console.log(`   ✓ Không có field schoolYear cần xóa\n`);
      }
    }

    // Kiểm tra tất cả documents có schoolYearId
    console.log('📊 Thống kê sau cleanup:');
    console.log('─────────────────────────────────────────────');
    
    for (const { name, model } of collections) {
      const total = await model.countDocuments();
      const withSchoolYearId = await model.countDocuments({ 
        schoolYearId: { $exists: true } 
      });
      const withSchoolYear = await model.countDocuments({ 
        schoolYear: { $exists: true } 
      });

      console.log(`${name}:`);
      console.log(`  - Tổng số: ${total}`);
      console.log(`  - Có schoolYearId: ${withSchoolYearId}`);
      console.log(`  - Còn schoolYear cũ: ${withSchoolYear}`);
      
      if (total > 0 && withSchoolYearId < total) {
        console.log(`  ⚠️  CẢNH BÁO: ${total - withSchoolYearId} documents thiếu schoolYearId!`);
      }
      console.log('');
    }

    console.log('─────────────────────────────────────────────');
    console.log(`✅ Hoàn thành! Đã xóa field schoolYear từ ${totalCleaned} documents\n`);

    if (totalCleaned === 0) {
      console.log('💡 Database đã sạch, không có field schoolYear cũ nào cần xóa.');
    } else {
      console.log('💡 Lưu ý:');
      console.log('- Field "schoolYear" (string) đã bị xóa khỏi tất cả collections');
      console.log('- Tất cả collections hiện dùng "schoolYearId" (ObjectId)');
      console.log('- Nên chạy rebuildIndexes.js để đảm bảo indexes đúng\n');
    }

  } catch (error) {
    console.error('❌ Lỗi khi cleanup:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Đã ngắt kết nối MongoDB');
    process.exit(0);
  }
}

// Chạy cleanup
cleanupSchoolYearField();

// ============================================
// HƯỚNG DẪN SỬ DỤNG:
// ============================================
/*

1️⃣ Chạy script:
   node src/scripts/cleanupSchoolYearField.js

2️⃣ Script sẽ:
   - Tìm tất cả documents có field schoolYear
   - Xóa field schoolYear khỏi các documents đó
   - Hiển thị thống kê kết quả
   - Xác nhận không còn field schoolYear

3️⃣ Sau khi chạy:
   - Chạy rebuildIndexes.js để rebuild indexes
   - Kiểm tra ứng dụng hoạt động bình thường

4️⃣ Rollback (nếu cần):
   - Sử dụng MongoDB backup để restore
   - Hoặc chạy lại migrateSchoolYear.js

⚠️ LƯU Ý:
   - Script này AN TOÀN, chỉ XÓA field không cần thiết
   - QUAN TRỌNG: Chỉ chạy sau khi đã migrate sang schoolYearId
   - Backup database trước khi chạy (khuyến nghị)
   - Script có thể chạy nhiều lần (idempotent)

✅ Kiểm tra trước khi chạy:
   - Tất cả documents đã có schoolYearId?
   - Ứng dụng đang chạy với schoolYearId?
   - Đã backup database chưa?

*/