const nodemailer = require("nodemailer");
require("dotenv").config();


const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASSWORD, 
  },
});

/**
 * Gửi email OTP
 * @param {string} email - Email người nhận
 * @param {string} otp - Mã OTP
 * @returns {Promise<boolean>} - Thành công hay không
 */
const sendOTPEmail = async (email, otp) => {
  try {
    const mailOptions = {
      from: `"EduTime System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Mã OTP Đặt Lại Mật Khẩu - EduTime",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .header {
              background-color: #2563eb;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 0 0 8px 8px;
            }
            .otp-box {
              background-color: #eff6ff;
              border: 2px solid #2563eb;
              padding: 20px;
              text-align: center;
              border-radius: 8px;
              margin: 20px 0;
            }
            .otp-code {
              font-size: 32px;
              font-weight: bold;
              color: #2563eb;
              letter-spacing: 8px;
            }
            .warning {
              background-color: #fef2f2;
              border-left: 4px solid #ef4444;
              padding: 15px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              color: #666;
              font-size: 12px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 EduTime - Đặt Lại Mật Khẩu</h1>
            </div>
            <div class="content">
              <p>Xin chào,</p>
              <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản <strong>${email}</strong></p>
              
              <div class="otp-box">
                <p style="margin: 0; font-size: 14px; color: #666;">Mã OTP của bạn là:</p>
                <div class="otp-code">${otp}</div>
                <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">
                  Mã có hiệu lực trong 10 phút
                </p>
              </div>

              <div class="warning">
                <p style="margin: 0;"><strong>⚠️ Lưu ý:</strong></p>
                <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                  <li>Không chia sẻ mã OTP này với bất kỳ ai</li>
                  <li>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này</li>
                  <li>Mã OTP sẽ hết hạn sau 10 phút</li>
                </ul>
              </div>

              <p>Nếu bạn cần hỗ trợ, vui lòng liên hệ với chúng tôi.</p>
              
              <p style="margin-top: 30px;">
                Trân trọng,<br>
                <strong>Đội ngũ EduTime</strong>
              </p>
            </div>
            <div class="footer">
              <p>© 2024 EduTime - Hệ thống Quản lý Giờ Dạy</p>
              <p>Email này được gửi tự động, vui lòng không trả lời.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Không thể gửi email. Vui lòng thử lại sau.");
  }
};

/**
 * Gửi email thông báo đổi mật khẩu thành công
 * @param {string} email - Email người nhận
 * @returns {Promise<boolean>} - Thành công hay không
 */
const sendPasswordChangeNotification = async (email) => {
  try {
    const mailOptions = {
      from: `"EduTime System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Mật Khẩu Đã Được Thay Đổi - EduTime",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .header {
              background-color: #10b981;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 0 0 8px 8px;
            }
            .success-box {
              background-color: #f0fdf4;
              border: 2px solid #10b981;
              padding: 20px;
              text-align: center;
              border-radius: 8px;
              margin: 20px 0;
            }
            .warning {
              background-color: #fef2f2;
              border-left: 4px solid #ef4444;
              padding: 15px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              color: #666;
              font-size: 12px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Đổi Mật Khẩu Thành Công</h1>
            </div>
            <div class="content">
              <p>Xin chào,</p>
              
              <div class="success-box">
                <h2 style="color: #10b981; margin: 0;">🔒 Mật khẩu đã được thay đổi</h2>
                <p style="margin: 10px 0 0 0; color: #666;">
                  ${new Date().toLocaleString('vi-VN', { 
                    timeZone: 'Asia/Ho_Chi_Minh',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>

              <p>Mật khẩu cho tài khoản <strong>${email}</strong> đã được thay đổi thành công.</p>

              <div class="warning">
                <p style="margin: 0;"><strong>⚠️ Nếu bạn không thực hiện thao tác này:</strong></p>
                <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                  <li>Vui lòng liên hệ với quản trị viên ngay lập tức</li>
                  <li>Tài khoản của bạn có thể đã bị xâm nhập</li>
                </ul>
              </div>

              <p style="margin-top: 30px;">
                Trân trọng,<br>
                <strong>Đội ngũ EduTime</strong>
              </p>
            </div>
            <div class="footer">
              <p>© 2024 EduTime - Hệ thống Quản lý Giờ Dạy</p>
              <p>Email này được gửi tự động, vui lòng không trả lời.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Error sending notification email:", error);
    // Không throw error vì đây chỉ là thông báo
    return false;
  }
};

module.exports = {
  sendOTPEmail,
  sendPasswordChangeNotification,
};