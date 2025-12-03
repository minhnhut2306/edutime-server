const authenService = require("../services/authenService");
const { unauthorizedResponse } = require("../helper/createResponse.helper");
const User = require("../models/userModel");

const ERROR_MESSAGES = {
  "Invalid token": "Token không hợp lệ",
  "Token expired": "Token đã hết hạn",
  "Token is required": "Token không hợp lệ"
};

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json(
        unauthorizedResponse("Token không được cung cấp hoặc không đúng định dạng")
      );
    }

    const token = authHeader.substring(7);
    const tokenData = await authenService.verifyToken(token);
    
    if (!tokenData?.userId) {
      return res.status(401).json(unauthorizedResponse("Token không hợp lệ"));
    }

    const user = await User.findById(tokenData.userId).select("-password");
    if (!user) {
      return res.status(401).json(unauthorizedResponse("Người dùng không tồn tại"));
    }

    req.user = user.toObject ? user.toObject() : user;
    req.userId = req.user._id || req.user.id;
    req.token = token;

    next();
  } catch (error) {
    const msg = ERROR_MESSAGES[error.message] || "Xác thực thất bại";
    return res.status(401).json(unauthorizedResponse(msg));
  }
};

module.exports = authMiddleware;