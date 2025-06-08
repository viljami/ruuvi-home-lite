import { Database, SensorName } from "./db.js";

export interface AdminAuthResult {
  success: boolean;
  token?: string;
  message?: string;
}

export interface SensorNameOperation {
  success: boolean;
  sensorMac?: string;
  customName?: string;
  message?: string;
}

export class SensorService {
  private database: Database;
  private adminSessions: Map<string, number> = new Map(); // token -> expiry timestamp
  private readonly SESSION_DURATION = 24 * 60 * 60; // 24 hours in seconds

  constructor(database: Database) {
    this.database = database;
    this.cleanupExpiredSessions();

    // Clean up expired sessions every hour
    setInterval(
      () => {
        this.cleanupExpiredSessions();
      },
      60 * 60 * 1000,
    );
  }

  private cleanupExpiredSessions(): void {
    const now = Math.floor(Date.now() / 1000);
    for (const [token, expiry] of this.adminSessions.entries()) {
      if (now > expiry) {
        this.adminSessions.delete(token);
      }
    }
  }

  authenticateAdmin(password: string): AdminAuthResult {
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return {
        success: false,
        message: "Admin authentication not configured",
      };
    }

    if (!password || typeof password !== "string") {
      return {
        success: false,
        message: "Invalid password format",
      };
    }

    if (password === adminPassword) {
      // Generate secure session token
      const token = this.generateSecureToken();
      const expiry = Math.floor(Date.now() / 1000) + this.SESSION_DURATION;
      this.adminSessions.set(token, expiry);

      // No need to log successful authentication
      return {
        success: true,
        token: token,
      };
    } else {
      console.warn("Failed admin authentication attempt");
      return {
        success: false,
        message: "Invalid password",
      };
    }
  }

  private generateSecureToken(): string {
    return (
      Math.random().toString(36).substring(2) +
      Date.now().toString(36) +
      Math.random().toString(36).substring(2)
    );
  }

  isValidAdminToken(token: string): boolean {
    if (!token || typeof token !== "string") {
      return false;
    }

    const expiry = this.adminSessions.get(token);
    if (!expiry) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > expiry) {
      this.adminSessions.delete(token);
      return false;
    }

    return true;
  }

  revokeAdminToken(token: string): void {
    if (token) {
      this.adminSessions.delete(token);
    }
  }

  async getSensorNames(): Promise<SensorName[]> {
    try {
      return await this.database.getSensorNames();
    } catch (error) {
      console.error("SensorService: Error getting sensor names:", error);
      throw new Error("Failed to retrieve sensor names");
    }
  }

  async setSensorName(
    sensorMac: string,
    customName: string,
    adminToken: string,
  ): Promise<SensorNameOperation> {
    // Validate admin authentication
    if (!this.isValidAdminToken(adminToken)) {
      return {
        success: false,
        message: "Admin authentication required or expired",
      };
    }

    // Validate inputs
    if (!sensorMac || typeof sensorMac !== "string") {
      return {
        success: false,
        message: "Invalid sensor MAC address",
      };
    }

    if (
      !customName ||
      typeof customName !== "string" ||
      customName.trim().length === 0
    ) {
      return {
        success: false,
        message: "Invalid custom name",
      };
    }

    // Sanitize inputs
    const sanitizedMac = this.sanitizeMacAddress(sensorMac);
    const sanitizedName = this.sanitizeCustomName(customName);

    if (!sanitizedMac) {
      return {
        success: false,
        message: "Invalid MAC address format",
      };
    }

    if (!sanitizedName) {
      return {
        success: false,
        message: "Invalid name format",
      };
    }

    try {
      await this.database.setSensorName(sanitizedMac, sanitizedName);
      // No need to log successful name setting

      return {
        success: true,
        sensorMac: sanitizedMac,
        customName: sanitizedName,
      };
    } catch (error) {
      console.error("SensorService: Error setting sensor name:", error);
      return {
        success: false,
        message: "Failed to set sensor name",
      };
    }
  }

  async deleteSensorName(
    sensorMac: string,
    adminToken: string,
  ): Promise<SensorNameOperation> {
    // Validate admin authentication
    if (!this.isValidAdminToken(adminToken)) {
      return {
        success: false,
        message: "Admin authentication required or expired",
      };
    }

    // Validate input
    if (!sensorMac || typeof sensorMac !== "string") {
      return {
        success: false,
        message: "Invalid sensor MAC address",
      };
    }

    // Sanitize input
    const sanitizedMac = this.sanitizeMacAddress(sensorMac);
    if (!sanitizedMac) {
      return {
        success: false,
        message: "Invalid MAC address format",
      };
    }

    try {
      await this.database.deleteSensorName(sanitizedMac);
      // No need to log successful name deletion

      return {
        success: true,
        sensorMac: sanitizedMac,
      };
    } catch (error) {
      console.error("SensorService: Error deleting sensor name:", error);
      return {
        success: false,
        message: "Failed to delete sensor name",
      };
    }
  }

  private sanitizeMacAddress(mac: string): string | null {
    if (!mac || typeof mac !== "string") {
      return null;
    }

    // Remove any non-hex, colon, or dash characters and convert to lowercase
    const sanitized = mac.toLowerCase().replace(/[^a-f0-9:-]/g, "");

    // Validate MAC address format (basic check)
    if (sanitized.length < 12 || sanitized.length > 17) {
      return null;
    }

    // Check if it matches common MAC patterns
    const macPatterns = [
      /^[a-f0-9]{12}$/, // 12 hex chars
      /^[a-f0-9]{2}:[a-f0-9]{2}:[a-f0-9]{2}:[a-f0-9]{2}:[a-f0-9]{2}:[a-f0-9]{2}$/, // colon separated
      /^[a-f0-9]{2}-[a-f0-9]{2}-[a-f0-9]{2}-[a-f0-9]{2}-[a-f0-9]{2}-[a-f0-9]{2}$/, // dash separated
    ];

    const isValid = macPatterns.some((pattern) => pattern.test(sanitized));
    return isValid ? sanitized : null;
  }

  private sanitizeCustomName(name: string): string | null {
    if (!name || typeof name !== "string") {
      return null;
    }

    // Trim whitespace and limit length
    let sanitized = name.trim();
    if (sanitized.length === 0 || sanitized.length > 50) {
      return null;
    }

    // Remove potentially dangerous characters but allow most printable chars
    sanitized = sanitized.replace(/[<>\"'&\x00-\x1f\x7f-\x9f]/g, "");

    // Ensure it's not empty after sanitization
    return sanitized.length > 0 ? sanitized : null;
  }

  getActiveAdminSessions(): number {
    this.cleanupExpiredSessions();
    return this.adminSessions.size;
  }

  extendAdminSession(token: string): boolean {
    if (!this.isValidAdminToken(token)) {
      return false;
    }

    const newExpiry = Math.floor(Date.now() / 1000) + this.SESSION_DURATION;
    this.adminSessions.set(token, newExpiry);
    return true;
  }
}
