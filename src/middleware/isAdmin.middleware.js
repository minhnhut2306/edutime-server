const { forbiddenResponse, unauthorizedResponse } = require("../helper/createResponse.helper");

const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json(
      unauthorizedResponse("Chưa xác thực người dùng")
    );
  }

  if (req.user.role !== "admin") {
    return res.status(403).json(
      forbiddenResponse("Bạn không có quyền truy cập chức năng này")
    );
  }

  next();
};

module.exports = isAdmin;