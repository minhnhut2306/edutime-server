const cors = require("cors");

module.exports = cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "https://edutime-edu.vercel.app"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});
