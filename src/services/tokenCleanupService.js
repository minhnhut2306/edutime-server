// src/services/tokenCleanupService.js
const cron = require('node-cron');
const Token = require('../models/tokenModel');

const cleanupTokens = async () => {
  try {
    const now = new Date();

    console.log('Kiểm tra token...');
    console.log('   - Thời gian hiện tại:', now.toLocaleString('vi-VN'));
    const expiredCount = await Token.countDocuments({ expiresAt: { $lt: now } });
    const inactiveCount = await Token.countDocuments({ isActive: false });
    
    console.log(`   - Token hết hạn: ${expiredCount}`);
    console.log(`   - Token inactive (isActive=false): ${inactiveCount}`);

    const expiredResult = await Token.deleteMany({
      expiresAt: { $lt: now }
    });
    const inactiveResult = await Token.deleteMany({
      isActive: false
    });

    const total = expiredResult.deletedCount + inactiveResult.deletedCount;

    if (total > 0) {
      console.log(`Đã xóa ${total} token (${expiredResult.deletedCount} hết hạn, ${inactiveResult.deletedCount} inactive)`);
    } else {
      console.log('Không có token nào cần xóa');
    }

    return {
      success: true,
      expired: expiredResult.deletedCount,
      inactive: inactiveResult.deletedCount,
      total
    };
  } catch (error) {
    console.error('Lỗi xóa token:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Khởi động cron job tự động xóa token
 */
const startTokenCleanup = () => {
  cron.schedule("0 2 * * *", () => {
    console.log(
      "Running token cleanup at",
      new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
    );
    cleanupTokens();
  });

  console.log('Token Auto Cleanup đã khởi động (TEST: chạy mỗi 1 phút)');
};

module.exports = {
  startTokenCleanup,
  cleanupTokens
};