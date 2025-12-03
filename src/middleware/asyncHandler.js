const { 
  badRequestResponse, 
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,  
  conflictResponse,
  serverErrorResponse,
  STATUS_CODES 
} = require('../helper/createResponse.helper');
const logger = require('../utils/logger');

const ERROR_MAP = {
  'User not found': { status: STATUS_CODES.NOT_FOUND, msg: 'Người dùng không tồn tại', handler: notFoundResponse },
  'Class not found': { status: STATUS_CODES.NOT_FOUND, msg: 'Không tìm thấy lớp học', handler: notFoundResponse },
  'Invalid password': { status: STATUS_CODES.UNAUTHORIZED, msg: 'Mật khẩu không đúng', handler: unauthorizedResponse },
  'User already exists': { status: STATUS_CODES.CONFLICT, msg: 'Email đã tồn tại', handler: conflictResponse },
  'Class name already exists': { status: STATUS_CODES.CONFLICT, msg: 'Tên lớp đã tồn tại', handler: conflictResponse },
  'Invalid token': { status: STATUS_CODES.UNAUTHORIZED, msg: 'Token không hợp lệ', handler: unauthorizedResponse },
  'Token expired': { status: STATUS_CODES.UNAUTHORIZED, msg: 'Token đã hết hạn', handler: unauthorizedResponse },
  'Forbidden': { status: STATUS_CODES.FORBIDDEN, msg: 'Bạn không có quyền truy cập', handler: forbiddenResponse },
  'Access denied': { status: STATUS_CODES.FORBIDDEN, msg: 'Bạn không có quyền truy cập', handler: forbiddenResponse },
  'Excel file is empty': { status: STATUS_CODES.BAD_REQUEST, msg: 'File Excel trống', handler: badRequestResponse },
  'No file uploaded': { status: STATUS_CODES.BAD_REQUEST, msg: 'Vui lòng tải lên file Excel', handler: badRequestResponse }
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    logger.error('Lỗi xử lý bất đồng bộ:', error);

    if (res.headersSent) return next(error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(STATUS_CODES.BAD_REQUEST).json(
        badRequestResponse('Dữ liệu không hợp lệ', { errors })
      );
    }

    if (error.name === 'CastError') {
      return res.status(STATUS_CODES.BAD_REQUEST).json(
        badRequestResponse('Thông tin không hợp lệ, vui lòng kiểm tra lại')
      );
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      const value = error.keyValue?.[field];
      
      let message = '';
      if (field === 'phone') {
        message = `Số điện thoại "${value}" đã được sử dụng`;
      } else if (field === 'email') {
        message = `Email "${value}" đã tồn tại trong hệ thống`;
      } else if (field === 'userId') {
        message = 'Tài khoản này đã được gán cho giáo viên khác';
      } else {
        message = `${field} "${value}" đã tồn tại trong hệ thống`;
      }
      
      return res.status(STATUS_CODES.CONFLICT).json(
        conflictResponse(message, { field, value })
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

    const mappedError = ERROR_MAP[error.message];
    if (mappedError) {
      return res.status(mappedError.status).json(mappedError.handler(mappedError.msg));
    }

    if (error.message.includes('Email') || error.message.includes('Password')) {
      return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse(error.message));
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

module.exports = asyncHandler;