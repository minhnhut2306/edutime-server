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