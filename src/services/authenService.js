const User = require("../models/userModel");
const Token = require("../models/tokenModel");
const OTP = require("../models/otpModel");
const crypto = require("crypto");
const validator = require("../validations/authen.validation");
const Teacher = require("../models/teacherModel");
const {
  sendOTPEmail,
  sendPasswordChangeNotification,
} = require("../utils/emailService");

// ✅ Import từ deviceParser
const { parseDeviceInfo, getDeviceDescription } = require('../utils/deviceParser');

const TOKEN_EXPIRY_DAYS = 7;
const OTP_EXPIRY_MINUTES = 10;

const normalizeEmail = (email) => email?.toLowerCase().trim();

const generateToken = () => ({
  token: crypto.randomBytes(32).toString("hex"),
  expiresAt: new Date(Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
});

// ❌ XÓA function parseDeviceInfo cũ (dòng 37-48) - Dùng từ deviceParser thay thế

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const createTokenRecord = async (userId, deviceInfo) => {
  // ✅ Đảm bảo deviceInfo có đủ thông tin
  if (!deviceInfo || !deviceInfo.browser) {
    console.warn('⚠️ deviceInfo không đầy đủ:', deviceInfo);
    deviceInfo = {
      browser: 'Unknown',
      os: 'Unknown',
      device: 'Unknown',
      userAgent: 'Unknown',
      ip: 'Unknown',
      fingerprint: 'unknown'
    };
  }

  const deactivatedTokens = await Token.updateMany(
    { userId, isActive: true },
    {
      $set: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: "login_from_another_device",
      },
    }
  );

  if (deactivatedTokens.modifiedCount > 0) {
    console.log(
      `Vô hiệu hóa ${deactivatedTokens.modifiedCount} token cũ của user ${userId}`
    );
  }

  const { token, expiresAt } = generateToken();

  const newToken = await Token.create({
    userId,
    token,
    expiresAt,
    deviceInfo,
    isActive: true,
  });

  // ✅ SAFE substring với optional chaining
  const fingerprintPreview = deviceInfo.fingerprint 
    ? deviceInfo.fingerprint.substring(0, 8) 
    : 'N/A';
  
  console.log(
    `Token mới được tạo cho ${deviceInfo.browser} trên ${deviceInfo.os} (${fingerprintPreview}...)`
  );

  return token;
};

const validateToken = async (token) => {
  if (!token) throw new Error("Token là bắt buộc");

  const tokenData = await Token.findOne({ token });

  if (!tokenData) throw new Error("Token không hợp lệ");

  if (!tokenData.isActive) {
    // ✅ Sử dụng getDeviceDescription đã import
    const deviceDesc = tokenData.deviceInfo
      ? getDeviceDescription(tokenData.deviceInfo)
      : "thiết bị không xác định";

    throw new Error(
      `Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại. ` +
      `Tài khoản đã được đăng nhập từ ${deviceDesc}.`
    );
  }

  if (tokenData.expiresAt < new Date()) {
    await Token.deleteOne({ token });
    throw new Error("Token đã hết hạn");
  }

  return tokenData;
};

const login = async (email, password, userAgent, ip) => {
  if (!email || !password) {
    throw new Error("Email và mật khẩu là bắt buộc");
  }

  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) throw new Error("Người dùng không tồn tại");

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) throw new Error("Mật khẩu không đúng");

  // ✅ Sử dụng parseDeviceInfo từ deviceParser (có fingerprint)
  const deviceInfo = parseDeviceInfo(userAgent, ip);

  // ✅ SAFE substring với optional chaining
  const fingerprintPreview = deviceInfo.fingerprint 
    ? deviceInfo.fingerprint.substring(0, 8) 
    : 'N/A';

  console.log(
    `User ${email} đăng nhập từ ${deviceInfo.browser} (${fingerprintPreview}...)`
  );

  const token = await createTokenRecord(user._id, deviceInfo);

  return {
    user: user.toJSON(),
    token,
    deviceInfo: {
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      device: deviceInfo.device,
    },
  };
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

const refreshToken = async (token, userAgent, ip) => {
  const tokenData = await validateToken(token);

  await Token.updateOne(
    { token },
    {
      isActive: false,
      deactivatedAt: new Date(),
      deactivatedBy: "token_refresh",
    }
  );

  const deviceInfo = parseDeviceInfo(userAgent, ip);
  const newToken = await createTokenRecord(tokenData.userId, deviceInfo);

  return { token: newToken };
};

const getUserTokens = async (userId) => {
  const tokens = await Token.find({ userId })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('deviceInfo isActive createdAt deactivatedAt deactivatedBy');
  
  return tokens.map(t => ({
    browser: t.deviceInfo?.browser,
    os: t.deviceInfo?.os,
    device: t.deviceInfo?.device,
    ip: t.deviceInfo?.ip,
    isActive: t.isActive,
    loginAt: t.createdAt,
    logoutAt: t.deactivatedAt,
    logoutReason: t.deactivatedBy,
  }));
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

  try {
    await sendPasswordChangeNotification(user.email);
  } catch (emailError) {
    console.warn("Không thể gửi email thông báo:", emailError.message);
  }

  return { message: "Đổi mật khẩu thành công" };
};

