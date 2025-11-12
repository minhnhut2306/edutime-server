// src/middleware/asyncHandler.js
const { serverErrorResponse, badRequestResponse } = require('../helper/createResponse.helper');

/**
 * Wrapper function để bắt lỗi tự động cho async route handlers
 * Tránh phải viết try-catch ở mọi controller
 * 
 * @param {Function} fn - Async function cần wrap
 * @returns {Function} - Express middleware function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      console.error('❌ AsyncHandler Error:', error);

      // Nếu response đã được gửi, chuyển lỗi cho error handler tiếp theo
      if (res.headersSent) {
        return next(error);
      }

      // ============================================
      // XỬ LÝ CÁC LOẠI LỖI MONGOOSE/MONGODB
      // ============================================

      // 1. Lỗi Validation từ Mongoose
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json(
          badRequestResponse('Dữ liệu không hợp lệ', { errors })
        );
      }

      // 2. Lỗi Cast (VD: ObjectId không hợp lệ)
      if (error.name === 'CastError') {
        return res.status(400).json(
          badRequestResponse(`ID không hợp lệ: ${error.value}`)
        );
      }

      // 3. Lỗi Duplicate Key (unique constraint)
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern || {})[0];
        const value = error.keyValue?.[field];
        return res.status(409).json(
          badRequestResponse(
            `${field} "${value}" đã tồn tại trong hệ thống`,
            { field, value }
          )
        );
      }

      // 4. Lỗi JWT (Token)
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json(
          badRequestResponse('Token không hợp lệ')
        );
      }

      if (error.name === 'TokenExpiredError') {
        return res.status(401).json(
          badRequestResponse('Token đã hết hạn')
        );
      }

      // ============================================
      // XỬ LÝ LỖI MẶC ĐỊNH
      // ============================================

      const statusCode = error.statusCode || 500;
      const message = error.message || 'Có lỗi xảy ra trên server';

      // Chỉ show stack trace ở development
      const response = serverErrorResponse(message, {
        ...(process.env.NODE_ENV === 'development' && { 
          stack: error.stack,
          name: error.name 
        })
      });

      res.status(statusCode).json(response);
    });
  };
};

// ============================================
// VÍ DỤ SỬ DỤNG
// ============================================

/*

// 1. Import vào controller
const { asyncHandler } = require('../middleware/asyncHandler');
const { successResponse, notFoundResponse } = require('../helper/createResponse.helper');

// 2. Wrap các async functions
exports.getUsers = asyncHandler(async (req, res) => {
  const users = await User.find();
  res.json(successResponse('Lấy danh sách user thành công', { users }));
});

// 3. Throw error - sẽ được bắt tự động
exports.getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    // Cách 1: Throw Error đơn giản (status 500)
    throw new Error('User không tồn tại');
    
    // Cách 2: Custom status code
    const error = new Error('User không tồn tại');
    error.statusCode = 404;
    throw error;
    
    // Cách 3: Return response trực tiếp (recommended)
    return res.status(404).json(notFoundResponse('User không tồn tại'));
  }
  
  res.json(successResponse('Lấy user thành công', { user }));
});

// 4. Validation errors sẽ tự động bắt
exports.createUser = asyncHandler(async (req, res) => {
  const user = new User(req.body); // Nếu validation fail -> tự động trả 400
  await user.save();
  res.status(201).json(successResponse('Tạo user thành công', { user }));
});

// 5. Duplicate key errors
exports.register = asyncHandler(async (req, res) => {
  const user = await User.create(req.body); // Nếu email trùng -> tự động trả 409
  res.status(201).json(successResponse('Đăng ký thành công', { user }));
});

*/

// ============================================
// TYPESCRIPT VERSION (nếu cần)
// ============================================

/*

// src/middleware/asyncHandler.ts
import { Request, Response, NextFunction } from 'express';
import { serverErrorResponse, badRequestResponse } from '../helper/createResponse.helper';

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>;

export const asyncHandler = (fn: AsyncRequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error: any) => {
      console.error('❌ AsyncHandler Error:', error);

      if (res.headersSent) {
        return next(error);
      }

      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map((err: any) => err.message);
        return res.status(400).json(
          badRequestResponse('Dữ liệu không hợp lệ', { errors })
        );
      }

      if (error.name === 'CastError') {
        return res.status(400).json(
          badRequestResponse(`ID không hợp lệ: ${error.value}`)
        );
      }

      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern || {})[0];
        const value = error.keyValue?.[field];
        return res.status(409).json(
          badRequestResponse(
            `${field} "${value}" đã tồn tại trong hệ thống`,
            { field, value }
          )
        );
      }

      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json(
          badRequestResponse('Token không hợp lệ')
        );
      }

      if (error.name === 'TokenExpiredError') {
        return res.status(401).json(
          badRequestResponse('Token đã hết hạn')
        );
      }

      const statusCode = error.statusCode || 500;
      const message = error.message || 'Có lỗi xảy ra trên server';

      const response = serverErrorResponse(message, {
        ...(process.env.NODE_ENV === 'development' && { 
          stack: error.stack,
          name: error.name 
        })
      });

      res.status(statusCode).json(response);
    });
  };
};

*/

module.exports = { asyncHandler };