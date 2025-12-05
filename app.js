const express = require("express");
const corsConfig = require("./src/config/cors");

require("dotenv").config();
require("./src/helper/connections_mongdb");

const app = express();

app.use(corsConfig);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log("Route:", req.method, req.path);
  next();
});

app.get("/", (req, res) => {
  res.json({ message: "Backend đang chạy!" });
});


app.use("/api", require("./src/route/routes"));

app.use((req, res) => {
  res.status(404).json({
    code: 404,
    status: "error",
    msg: `Route ${req.method} ${req.path} không tồn tại`,
  });
});

app.use((err, req, res, next) => {
  res.status(500).json({
    code: 500,
    status: "error",
    msg: "Lỗi server",
    data: { error: err.message },
  });
});

module.exports = app;
