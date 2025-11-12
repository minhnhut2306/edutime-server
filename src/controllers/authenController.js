// authenController.js
const authenService = require("../services/authenService");
const {
  successResponse,
  errorResponse,
  createdResponse,
  unauthorizedResponse,
  badRequestResponse,
  conflictResponse,
  serverErrorResponse,
} = require("../helper/createResponse.helper");

const login = async (req, res) => {
  try {
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
  } catch (error) {
    if (error.message === "User not found") {
      return res
        .status(401)
        .json(unauthorizedResponse("Email không tồn tại"));
    }
    if (error.message === "Invalid password") {
      return res.status(401).json(unauthorizedResponse("Mật khẩu không đúng"));
    }
    return res
      .status(500)
      .json(serverErrorResponse("Lỗi đăng nhập", { error: error.message }));
  }
};

const register = async (req, res) => {
  try {
    const { email, password } = req.body;

    const newUser = await authenService.register(email, password);

    return res
      .status(201)
      .json(
        createdResponse("Đăng ký thành công", { userId: newUser._id, email: newUser.email })
      );
  } catch (error) {
    if (error.message === "User already exists") {
      return res.status(409).json(conflictResponse("Email đã tồn tại"));
    }
    if (
      error.message.includes("Email") ||
      error.message.includes("Password")
    ) {
      return res.status(400).json(badRequestResponse(error.message));
    }
    return res
      .status(500)
      .json(serverErrorResponse("Lỗi đăng ký", { error: error.message }));
  }
};

const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res
        .status(400)
        .json(badRequestResponse("Token không được cung cấp"));
    }

    await authenService.logout(token);

    return res.json(successResponse("Đăng xuất thành công"));
  } catch (error) {
    return res
      .status(500)
      .json(serverErrorResponse("Lỗi đăng xuất", { error: error.message }));
  }
};

const verifyToken = async (req, res) => {
  try {
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
  } catch (error) {
    if (error.message === "Invalid token" || error.message === "Token expired") {
      return res.status(401).json(unauthorizedResponse(error.message === "Token expired" ? "Token đã hết hạn" : "Token không hợp lệ"));
    }
    return res
      .status(500)
      .json(
        serverErrorResponse("Lỗi xác thực token", { error: error.message })
      );
  }
};

const refreshToken = async (req, res) => {
  try {
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
  } catch (error) {
    if (error.message === "Invalid token") {
      return res.status(401).json(unauthorizedResponse("Token không hợp lệ"));
    }
    return res
      .status(500)
      .json(
        serverErrorResponse("Lỗi làm mới token", { error: error.message })
      );
  }
};

const revokeToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res
        .status(400)
        .json(badRequestResponse("Token không được cung cấp"));
    }

    await authenService.revokeToken(token);

    return res.json(successResponse("Thu hồi token thành công"));
  } catch (error) {
    return res
      .status(500)
      .json(
        serverErrorResponse("Lỗi thu hồi token", { error: error.message })
      );
  }
};

const getProfile = async (req, res) => {
  try {
    const userId = req.userId; // Từ middleware authentication

    const user = await authenService.getUser(userId);

    return res.json(
      successResponse("Lấy thông tin người dùng thành công", {
        user: user.toJSON(),
      })
    );
  } catch (error) {
    if (error.message === "User not found") {
      return res.status(404).json(notFoundResponse("Người dùng không tồn tại"));
    }
    return res
      .status(500)
      .json(
        serverErrorResponse("Lỗi lấy thông tin người dùng", {
          error: error.message,
        })
      );
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.userId; // Từ middleware authentication
    const { newPassword } = req.body;

    if (!newPassword) {
      return res
        .status(400)
        .json(badRequestResponse("Mật khẩu mới không được để trống"));
    }

    await authenService.changePassword(userId, newPassword);

    return res.json(successResponse("Đổi mật khẩu thành công"));
  } catch (error) {
    if (error.message === "User not found") {
      return res.status(404).json(notFoundResponse("Người dùng không tồn tại"));
    }
    if (error.message.includes("Password")) {
      return res.status(400).json(badRequestResponse(error.message));
    }
    return res
      .status(500)
      .json(
        serverErrorResponse("Lỗi đổi mật khẩu", { error: error.message })
      );
  }
};


const deleteUser = async (req, res) => {
  try {
    const userId = req.user._id; 

    const result = await authenService.deleteUser(userId);
    
    return res.json(
      successResponse("Xóa tài khoản thành công", result)
    );
  } catch (error) {
    if (error.message === "User not found") {
      return res
        .status(404)
        .json(notFoundResponse("Người dùng không tồn tại"));
    }
    return res
      .status(500)
      .json(serverErrorResponse("Lỗi xóa tài khoản", { error: error.message }));
  }
};


module.exports = {
  login,
  register,
  logout,
  verifyToken,
  refreshToken,
  revokeToken,
  getProfile,
  changePassword,
  deleteUser
};