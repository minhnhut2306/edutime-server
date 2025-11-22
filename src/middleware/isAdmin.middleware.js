const { forbiddenResponse } = require("../helper/createResponse.helper");

/**
 * Middleware kiểm tra quyền admin
 * Phải đặt SAU authMiddleware vì cần req.user
 */
const isAdmin = (req, res, next) => {
  // req.user đã được set từ authMiddleware
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Chưa xác thực người dùng",
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json(
      forbiddenResponse("Bạn không có quyền truy cập chức năng này")
    );
  }

  next();
};

module.exports = isAdmin;