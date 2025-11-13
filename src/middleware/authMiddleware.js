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

    const token = authHeader.substring(7);

    const tokenData = await authenService.verifyToken(token);

    req.userId = tokenData.userId;
    req.token = token;

    next();
  } catch (error) {
    const errorMessages = {
      "Invalid token": "Token không hợp lệ",
      "Token expired": "Token đã hết hạn"
    };

    const message = errorMessages[error.message] || "Xác thực thất bại";
    
    return res
      .status(401)
      .json(unauthorizedResponse(message, error.message === "Xác thực thất bại" ? { error: error.message } : undefined));
  }
};

module.exports = authMiddleware;