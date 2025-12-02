const User = require("../models/userModel");
const Token = require("../models/tokenModel");
const crypto = require("crypto");
const validator = require("../validations/authen.validation");

const login = async (email, password) => {
    if (!email || !password) {
        throw new Error("Email và mật khẩu là bắt buộc");
    }

    const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : email;
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
        throw new Error("Người dùng không tồn tại");
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
        throw new Error("Mật khẩu không đúng");
    }

    await Token.deleteMany({ userId: user._id });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await Token.create({
        userId: user._id,
        token: token,
        expiresAt: expiresAt,
    });

    return {
        user: user.toJSON(),
        token: token,
    };
};

const register = async (email, password) => {
    if (!email || (typeof email === 'string' && email.trim() === "")) {
        throw new Error("Email là bắt buộc");
    }

    const normalizedEmail = typeof email === 'string' ? email.toLowerCase().trim() : email;

    if (!validator.isEmail(normalizedEmail)) {
        throw new Error("Email không hợp lệ");
    }

    if (!password) {
        throw new Error("Mật khẩu là bắt buộc");
    }

    if (!validator.isValidPassword(password)) {
        throw new Error("Mật khẩu phải có ít nhất 8 ký tự và chứa ký tự đặc biệt");
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
        throw new Error("Người dùng đã tồn tại");
    }

    const newUser = await User.create({
        email: normalizedEmail,
        password,
    });

    return newUser;
};

const logout = async (token) => {
    if (!token) {
        throw new Error("Token là bắt buộc");
    }

    const result = await Token.deleteOne({ token });

    if (result.deletedCount === 0) {
        throw new Error("Token không hợp lệ");
    }

    return { message: "Đăng xuất thành công" };
};

const verifyToken = async (token) => {
    if (!token) {
        throw new Error("Token là bắt buộc");
    }

    const tokenData = await Token.findOne({ token });
    if (!tokenData) {
        throw new Error("Token không hợp lệ");
    }

    if (tokenData.expiresAt && tokenData.expiresAt < new Date()) {
        await Token.deleteOne({ token });
        throw new Error("Token đã hết hạn");
    }

    return tokenData;
};

const refreshToken = async (token) => {
    if (!token) {
        throw new Error("Token là bắt buộc");
    }

    const tokenData = await Token.findOne({ token });
    if (!tokenData) {
        throw new Error("Token không hợp lệ");
    }

    if (tokenData.expiresAt && tokenData.expiresAt < new Date()) {
        await Token.deleteOne({ token });
        throw new Error("Token đã hết hạn");
    }

    const newToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await Token.deleteOne({ token });
    await Token.create({
        userId: tokenData.userId,
        token: newToken,
        expiresAt: expiresAt,
    });

    return { token: newToken };
};

const revokeToken = async (token) => {
    if (!token) {
        throw new Error("Token là bắt buộc");
    }

    const result = await Token.deleteOne({ token });

    if (result.deletedCount === 0) {
        throw new Error("Token không hợp lệ");
    }

    return { message: "Token đã bị thu hồi" };
};

const getUser = async (userId) => {
    if (!userId) {
        throw new Error("User ID là bắt buộc");
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
        throw new Error("Người dùng không tồn tại");
    }

    return user;
};

const getAllUsers = async () => {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    return users;
};

const changePassword = async (userId, newPassword) => {
    if (!userId) {
        throw new Error("User ID là bắt buộc");
    }

    if (!newPassword) {
        throw new Error("Mật khẩu mới là bắt buộc");
    }

    if (!validator.isValidPassword(newPassword)) {
        throw new Error("Mật khẩu phải có ít nhất 8 ký tự và chứa ký tự đặc biệt");
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new Error("Người dùng không tồn tại");
    }

    user.password = newPassword;
    await user.save();

    await Token.deleteMany({ userId: user._id });

    return { message: "Đổi mật khẩu thành công" };
};

const deleteUser = async (userId) => {
    if (!userId) {
        throw new Error("User ID là bắt buộc");
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new Error("Người dùng không tồn tại");
    }

    await Token.deleteMany({ userId: user._id });
    await User.findByIdAndDelete(userId);

    return { message: "Xóa người dùng thành công" };
};

const updateUserRole = async (userId, newRole) => {
    if (!userId) {
        throw new Error("User ID là bắt buộc");
    }

    if (!newRole || !["user", "admin"].includes(newRole)) {
        throw new Error("Role phải là 'user' hoặc 'admin'");
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new Error("Người dùng không tồn tại");
    }

    user.role = newRole;
    await user.save();

    return { message: "Cập nhật quyền thành công", user: user.toJSON() };
};

const deleteUserById = async (userId) => {
    if (!userId) {
        throw new Error("User ID là bắt buộc");
    }

    const user = await User.findById(userId);
    if (!user) {
        throw new Error("Người dùng không tồn tại");
    }

    await Token.deleteMany({ userId: user._id });
    await User.findByIdAndDelete(userId);

    return { message: "Xóa người dùng thành công" };
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