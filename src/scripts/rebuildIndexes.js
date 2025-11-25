// ============================================
// src/scripts/rebuildIndexes.js
// ============================================
// Script để rebuild tất cả index sau khi migrate

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Teacher = require('../models/teacherModel');
const Class = require('../models/classesModel');
const Subject = require('../models/subjectModel');
const Week = require('../models/weekModel');
const TeachingRecords = require('../models/teachingRecordsModel');
const SchoolYear = require('../models/schoolYearModel');

async function rebuildIndexes() {
  try {
    console.log('🚀 Bắt đầu rebuild indexes...\n');

    // Kết nối MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB\n');

    const models = [
      { name: 'Teacher', model: Teacher },
      { name: 'Class', model: Class },
      { name: 'Subject', model: Subject },
      { name: 'Week', model: Week },
      { name: 'TeachingRecords', model: TeachingRecords },
      { name: 'SchoolYear', model: SchoolYear }
    ];

    for (const { name, model } of models) {
      console.log(`📋 Rebuilding indexes for ${name}...`);
      
      try {
        // Xóa tất cả index cũ (trừ _id)
        await model.collection.dropIndexes();
        console.log(`   ✓ Dropped old indexes`);
        
        // Tạo lại index từ schema
        await model.syncIndexes();
        console.log(`   ✓ Created new indexes`);
        
        // Hiển thị danh sách index
        const indexes = await model.collection.getIndexes();
        console.log(`   ✓ Current indexes:`, Object.keys(indexes).join(', '));
        console.log('');
      } catch (error) {
        console.error(`   ❌ Error with ${name}:`, error.message);
      }
    }

    console.log('✅ Hoàn thành rebuild indexes!\n');
    
    // Hiển thị thống kê
    console.log('📊 Tổng quan:');
    for (const { name, model } of models) {
      const count = await model.countDocuments();
      const indexes = await model.collection.getIndexes();
      console.log(`   ${name}: ${count} documents, ${Object.keys(indexes).length} indexes`);
    }

  } catch (error) {
    console.error('❌ Lỗi khi rebuild indexes:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Đã ngắt kết nối MongoDB');
    process.exit(0);
  }
}

// Chạy script
rebuildIndexes();

// ============================================
// HƯỚNG DẪN SỬ DỤNG:
// ============================================
/*

1️⃣ Chạy script sau khi migrate:
   node src/scripts/rebuildIndexes.js

2️⃣ Script sẽ:
   - Xóa tất cả index cũ (trừ _id)
   - Tạo lại index từ schema definition
   - Hiển thị danh sách index hiện tại

3️⃣ Khi nào cần chạy:
   - Sau khi migrate từ schoolYear → schoolYearId
   - Khi thay đổi index trong model
   - Khi gặp lỗi duplicate key

⚠️ LƯU Ý:
   - Script này AN TOÀN, không ảnh hưởng đến data
   - Chạy khi server đang KHÔNG hoạt động
   - Quá trình có thể mất vài phút với DB lớn

*/