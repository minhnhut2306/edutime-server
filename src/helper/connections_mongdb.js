const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // Tăng timeout lên 10s cho Atlas
      socketTimeoutMS: 45000,
    });
    
    console.log("Đã kết nối đến MongoDB tại:", process.env.MONGODB_URI);
    
  } catch (err) {
    console.error("Không thể kết nối MongoDB:", err.message);
    process.exit(1);
  }
};

// Export Promise để đợi kết nối
module.exports = connectDB();