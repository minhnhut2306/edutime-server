const authenService = require("../services/authenService");
const asyncHandler = require("../middleware/asyncHandler");
const {
  successResponse,
  badRequestResponse,
  createdResponse
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

  const result = await authenService.login(email, password);

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

const verifyToken = asyncHandler(async (req, res) => {
  const token = extractToken(req);
  if (!validateToken(token, res)) return;

  const tokenData = await authenService.verifyToken(token);

  return res.json(
    successResponse("Token hợp lệ", {
      userId: tokenData.userId,
      expiresAt: tokenData.expiresAt
    })
  );
});

const refreshToken = asyncHandler(async (req, res) => {
  const token = extractToken(req);
  if (!validateToken(token, res)) return;

  const result = await authenService.refreshToken(token);

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
  updateUserRole,
  deleteUserById,
  deleteUser
};