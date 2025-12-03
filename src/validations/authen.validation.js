const validator = require('validator');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SPECIAL_CHAR_REGEX = /[!@#$%^&*(),.?":{}|<>]/;

module.exports = {
  isValidEmailorPhone: (input) => 
    module.exports.isEmail(input) || validator.isMobilePhone(input, 'any'),
  
  isValidPassword: (input) => 
    input.length >= 8 && SPECIAL_CHAR_REGEX.test(input),
  
  isPhone: (phone) => 
    validator.isMobilePhone(phone, 'any'),
  
  isEmail: (username) => 
    EMAIL_REGEX.test(username)
};