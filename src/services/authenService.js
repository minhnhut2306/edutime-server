const User = require("../models/userModel");
const Token = require("../models/tokenModel");
const crypto = require("crypto");
const validator = require("../validations/authen.validation");

const login = async (email, password) => {
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
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
  if (!email || email.trim() === "") {
    throw new Error("Email is required");
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (!validator.isEmail(normalizedEmail)) {
    throw new Error("Invalid email format");
  }

  if (!password) {
    throw new Error("Password is required");
  }

  if (!validator.isValidPassword(password)) {
    throw new Error("Password must be at least 8 characters and contain special characters");
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new Error("User already exists");
  }

  const newUser = await User.create({
    email: normalizedEmail,
    password,
  });

  return newUser;
};

const logout = async (token) => {
  if (!token) {
    throw new Error("Token is required");
  }

  const result = await Token.deleteOne({ token });
  
  if (result.deletedCount === 0) {
    throw new Error("Invalid token");
  }

  return { message: "Logout successful" };
};

const verifyToken = async (token) => {
  if (!token) {
    throw new Error("Token is required");
  }

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
  if (!token) {
    throw new Error("Token is required");
  }

  const tokenData = await Token.findOne({ token });
  if (!tokenData) {
    throw new Error("Invalid token");
  }

  if (tokenData.expiresAt && tokenData.expiresAt < new Date()) {
    await Token.deleteOne({ token });
    throw new Error("Token expired");
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
    throw new Error("Token is required");
  }

  const result = await Token.deleteOne({ token });
  
  if (result.deletedCount === 0) {
    throw new Error("Invalid token");
  }

  return { message: "Token revoked" };
};

const getUser = async (userId) => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const user = await User.findById(userId).select("-password");
  if (!user) {
    throw new Error("User not found");
  }

  return user;
};

const changePassword = async (userId, newPassword) => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  if (!newPassword) {
    throw new Error("New password is required");
  }

  if (!validator.isValidPassword(newPassword)) {
    throw new Error("Password must be at least 8 characters and contain special characters");
  }

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
  if (!userId) {
    throw new Error("User ID is required");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  await Token.deleteMany({ userId: user._id });
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