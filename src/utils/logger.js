const logger = {
    error: (message, error = null) => {
      console.error(`[ERROR] ${message}`, error || '');
    },
    
    info: (message, data = null) => {
      console.log(`[INFO] ${message}`, data || '');
    },
    
    warn: (message, data = null) => {
      console.warn(`[WARN] ${message}`, data || '');
    }
  };
  
  module.exports = logger;