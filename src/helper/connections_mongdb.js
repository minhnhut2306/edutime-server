
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI) 
  .then(() => console.log("Đã kết nối đến MongoDB tại!" ,process.env.MONGODB_URI))
  .catch((err) => console.log("Không thể kết nối đến server MongoDB. Lỗi:", err));
