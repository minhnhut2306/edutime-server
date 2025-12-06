const crypto = require('crypto');

const parseDeviceInfo = (userAgent, ip) => {
  const ua = userAgent || 'Unknown';
  
  let browser = 'Unknown';
  let browserVersion = '';
  
  if (ua.includes('coc_coc_browser') || ua.includes('CocCoc')) {
    browser = 'Cốc Cốc';
    const match = ua.match(/coc_coc_browser[\/\s](\d+\.[\d.]+)/i);
    browserVersion = match ? match[1] : '';
  }
  else if (ua.includes('Brave')) {
    browser = 'Brave';
    const match = ua.match(/Brave[\/\s](\d+\.[\d.]+)/i);
    browserVersion = match ? match[1] : '';
  }
  else if (ua.includes('Edg/')) {
    browser = 'Microsoft Edge';
    const match = ua.match(/Edg[\/\s](\d+\.[\d.]+)/);
    browserVersion = match ? match[1] : '';
  }
  else if (ua.includes('OPR/') || ua.includes('Opera')) {
    browser = 'Opera';
    const match = ua.match(/(?:OPR|Opera)[\/\s](\d+\.[\d.]+)/);
    browserVersion = match ? match[1] : '';
  }
  else if (ua.includes('Chrome/') && !ua.includes('Edg')) {
    browser = 'Google Chrome';
    const match = ua.match(/Chrome[\/\s](\d+\.[\d.]+)/);
    browserVersion = match ? match[1] : '';
  }
  else if (ua.includes('Firefox/')) {
    browser = 'Mozilla Firefox';
    const match = ua.match(/Firefox[\/\s](\d+\.[\d.]+)/);
    browserVersion = match ? match[1] : '';
  }
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    browser = 'Safari';
    const match = ua.match(/Version[\/\s](\d+\.[\d.]+)/);
    browserVersion = match ? match[1] : '';
  }
  else if (ua.includes('Trident/') || ua.includes('MSIE')) {
    browser = 'Internet Explorer';
    const match = ua.match(/(?:MSIE |rv:)(\d+\.[\d.]+)/);
    browserVersion = match ? match[1] : '';
  }
  
  let os = 'Unknown';
  let osVersion = '';
  
  if (ua.includes('Windows NT')) {
    os = 'Windows';
    if (ua.includes('Windows NT 10.0')) osVersion = '10/11';
    else if (ua.includes('Windows NT 6.3')) osVersion = '8.1';
    else if (ua.includes('Windows NT 6.2')) osVersion = '8';
    else if (ua.includes('Windows NT 6.1')) osVersion = '7';
    else {
      const match = ua.match(/Windows NT ([\d.]+)/);
      osVersion = match ? match[1] : '';
    }
  }
  else if (ua.includes('Mac OS X')) {
    os = 'MacOS';
    const match = ua.match(/Mac OS X ([\d_]+)/);
    osVersion = match ? match[1].replace(/_/g, '.') : '';
  }
  else if (ua.includes('Linux')) {
    os = 'Linux';
    if (ua.includes('Ubuntu')) osVersion = 'Ubuntu';
    else if (ua.includes('Fedora')) osVersion = 'Fedora';
  }
  else if (ua.includes('Android')) {
    os = 'Android';
    const match = ua.match(/Android ([\d.]+)/);
    osVersion = match ? match[1] : '';
  }
  else if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) {
    os = 'iOS';
    const match = ua.match(/OS ([\d_]+)/);
    osVersion = match ? match[1].replace(/_/g, '.') : '';
  }
  
  let device = 'Desktop';
  if (ua.includes('Mobile')) device = 'Mobile';
  else if (ua.includes('Tablet') || ua.includes('iPad')) device = 'Tablet';
  
  // ✅ TẠO FINGERPRINT - QUAN TRỌNG!
  const fingerprintData = `${browser}|${browserVersion}|${os}|${osVersion}|${device}|${ua}`;
  const fingerprint = crypto
    .createHash('sha256')
    .update(fingerprintData)
    .digest('hex')
    .substring(0, 32);
  
  // ✅ PHẢI RETURN FINGERPRINT!
  return {
    userAgent: ua,
    ip: ip || 'Unknown',
    browser,
    browserVersion,
    os,
    osVersion,
    device,
    fingerprint, // ✅ DÒNG NÀY QUAN TRỌNG NHẤT!
  };
};

const getDeviceDescription = (deviceInfo) => {
  const parts = [];
  
  if (deviceInfo.browser !== 'Unknown') {
    parts.push(deviceInfo.browser);
    if (deviceInfo.browserVersion) {
      parts.push(`v${deviceInfo.browserVersion.split('.')[0]}`);
    }
  }
  
  if (deviceInfo.os !== 'Unknown') {
    parts.push(`trên ${deviceInfo.os}`);
    if (deviceInfo.osVersion) {
      parts.push(deviceInfo.osVersion);
    }
  }
  
  if (deviceInfo.device !== 'Desktop') {
    parts.push(`(${deviceInfo.device})`);
  }
  
  return parts.join(' ');
};

module.exports = {
  parseDeviceInfo,
  getDeviceDescription,
};