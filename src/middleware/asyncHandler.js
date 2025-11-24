const { 
  badRequestResponse, 
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,  
  conflictResponse,
  serverErrorResponse,
  STATUS_CODES 
} = require('../helper/createResponse.helper');

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      console.error('AsyncHandler Error:', error);
      

      if (res.headersSent) {
        return next(error);
      }

      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(STATUS_CODES.BAD_REQUEST).json(
          badRequestResponse('Dữ liệu không hợp lệ', { errors })
        );
      }

      if (error.name === 'CastError') {
        return res.status(STATUS_CODES.BAD_REQUEST).json(
          badRequestResponse(`ID không hợp lệ: ${error.value}`)
        );
      }

      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern || {})[0];
        const value = error.keyValue?.[field];
        return res.status(STATUS_CODES.CONFLICT).json(
          conflictResponse(
            `${field} "${value}" đã tồn tại trong hệ thống`,
            { field, value }
          )
        );
      }

      if (error.name === 'JsonWebTokenError') {
        return res.status(STATUS_CODES.UNAUTHORIZED).json(
          unauthorizedResponse('Token không hợp lệ')
        );
      }

      if (error.name === 'TokenExpiredError') {
        return res.status(STATUS_CODES.UNAUTHORIZED).json(
          unauthorizedResponse('Token đã hết hạn')
        );
      }

      if (error.message === "User not found") {
        return res.status(STATUS_CODES.NOT_FOUND).json(
          notFoundResponse("Người dùng không tồn tại")
        );
      }

      if (error.message === "Class not found") {
        return res.status(STATUS_CODES.NOT_FOUND).json(
          notFoundResponse("Không tìm thấy lớp học")
        );
      }

      if (error.message === "Invalid password") {
        return res.status(STATUS_CODES.UNAUTHORIZED).json(
          unauthorizedResponse("Mật khẩu không đúng")
        );
      }

      if (error.message === "User already exists") {
        return res.status(STATUS_CODES.CONFLICT).json(
          conflictResponse("Email đã tồn tại")
        );
      }

      if (error.message === "Class name already exists") {
        return res.status(STATUS_CODES.CONFLICT).json(
          conflictResponse("Tên lớp đã tồn tại")
        );
      }

      if (error.message === "Invalid token") {
        return res.status(STATUS_CODES.UNAUTHORIZED).json(
          unauthorizedResponse("Token không hợp lệ")
        );
      }

      if (error.message === "Token expired") {
        return res.status(STATUS_CODES.UNAUTHORIZED).json(
          unauthorizedResponse("Token đã hết hạn")
        );
      }

      if (error.message === "Forbidden" || error.message === "Access denied") {
        return res.status(STATUS_CODES.FORBIDDEN).json(
          forbiddenResponse("Bạn không có quyền truy cập")
        );
      }


      if (error.message.includes("Email") || error.message.includes("Password")) {
        return res.status(STATUS_CODES.BAD_REQUEST).json(
          badRequestResponse(error.message)
        );
      }

      if (error.message === "Excel file is empty" || error.message === "No file uploaded") {
        return res.status(STATUS_CODES.BAD_REQUEST).json(
          badRequestResponse(error.message === "Excel file is empty" ? "File Excel trống" : "Vui lòng tải lên file Excel")
        );
      }
      const statusCode = error.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR;
      const message = error.message || 'Có lỗi xảy ra trên server';

      const response = serverErrorResponse(message, {
        ...(process.env.NODE_ENV === 'development' && { 
          stack: error.stack,
          name: error.name,
          code: error.code
        })
      });

      res.status(statusCode).json(response);
    });
  };
};

module.exports = asyncHandler;