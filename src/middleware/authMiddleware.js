const authenService = require("../services/authenService");
const { unauthorizedResponse } = require("../helper/createResponse.helper");
const User = require("../models/userModel");

const ERROR_MESSAGES = {
  "Invalid token": "Token không hợp lệ",
  "Token expired": "Token đã hết hạn",
  "Token is required": "Token không hợp lệ",
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
  
    const tokenData = await authenService.validateToken(token);
    
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
    console.error('[authMiddleware] Error:', error.message);
    
    // ✅ Nếu error message chứa "Phiên đăng nhập đã hết hạn", GIỮ NGUYÊN message gốc
    if (error.message.includes("Phiên đăng nhập đã hết hạn")) {
      return res.status(401).json(
        unauthorizedResponse(error.message) // ✅ Trả về FULL message từ validateToken
      );
    }
    
    // ✅ Các lỗi khác thì dùng ERROR_MESSAGES hoặc message gốc
    const msg = ERROR_MESSAGES[error.message] || error.message || "Xác thực thất bại";
    
    return res.status(401).json(unauthorizedResponse(msg));
  }
};

module.exports = authMiddleware;