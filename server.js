const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();

// ✅ SỬA CORS NÀY - Thêm options cụ thể
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'], // Các port frontend có thể dùng
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

require("./src/helper/connections_mongdb");

app.use((req, res, next) => {
  console.log('Route:', req.method, req.path);
  console.log('Body:', req.body);
  console.log('Content-Type:', req.headers['content-type']);
  next();
});

app.get("/", (req, res) => {
  res.json({
    message: "Backend đang chạy!",
    timestamp: new Date().toISOString(),
  });
});

const router = require("./src/route/routes");
app.use("/api", router);

app.use((req, res) => {
  res.status(404).json({
    code: 404,
    status: 'error',
    msg: `Route ${req.method} ${req.path} không tồn tại`
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    code: 500,
    status: 'error',
    msg: 'Lỗi server',
    data: { error: err.message }
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server chạy tại http://localhost:${PORT}`);
});