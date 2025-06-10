/**
 * Components Barrel File
 *
 * This file re-exports all components to simplify imports across the application.
 * Import this file to access all components instead of importing them individually.
 */

// Re-export component classes
export { SensorCard } from "./SensorCard/SensorCard.js";
export { AdminButton } from "./AdminButton/AdminButton.js";
export { SidebarElement } from "./Sidebar/SidebarElement/SidebarElement.js";
export { ChartElement } from "./chart/ChartElement/ChartElement.js";

// Force components to register their custom elements
import "./SensorCard/SensorCard.js";
import "./AdminButton/AdminButton.js";
import "./Sidebar/SidebarElement/SidebarElement.js";
import "./chart/ChartElement/ChartElement.js";

// This ensures all custom elements are registered even if only the index.ts is imported
// Note: The duplicate SensorCard.ts in the components root directory has been removed
// to prevent TypeScript errors and ensure consistent behavior
