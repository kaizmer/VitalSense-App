// Activity Logger Utility
// Logs student activities to the student_activity table

const SUPABASE_URL = 'https://dftmxaoxygilbhbonrnu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YyxtmFa4_omJeaejR6S3gA_D6f1Ycs0';

// Cache IP address to avoid multiple fetches
let cachedIpAddress = null;

/**
 * Fetches the device's public IP address
 * @returns {Promise<string|null>} - Returns IP address or null if unavailable
 */
async function getIpAddress() {
  // Return cached IP if already fetched
  if (cachedIpAddress) {
    return cachedIpAddress;
  }

  try {
    // Try multiple IP services for reliability
    const services = [
      'https://api.ipify.org?format=json',
      'https://api.my-ip.io/ip.json',
      'https://ipapi.co/json/',
    ];

    for (const service of services) {
      try {
        const response = await fetch(service, { timeout: 3000 });
        if (response.ok) {
          const data = await response.json();
          // Different services use different field names
          const ip = data.ip || data.address || data.query;
          if (ip) {
            cachedIpAddress = ip;
            return ip;
          }
        }
      } catch (err) {
        // Try next service
        continue;
      }
    }
    
    return null;
  } catch (err) {
    console.warn('Failed to fetch IP address:', err);
    return null;
  }
}

/**
 * Logs a student activity to the database
 * @param {number} studentId - The student's ID
 * @param {string} description - Description of the activity
 * @param {string} ipAddress - Optional IP address (auto-fetched if not provided)
 * @returns {Promise<boolean>} - Returns true if successful, false otherwise
 */
export async function logActivity(studentId, description, ipAddress = null) {
  if (!studentId || !description) {
    console.warn('logActivity: studentId and description are required');
    return false;
  }

  try {
    // Fetch IP address if not provided
    const ip = ipAddress || await getIpAddress();
    
    // Get current time in Philippine timezone (GMT+8)
    // Add 8 hours to UTC time for Philippine timezone
    const now = new Date();
    const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    
    // Format: YYYY-MM-DD HH:MM:SS
    const year = phTime.getUTCFullYear();
    const month = String(phTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(phTime.getUTCDate()).padStart(2, '0');
    const hours = String(phTime.getUTCHours()).padStart(2, '0');
    const minutes = String(phTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(phTime.getUTCSeconds()).padStart(2, '0');
    const timelog = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    
    const url = `${SUPABASE_URL}/rest/v1/student_activity`;
    const body = {
      student_id: studentId,
      description: description,
      ip_address: ip,
      timelog: timelog,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.warn('Failed to log activity:', await res.text());
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error logging activity:', err);
    return false;
  }
}

/**
 * Helper functions for specific activities
 */

export const ActivityLogger = {
  // Authentication activities
  login: (studentId) => logActivity(studentId, 'Logged in'),
  logout: (studentId) => logActivity(studentId, 'Logged out'),
  signup: (studentId) => logActivity(studentId, 'Account created'),

  // Navigation activities
  navigateTo: (studentId, screenName) => 
    logActivity(studentId, `Navigated to ${screenName} screen`),

  // Profile activities
  viewProfile: (studentId) => logActivity(studentId, 'Viewed profile'),
  editProfile: (studentId, field) => 
    logActivity(studentId, `Edited profile field: ${field}`),

  // QR Code activities
  viewQRCode: (studentId) => logActivity(studentId, 'Viewed QR code'),
  createPIN: (studentId) => logActivity(studentId, 'Created PIN code'),
  verifyPIN: (studentId) => logActivity(studentId, 'Verified PIN code'),

  // Health activities
  recordMood: (studentId, mood) => 
    logActivity(studentId, `Recorded mood: ${mood}`),
  viewTrends: (studentId, metric) => 
    logActivity(studentId, `Viewed trends for ${metric}`),
  viewNotifications: (studentId) => 
    logActivity(studentId, 'Viewed health notifications'),
  viewScanLogs: (studentId) => logActivity(studentId, 'Viewed scan logs'),

  // Settings activities
  viewSettings: (studentId) => logActivity(studentId, 'Viewed settings'),
  toggleDarkMode: (studentId, enabled) => 
    logActivity(studentId, `${enabled ? 'Enabled' : 'Disabled'} dark mode`),
  toggleNotifications: (studentId, enabled) => 
    logActivity(studentId, `${enabled ? 'Enabled' : 'Disabled'} notifications`),
  viewSecuritySettings: (studentId) => 
    logActivity(studentId, 'Viewed security settings'),
  changePassword: (studentId) => logActivity(studentId, 'Changed password'),

  // Custom activity
  custom: (studentId, description) => logActivity(studentId, description),
};
