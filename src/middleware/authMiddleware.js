// middleware/authMiddleware.js
const authenService = require("../services/authenService");
const { unauthorizedResponse } = require("../helper/createResponse.helper");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json(unauthorizedResponse("Token không được cung cấp hoặc không đúng định dạng"));
    }

    const token = authHeader.replace("Bearer ", "");

    const tokenData = await authenService.verifyToken(token);

    // Gắn userId vào request để sử dụng ở các controller
    req.userId = tokenData.userId;
    req.token = token;

    next();
  } catch (error) {
    if (error.message === "Invalid token") {
      return res.status(401).json(unauthorizedResponse("Token không hợp lệ"));
    }
    if (error.message === "Token expired") {
      return res.status(401).json(unauthorizedResponse("Token đã hết hạn"));
    }
    return res
      .status(401)
      .json(unauthorizedResponse("Xác thực thất bại", { error: error.message }));
  }
};

module.exports = authMiddleware;