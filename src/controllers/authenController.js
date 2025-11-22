const authenService = require("../services/authenService");
const asyncHandler = require("../middleware/asyncHandler"); // ✅ Import asyncHandler
const {
  successResponse,
  badRequestResponse,
  createdResponse,
  unauthorizedResponse,
  conflictResponse,
  notFoundResponse, // ✅ Thêm import này
  serverErrorResponse,
} = require("../helper/createResponse.helper");

// ✅ Wrap với asyncHandler - code gọn hơn nhiều
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json(badRequestResponse("Email và password không được để trống"));
  }

  const result = await authenService.login(email, password);

  return res.json(
    successResponse("Đăng nhập thành công", {
      user: result.user,
      token: result.token,
    })
  );
});

const register = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const newUser = await authenService.register(email, password);

  return res.status(201).json(
    createdResponse("Đăng ký thành công", {
      userId: newUser._id,
      email: newUser.email,
    })
  );
});

const logout = asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  console.log(
    "🔵 Logout request - Token:",
    token ? token.substring(0, 20) + "..." : "NO TOKEN"
  );
  if (!token) {
    return res
      .status(400)
      .json(badRequestResponse("Token không được cung cấp"));
  }

  await authenService.logout(token);

  return res.json(successResponse("Đăng xuất thành công"));
});

const verifyToken = asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res
      .status(400)
      .json(badRequestResponse("Token không được cung cấp"));
  }

  const tokenData = await authenService.verifyToken(token);

  return res.json(
    successResponse("Token hợp lệ", {
      userId: tokenData.userId,
      expiresAt: tokenData.expiresAt,
    })
  );
});

const refreshToken = asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res
      .status(400)
      .json(badRequestResponse("Token không được cung cấp"));
  }

  const result = await authenService.refreshToken(token);

  return res.json(
    successResponse("Làm mới token thành công", { token: result.token })
  );
});

const revokeToken = asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res
      .status(400)
      .json(badRequestResponse("Token không được cung cấp"));
  }

  await authenService.revokeToken(token);

  return res.json(successResponse("Thu hồi token thành công"));
});

const getProfile = asyncHandler(async (req, res) => {
  const userId = req.userId;

  const user = await authenService.getUser(userId);

  return res.json(
    successResponse("Lấy thông tin người dùng thành công", {
      user: user.toJSON(),
    })
  );
});
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await authenService.getAllUsers();

  return res.json(
    successResponse("Lấy danh sách người dùng thành công", {
      users: users,
      total: users.length,
    })
  );
});

const changePassword = asyncHandler(async (req, res) => {
  const userId = req.userId; // Từ middleware authentication
  const { newPassword } = req.body;

  if (!newPassword) {
    return res
      .status(400)
      .json(badRequestResponse("Mật khẩu mới không được để trống"));
  }

  await authenService.changePassword(userId, newPassword);

  return res.json(successResponse("Đổi mật khẩu thành công"));
});

const deleteUser = asyncHandler(async (req, res) => {
  // ✅ Thống nhất sử dụng req.userId thay vì req.user._id
  const userId = req.userId;

  const result = await authenService.deleteUser(userId);

  return res.json(successResponse("Xóa tài khoản thành công", result));
});

const updateUserRole = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  if (!role) {
    return res.status(400).json(badRequestResponse("Role không được để trống"));
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
  updateUserRole,
  deleteUserById,
  deleteUser,
};
