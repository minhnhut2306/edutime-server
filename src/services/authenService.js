const User = require("../models/userModel");
const Token = require("../models/tokenModel");
const crypto = require("crypto");
const validator = require("../validations/authen.validation");

const TOKEN_EXPIRY_DAYS = 7;

const normalizeEmail = (email) => email?.toLowerCase().trim();

const generateToken = () => ({
  token: crypto.randomBytes(32).toString("hex"),
  expiresAt: new Date(Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
});

const createTokenRecord = async (userId) => {
  await Token.deleteMany({ userId });
  const { token, expiresAt } = generateToken();
  await Token.create({ userId, token, expiresAt });
  return token;
};

const validateToken = async (token) => {
  if (!token) throw new Error("Token là bắt buộc");

  const tokenData = await Token.findOne({ token });
  if (!tokenData) throw new Error("Token không hợp lệ");

  if (tokenData.expiresAt < new Date()) {
    await Token.deleteOne({ token });
    throw new Error("Token đã hết hạn");
  }

  return tokenData;
};

const login = async (email, password) => {
  if (!email || !password) {
    throw new Error("Email và mật khẩu là bắt buộc");
  }

  const user = await User.findOne({ email: normalizeEmail(email) });
  if (!user) throw new Error("Người dùng không tồn tại");

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) throw new Error("Mật khẩu không đúng");

  const token = await createTokenRecord(user._id);

  return { user: user.toJSON(), token };
};

const register = async (email, password) => {
  if (!email?.trim()) throw new Error("Email là bắt buộc");

  const normalizedEmail = normalizeEmail(email);

  if (!validator.isEmail(normalizedEmail)) {
    throw new Error("Định dạng email không hợp lệ");
  }

  if (!password) throw new Error("Mật khẩu là bắt buộc");

  if (!validator.isValidPassword(password)) {
    throw new Error("Mật khẩu phải có ít nhất 8 ký tự và chứa ký tự đặc biệt");
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) throw new Error("Người dùng đã tồn tại");

  return await User.create({ email: normalizedEmail, password });
};

const logout = async (token) => {
  if (!token) throw new Error("Token là bắt buộc");

  const result = await Token.deleteOne({ token });
  if (result.deletedCount === 0) throw new Error("Token không hợp lệ");

  return { message: "Đăng xuất thành công" };
};

const verifyToken = async (token) => {
  return await validateToken(token);
};

const refreshToken = async (token) => {
  const tokenData = await validateToken(token);
  
  await Token.deleteOne({ token });
  const newToken = await createTokenRecord(tokenData.userId);

  return { token: newToken };
};

const revokeToken = async (token) => {
  if (!token) throw new Error("Token là bắt buộc");

  const result = await Token.deleteOne({ token });
  if (result.deletedCount === 0) throw new Error("Token không hợp lệ");

  return { message: "Thu hồi token thành công" };
};

const getUser = async (userId) => {
  if (!userId) throw new Error("ID người dùng là bắt buộc");

  const user = await User.findById(userId).select("-password");
  if (!user) throw new Error("Người dùng không tồn tại");

  return user;
};

const getAllUsers = async () => {
  return await User.find().select("-password").sort({ createdAt: -1 });
};

const changePassword = async (userId, newPassword) => {
  if (!userId) throw new Error("ID người dùng là bắt buộc");
  if (!newPassword) throw new Error("Mật khẩu mới là bắt buộc");

  if (!validator.isValidPassword(newPassword)) {
    throw new Error("Mật khẩu phải có ít nhất 8 ký tự và chứa ký tự đặc biệt");
  }

  const user = await User.findById(userId);
  if (!user) throw new Error("Người dùng không tồn tại");

  user.password = newPassword;
  await user.save();
  await Token.deleteMany({ userId: user._id });

  return { message: "Đổi mật khẩu thành công" };
};

const deleteUser = async (userId) => {
  if (!userId) throw new Error("ID người dùng là bắt buộc");

  const user = await User.findById(userId);
  if (!user) throw new Error("Người dùng không tồn tại");

  await Token.deleteMany({ userId: user._id });
  await User.findByIdAndDelete(userId);

  return { message: "Xóa người dùng thành công" };
};

const updateUserRole = async (userId, newRole) => {
  if (!userId) throw new Error("ID người dùng là bắt buộc");

  if (!newRole || !["user", "admin"].includes(newRole)) {
    throw new Error("Quyền phải là 'user' hoặc 'admin'");
  }

  const user = await User.findById(userId);
  if (!user) throw new Error("Người dùng không tồn tại");

  user.role = newRole;
  await user.save();

  return { message: "Cập nhật quyền thành công", user: user.toJSON() };
};

const deleteUserById = async (userId) => {
  return await deleteUser(userId);
};

module.exports = {
  login,
  register,
  logout,
  verifyToken,
  refreshToken,
  revokeToken,
  getUser,
  getAllUsers,
  updateUserRole,
  deleteUserById, 
  changePassword,
  deleteUser
};