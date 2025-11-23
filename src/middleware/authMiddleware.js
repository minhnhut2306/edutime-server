const authenService = require("../services/authenService");
const { unauthorizedResponse } = require("../helper/createResponse.helper");
const User = require("../models/userModel");

/**
 * Auth middleware for token stored in DB (Token model).
 */
const authMiddleware = async (req, res, next) => {
  try {
    // ✅ DEBUG: Log headers
    console.log("🔐 authMiddleware - Headers:", {
      authorization: req.headers.authorization ? "EXISTS" : "MISSING",
      contentType: req.headers['content-type']
    });

    const authHeader = req.headers.authorization;
    
    // ✅ Kiểm tra header
    if (!authHeader) {
      console.error("❌ No Authorization header");
      return res.status(401).json(
        unauthorizedResponse("Token không được cung cấp hoặc không đúng định dạng")
      );
    }

    if (!authHeader.startsWith("Bearer ")) {
      console.error("❌ Invalid Authorization format:", authHeader.substring(0, 20));
      return res.status(401).json(
        unauthorizedResponse("Token không được cung cấp hoặc không đúng định dạng")
      );
    }

    const token = authHeader.substring(7);

    // ✅ DEBUG: Token info
    console.log("🔑 Token extracted:", token.substring(0, 20) + "...");

    // Verify token
    const tokenData = await authenService.verifyToken(token);
    if (!tokenData || !tokenData.userId) {
      console.error("❌ Invalid token data");
      return res.status(401).json(unauthorizedResponse("Token không hợp lệ"));
    }

    console.log("✅ Token valid, userId:", tokenData.userId);

    // Load full user
    const user = await User.findById(tokenData.userId).select("-password");
    if (!user) {
      console.error("❌ User not found:", tokenData.userId);
      return res.status(401).json(unauthorizedResponse("Người dùng không tồn tại"));
    }

    console.log("✅ User found:", user.email);

    // Attach user
    req.user = user.toObject ? user.toObject() : user;
    req.userId = req.user._id || req.user.id;
    req.token = token;

    console.log("✅ Auth successful:", { userId: req.userId, role: req.user.role, email: req.user.email });

    next();
  } catch (error) {
    console.error("❌ AUTH ERROR:", error.message);
    const map = {
      "Invalid token": "Token không hợp lệ",
      "Token expired": "Token đã hết hạn",
      "Token is required": "Token không hợp lệ",
    };
    const msg = map[error.message] || "Xác thực thất bại";
    return res.status(401).json(unauthorizedResponse(msg));
  }
};

module.exports = authMiddleware;