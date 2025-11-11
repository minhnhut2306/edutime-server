const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Route test
app.get('/', (req, res) => {
  res.json({ message: 'Backend đang chạy!' });
});

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log(' Kết nối MongoDB thành công!'))
  .catch(err => console.log(' Lỗi:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(` Server chạy tại http://localhost:${PORT}`);
});