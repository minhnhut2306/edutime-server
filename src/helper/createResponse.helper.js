const STATUS_CODES = {
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204,
    MOVED_PERMANENTLY: 301,
    FOUND: 302,
    NOT_MODIFIED: 304,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    NOT_ACCEPTABLE: 406,
    REQUEST_TIMEOUT: 408,
    CONFLICT: 409,
    GONE: 410,
    PAYLOAD_TOO_LARGE: 413,
    UNSUPPORTED_MEDIA_TYPE: 415,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    NOT_IMPLEMENTED: 501,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504
  };
  
  const createResponse = (code, msg, status, data = {}) => ({
    code: !isNaN(code) ? code : 500,
    msg,
    status,
    data
  });
  
  const successResponse = (msg = 'Thành công', data = {}, code = STATUS_CODES.OK) =>
    createResponse(code, msg, 'success', data);
  
  const errorResponse = (msg = 'Có lỗi xảy ra', code = STATUS_CODES.INTERNAL_SERVER_ERROR, data = {}) =>
    createResponse(code, msg, 'error', data);
  
  const createdResponse = (msg = 'Tạo mới thành công', data = {}) =>
    createResponse(STATUS_CODES.CREATED, msg, 'success', data);
  
  const notFoundResponse = (msg = 'Không tìm thấy tài nguyên') =>
    createResponse(STATUS_CODES.NOT_FOUND, msg, 'error', {});
  
  const unauthorizedResponse = (msg = 'Chưa đăng nhập hoặc token không hợp lệ') =>
    createResponse(STATUS_CODES.UNAUTHORIZED, msg, 'error', {});
  
  const forbiddenResponse = (msg = 'Bạn không có quyền truy cập') =>
    createResponse(STATUS_CODES.FORBIDDEN, msg, 'error', {});
  
  const badRequestResponse = (msg = 'Dữ liệu không hợp lệ', data = {}) =>
    createResponse(STATUS_CODES.BAD_REQUEST, msg, 'error', data);
  
  const conflictResponse = (msg = 'Tài nguyên đã tồn tại', data = {}) =>
    createResponse(STATUS_CODES.CONFLICT, msg, 'error', data);
  
  const serverErrorResponse = (msg = 'Lỗi máy chủ', data = {}) =>
    createResponse(STATUS_CODES.INTERNAL_SERVER_ERROR, msg, 'error', data);
  
  module.exports = {
    createResponse,
    STATUS_CODES,
    successResponse,
    errorResponse,
    createdResponse,
    notFoundResponse,
    unauthorizedResponse,
    forbiddenResponse,
    badRequestResponse,
    conflictResponse,
    serverErrorResponse
  };