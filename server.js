require('dotenv').config();
const app = require('./app'); 
const connectDB = require('./src/helper/connections_mongdb'); 

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB;
    
    app.listen(PORT, () => {
      console.log(`Server đang chạy tại http://localhost:${PORT}`);
    });
    
  } catch (error) {
    console.error('Lỗi khởi động server:', error);
    process.exit(1);
  }
};

startServer();