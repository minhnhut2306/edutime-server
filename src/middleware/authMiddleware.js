const authenService = require("../services/authenService");
const { unauthorizedResponse } = require("../helper/createResponse.helper");
const User = require("../models/userModel");

/**
 * Auth middleware for token stored in DB (Token model).
 * - authenService.verifyToken(token) returns the Token document { userId, token, expiresAt, ... }
 * - We then load the full User by userId and attach req.user so controllers can access req.user.role, email, ...
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json(unauthorizedResponse("Token không được cung cấp hoặc không đúng định dạng"));
    }

    const token = authHeader.substring(7);

    // verifyToken returns Token document (or throws)
    const tokenData = await authenService.verifyToken(token);
    if (!tokenData || !tokenData.userId) {
      return res.status(401).json(unauthorizedResponse("Token không hợp lệ"));
    }

    // Load full user so controllers can use req.user.role, req.user.email, ...
    const user = await User.findById(tokenData.userId).select("-password");
    if (!user) {
      // optional: revoke token if user deleted?
      // await authenService.revokeToken(token); // uncomment if you want to remove orphan tokens
      return res.status(401).json(unauthorizedResponse("Người dùng không tồn tại"));
    }

    // Attach user and convenience fields
    req.user = user.toObject ? user.toObject() : user;
    req.userId = req.user._id || req.user.id;
    req.token = token;

    console.log("AUTH DEBUG - attached req.user:", { userId: req.userId, role: req.user.role, email: req.user.email });

    next();
  } catch (error) {
    console.error("AUTH ERROR:", error && error.message ? error.message : error);
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