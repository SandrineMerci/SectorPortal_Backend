// services/service.js

// Generate reference number for service or complaint
function generateReferenceNumber(type) {
  const typeCode = type === 'service' ? 'SR' : 'CP';
  const year = new Date().getFullYear();
  const randomNumber = Math.floor(100000 + Math.random() * 900000); // 6-digit
  return `JAB-${year}-${typeCode}-${randomNumber}`;
}

// Validate request payload
function validateRequest(data) {
  const requiredFields = ['category', 'location', 'description', 'priority', 'name', 'phone'];
  const missing = requiredFields.filter(field => !data[field]);
  if (missing.length) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
  // Optional: add more validation like phone/email format
  return true;
}

module.exports = {
  generateReferenceNumber,
  validateRequest,
};