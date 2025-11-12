function createResponse(code, msg, status, data = {}) {
    if (typeof code !== 'number' || isNaN(code)) {
        code = 500; 
    }
    return { code, msg, status, data };
}

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

function successResponse(msg = 'Thành công', data = {}, code = 200) {
    return createResponse(code, msg, 'success', data);
}

function errorResponse(msg = 'Có lỗi xảy ra', code = 500, data = {}) {
    return createResponse(code, msg, 'error', data);
}

function createdResponse(msg = 'Tạo mới thành công', data = {}) {
    return createResponse(STATUS_CODES.CREATED, msg, 'success', data);
}

function notFoundResponse(msg = 'Không tìm thấy tài nguyên') {
    return createResponse(STATUS_CODES.NOT_FOUND, msg, 'error', {});
}

function unauthorizedResponse(msg = 'Chưa đăng nhập hoặc token không hợp lệ') {
    return createResponse(STATUS_CODES.UNAUTHORIZED, msg, 'error', {});
}

function forbiddenResponse(msg = 'Bạn không có quyền truy cập') {
    return createResponse(STATUS_CODES.FORBIDDEN, msg, 'error', {});
}

function badRequestResponse(msg = 'Dữ liệu không hợp lệ', data = {}) {
    return createResponse(STATUS_CODES.BAD_REQUEST, msg, 'error', data);
}

function conflictResponse(msg = 'Tài nguyên đã tồn tại', data = {}) {
    return createResponse(STATUS_CODES.CONFLICT, msg, 'error', data);
}

function serverErrorResponse(msg = 'Lỗi máy chủ', data = {}) {
    return createResponse(STATUS_CODES.INTERNAL_SERVER_ERROR, msg, 'error', data);
}

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

// ============================================
// VÍ DỤ SỬ DỤNG
// ============================================
// const { successResponse, errorResponse, notFoundResponse, STATUS_CODES } = require('./helper/createResponse.helper');
//
// res.json(successResponse('Lấy dữ liệu thành công', users));
// res.status(201).json(createdResponse('Tạo user thành công', newUser));
// res.status(404).json(notFoundResponse('Không tìm thấy user'));
// res.status(STATUS_CODES.CONFLICT).json(errorResponse('Email đã tồn tại', STATUS_CODES.CONFLICT));
// res.status(400).json(badRequestResponse('Dữ liệu không hợp lệ', { errors: ['Email không đúng định dạng'] }));
//
// ============================================
// HTTP STATUS CODES
// ============================================
// 2xx: 200 OK, 201 Created, 204 No Content
// 3xx: 301 Moved, 302 Found, 304 Not Modified
// 4xx: 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 422 Unprocessable, 429 Too Many
// 5xx: 500 Internal Error, 502 Bad Gateway, 503 Service Unavailable