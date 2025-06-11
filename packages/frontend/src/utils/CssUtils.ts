/**
 * CssUtils
 * 
 * Utility functions for working with CSS variables in JavaScript.
 * Provides type-safe access to CSS variables with fallback values.
 */

export class CssUtils {
  /**
   * Get a CSS variable value as a string
   * 
   * @param variableName - The CSS variable name (with or without --), e.g. 'color-primary' or '--color-primary'
   * @param defaultValue - Default value to return if the variable is not found
   * @param element - Optional element to get the variable from (defaults to :root)
   * @returns The variable value as a string, or the default value
   */
  static getCssVariable(
    variableName: string,
    defaultValue: string = '',
    element: HTMLElement = document.documentElement
  ): string {
    // Ensure variable name has leading --
    const cssVarName = variableName.startsWith('--') 
      ? variableName 
      : `--${variableName}`;
    
    // Get computed style and extract variable
    const value = getComputedStyle(element).getPropertyValue(cssVarName).trim();
    
    return value || defaultValue;
  }

  /**
   * Get a CSS variable value as a number
   * 
   * @param variableName - The CSS variable name (with or without --)
   * @param defaultValue - Default value to return if the variable is not found or not a valid number
   * @param element - Optional element to get the variable from (defaults to :root)
   * @returns The variable value as a number, or the default value
   */
  static getCssVariableAsNumber(
    variableName: string,
    defaultValue: number = 0,
    element: HTMLElement = document.documentElement
  ): number {
    const value = this.getCssVariable(variableName, '', element);
    
    // Try to parse as number, removing 'px', '%', etc.
    const numericValue = parseFloat(value.replace(/[^\d.-]/g, ''));
    
    return isNaN(numericValue) ? defaultValue : numericValue;
  }

  /**
   * Get a CSS variable as a color value (hex, rgb, rgba)
   * 
   * @param variableName - The CSS variable name (with or without --)
   * @param defaultValue - Default color to return if the variable is not found
   * @param element - Optional element to get the variable from (defaults to :root)
   * @returns The variable value as a color string
   */
  static getCssVariableAsColor(
    variableName: string,
    defaultValue: string = '#000000',
    element: HTMLElement = document.documentElement
  ): string {
    const value = this.getCssVariable(variableName, '', element);
    
    // If value is empty, return default
    if (!value) {
      return defaultValue;
    }
    
    return value;
  }

  /**
   * Check if dark mode is enabled via CSS variables
   * 
   * @returns True if dark mode is enabled
   */
  static isDarkMode(): boolean {
    // Query the media feature directly for most accurate result
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /**
   * Set a CSS variable value
   * 
   * @param variableName - The CSS variable name (with or without --)
   * @param value - The value to set
   * @param element - Optional element to set the variable on (defaults to :root)
   */
  static setCssVariable(
    variableName: string,
    value: string,
    element: HTMLElement = document.documentElement
  ): void {
    // Ensure variable name has leading --
    const cssVarName = variableName.startsWith('--') 
      ? variableName 
      : `--${variableName}`;
    
    element.style.setProperty(cssVarName, value);
  }
}