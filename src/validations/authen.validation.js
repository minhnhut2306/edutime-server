const validator = require('validator');

const SPECIAL_CHAR_REGEX = /[^\w\s]/u;

function ensureString(input) {
  return typeof input === 'string' ? input.trim() : '';
}

function isValidEmailorPhone(input) {
  const v = ensureString(input);
  return v !== '' && (validator.isEmail(v) || validator.isMobilePhone(v, 'any'));
}

function isValidPassword(input) {
  const v = ensureString(input);
  if (v.length < 8) return false;
  return SPECIAL_CHAR_REGEX.test(v);
}

function isPhone(phone) {
  const v = ensureString(phone);
  if (v === '') return false;
  return validator.isMobilePhone(v, 'any');
}

function isEmail(username) {
  const v = ensureString(username);
  if (v === '') return false;
  return validator.isEmail(v);
}

module.exports = {
  isValidEmailorPhone,
  isValidPassword,
  isPhone,
  isEmail,
  isHopLeEmailHoacDienThoai: isValidEmailorPhone,
  isMatKhauHopLe: isValidPassword,
  isDienThoai: isPhone,
  isEmailHopLe: isEmail
};