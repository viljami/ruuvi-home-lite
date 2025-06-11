/**
 * Services Barrel File
 *
 * This file re-exports all services to simplify imports across the application.
 * Import this file to access all services instead of importing them individually.
 */

// Re-export service classes
export { ThemeService } from "./ThemeService.js";
export type { Theme, ThemeChangeCallback } from "./ThemeService.js";

// Import services to ensure they're initialized
import "./ThemeService.js";

// This ensures all services are properly included even if only the index.ts is imported