const changePasswordWithOld = async (userId, oldPassword, newPassword) => {
  if (!userId) throw new Error("ID người dùng là bắt buộc");
  if (!oldPassword) throw new Error("Mật khẩu cũ là bắt buộc");
  if (!newPassword) throw new Error("Mật khẩu mới là bắt buộc");

  if (!validator.isValidPassword(newPassword)) {
    throw new Error("Mật khẩu phải có ít nhất 8 ký tự và chứa ký tự đặc biệt");
  }

  const user = await User.findById(userId);
  if (!user) throw new Error("Người dùng không tồn tại");

  const isPasswordValid = await user.comparePassword(oldPassword);
  if (!isPasswordValid) throw new Error("Mật khẩu cũ không đúng");

  const isSamePassword = await user.comparePassword(newPassword);
  if (isSamePassword) throw new Error("Mật khẩu mới phải khác mật khẩu cũ");

  user.password = newPassword;
  await user.save();
  await Token.deleteMany({ userId: user._id });

  try {
    await sendPasswordChangeNotification(user.email);
  } catch (emailError) {
    console.warn("Không thể gửi email thông báo:", emailError.message);
  }

  return { message: "Đổi mật khẩu thành công" };
};

const sendOTP = async (email) => {
  if (!email) throw new Error("Email là bắt buộc");

  const normalizedEmail = normalizeEmail(email);

  if (!validator.isEmail(normalizedEmail)) {
    throw new Error("Định dạng email không hợp lệ");
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) throw new Error("Email không tồn tại trong hệ thống");

  await OTP.deleteMany({ email: normalizedEmail });

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await OTP.create({
    email: normalizedEmail,
    otp,
    expiresAt,
  });

  try {
    await sendOTPEmail(normalizedEmail, otp);
  } catch (emailError) {
    console.error("Lỗi gửi email OTP:", emailError.message);
    throw new Error(
      "Không thể gửi email. Vui lòng kiểm tra cấu hình email trong .env"
    );
  }

  return { message: "Mã OTP đã được gửi đến email của bạn" };
};

const verifyOTP = async (email, otp) => {
  if (!email || !otp) throw new Error("Email và OTP là bắt buộc");

  const normalizedEmail = normalizeEmail(email);

  const otpRecord = await OTP.findOne({
    email: normalizedEmail,
    otp,
    verified: false,
  });

  if (!otpRecord) throw new Error("Mã OTP không đúng");

  if (otpRecord.expiresAt < new Date()) {
    await OTP.deleteOne({ _id: otpRecord._id });
    throw new Error("Mã OTP đã hết hạn");
  }

  otpRecord.verified = true;
  await otpRecord.save();

  return { message: "Xác thực OTP thành công" };
};

const resetPassword = async (email, otp, newPassword) => {
  if (!email || !otp || !newPassword) {
    throw new Error("Email, OTP và mật khẩu mới là bắt buộc");
  }

  const normalizedEmail = normalizeEmail(email);

  if (!validator.isValidPassword(newPassword)) {
    throw new Error("Mật khẩu phải có ít nhất 8 ký tự và chứa ký tự đặc biệt");
  }

  const otpRecord = await OTP.findOne({
    email: normalizedEmail,
    otp,
    verified: true,
  });

  if (!otpRecord) {
    throw new Error("OTP chưa được xác thực hoặc không hợp lệ");
  }

  if (otpRecord.expiresAt < new Date()) {
    await OTP.deleteOne({ _id: otpRecord._id });
    throw new Error("Mã OTP đã hết hạn");
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) throw new Error("Người dùng không tồn tại");

  user.password = newPassword;
  await user.save();

  await Token.deleteMany({ userId: user._id });

  await OTP.deleteMany({ email: normalizedEmail });

  try {
    await sendPasswordChangeNotification(user.email);
  } catch (emailError) {
    console.warn("Không thể gửi email thông báo:", emailError.message);
  }

  return { message: "Đặt lại mật khẩu thành công" };
};

const deleteUser = async (userId) => {
  if (!userId) throw new Error("ID người dùng là bắt buộc");

  const user = await User.findById(userId);
  if (!user) throw new Error("Người dùng không tồn tại");

  const teacherCount = await Teacher.countDocuments({ userId: userId });
  if (teacherCount > 0) {
    throw new Error(
      `Không thể xóa tài khoản "${user.email}" vì đang được liên kết với ${teacherCount} giáo viên. Vui lòng bỏ liên kết giáo viên trước.`
    );
  }

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
  changePasswordWithOld,
  deleteUser,
  sendOTP,
  verifyOTP,
  resetPassword,
  validateToken,
  getUserTokens,
};