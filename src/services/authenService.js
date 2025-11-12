// authenservices


const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const Token = require("../models/tokenModel");
const crypto = require("crypto");
const validator = require("../validations/authen.validation")


const login = async (email, password) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error("User not found");
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new Error("Invalid password");
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
    if (!email || email.trim() === '') {
        throw new Error("Email is required");
    }
    
    if (!validator.isEmail(email)) {
        throw new Error("Invalid email format");
    }

    if (!password) {
        throw new Error("Password is required");
    }
    
    if (!validator.isValidPassword(password)) {
        throw new Error("Password must be at least 8 characters and contain special characters");
    }
    
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (user) {
        throw new Error("User already exists");
    }

    const newUser = await User.create({
        email: email.toLowerCase().trim(),
        password,
    });

    return newUser;
};

const logout = async (token) => {
  await Token.deleteOne({ token });
  return { message: "Logout successful" };
};

const verifyToken = async (token) => {
  const tokenData = await Token.findOne({ token });
  if (!tokenData) {
    throw new Error("Invalid token");
  }

  if (tokenData.expiresAt && tokenData.expiresAt < new Date()) {
    await Token.deleteOne({ token });
    throw new Error("Token expired");
  }

  return tokenData;
};

const refreshToken = async (token) => {
  const tokenData = await Token.findOne({ token });
  if (!tokenData) {
    throw new Error("Invalid token");
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
  await Token.deleteOne({ token });
  return { message: "Token revoked" };
};

const getUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }
  return user;
};

const changePassword = async (userId, newPassword) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error("User not found");
    }
    
    user.password = newPassword;
    await user.save();
    
    await Token.deleteMany({ userId: user._id });
    
    return { message: "Password changed successfully" };
};

const deleteUser = async (userId) => {
  // Kiểm tra user tồn tại
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // Xóa tất cả token của user
  await Token.deleteMany({ userId: user._id });

  // Xóa user
  await User.findByIdAndDelete(userId);

  return { message: "User deleted successfully" };
};


module.exports = {
  login,
  register,
  logout,
  verifyToken,
  refreshToken,
  revokeToken,
  getUser,
  changePassword,
  deleteUser,
};
