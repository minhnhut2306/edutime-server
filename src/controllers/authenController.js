const authenService = require("../services/authenService");
const asyncHandler = require("../middleware/asyncHandler");
const {
  successResponse,
  badRequestResponse,
  createdResponse,
  unauthorizedResponse  // ✅ QUAN TRỌNG: Phải có dòng này!
} = require("../helper/createResponse.helper");

const extractToken = (req) => req.headers.authorization?.replace("Bearer ", "");

const validateToken = (token, res) => {
  if (!token) {
    res.status(400).json(badRequestResponse("Token không được cung cấp"));
    return false;
  }
  return true;
};

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json(
      badRequestResponse("Email và mật khẩu không được để trống")
    );
  }
  const userAgent = req.headers['user-agent'];
  const ip = req.ip || req.connection.remoteAddress;

  const result = await authenService.login(email, password, userAgent, ip);

  return res.json(
    successResponse("Đăng nhập thành công", {
      user: result.user,
      token: result.token
    })
  );
});

const register = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const newUser = await authenService.register(email, password);

  return res.status(201).json(
    createdResponse("Đăng ký thành công", {
      userId: newUser._id,
      email: newUser.email
    })
  );
});

const logout = asyncHandler(async (req, res) => {
  const token = extractToken(req);
  if (!validateToken(token, res)) return;

  await authenService.logout(token);
  return res.json(successResponse("Đăng xuất thành công"));
});

// ✅ HÀM QUAN TRỌNG - ĐÃ SỬA
const verifyToken = asyncHandler(async (req, res) => {
  const token = extractToken(req);
  if (!validateToken(token, res)) return;

  try {
    const tokenData = await authenService.verifyToken(token);

    return res.json(
      successResponse("Token hợp lệ", {
        userId: tokenData.userId,
        expiresAt: tokenData.expiresAt
      })
    );
  } catch (error) {
    console.error('[verifyToken] Error:', error.message);
    
    // ✅ Nếu error liên quan đến phiên đăng nhập hết hạn, trả 401
    if (error.message.includes("Phiên đăng nhập đã hết hạn")) {
      return res.status(401).json(
        unauthorizedResponse(error.message) // ✅ Giữ nguyên full message
      );
    }
    
    // ✅ Các lỗi khác
    if (error.message.includes("Token đã hết hạn")) {
      return res.status(401).json(unauthorizedResponse("Token đã hết hạn"));
    }
    
    if (error.message.includes("Token không hợp lệ")) {
      return res.status(401).json(unauthorizedResponse("Token không hợp lệ"));
    }
    
    // ✅ Lỗi không xác định
    return res.status(401).json(unauthorizedResponse(error.message || "Xác thực thất bại"));
  }
});

const refreshToken = asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  
  if (!token) {
    return res.status(400).json(badRequestResponse("Token không được cung cấp"));
  }

  const userAgent = req.headers['user-agent'];
  const ip = req.ip || req.connection.remoteAddress;

  const result = await authenService.refreshToken(token, userAgent, ip);

  return res.json(
    successResponse("Làm mới token thành công", { token: result.token })
  );
});

const revokeToken = asyncHandler(async (req, res) => {
  const token = extractToken(req);
  if (!validateToken(token, res)) return;

  await authenService.revokeToken(token);
  return res.json(successResponse("Thu hồi token thành công"));
});

const getProfile = asyncHandler(async (req, res) => {
  const user = await authenService.getUser(req.userId);

  return res.json(
    successResponse("Lấy thông tin người dùng thành công", {
      user: user.toJSON()
    })
  );
});

const getAllUsers = asyncHandler(async (req, res) => {
  const users = await authenService.getAllUsers();

  return res.json(
    successResponse("Lấy danh sách người dùng thành công", {
      users,
      total: users.length
    })
  );
});

const changePassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json(
      badRequestResponse("Mật khẩu mới không được để trống")
    );
  }

  await authenService.changePassword(req.userId, newPassword);
  return res.json(successResponse("Đổi mật khẩu thành công"));
});

const changePasswordWithOld = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json(
      badRequestResponse("Mật khẩu cũ và mật khẩu mới không được để trống")
    );
  }

  await authenService.changePasswordWithOld(req.userId, oldPassword, newPassword);
  return res.json(successResponse("Đổi mật khẩu thành công"));
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json(
      badRequestResponse("Email không được để trống")
    );
  }

  const result = await authenService.sendOTP(email);
  return res.json(successResponse(result.message));
});

const verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json(
      badRequestResponse("Email và OTP không được để trống")
    );
  }

  const result = await authenService.verifyOTP(email, otp);
  return res.json(successResponse(result.message));
});

const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json(
      badRequestResponse("Email, OTP và mật khẩu mới không được để trống")
    );
  }

  const result = await authenService.resetPassword(email, otp, newPassword);
  return res.json(successResponse(result.message));
});

const deleteUser = asyncHandler(async (req, res) => {
  const result = await authenService.deleteUser(req.userId);
  return res.json(successResponse("Xóa tài khoản thành công", result));
});

const updateUserRole = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  if (!role) {
    return res.status(400).json(
      badRequestResponse("Quyền không được để trống")
    );
  }

  const result = await authenService.updateUserRole(userId, role);
  return res.json(successResponse("Cập nhật quyền thành công", result));
});

const deleteUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const result = await authenService.deleteUserById(userId);
  return res.json(successResponse("Xóa người dùng thành công", result));
});

module.exports = {
  login,
  register,
  logout,
  verifyToken,
  refreshToken,
  revokeToken,
  getProfile,
  getAllUsers,
  changePassword,
  changePasswordWithOld,
  forgotPassword,
  verifyOTP,
  resetPassword,
  updateUserRole,
  deleteUserById,
  deleteUser
};