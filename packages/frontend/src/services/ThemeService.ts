/**
 * ThemeService
 * 
 * A service for detecting and responding to system theme preferences (light/dark mode).
 * Uses the MediaQueryList API to detect changes and notify subscribers.
 */

export type Theme = 'light' | 'dark';
export type ThemeChangeCallback = (theme: Theme) => void;

export class ThemeService {
  private static instance: ThemeService | null = null;
  private mediaQuery: MediaQueryList;
  private subscribers: Set<ThemeChangeCallback> = new Set();
  private currentTheme: Theme;

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    // Create media query to detect dark mode preference
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Set initial theme
    this.currentTheme = this.mediaQuery.matches ? 'dark' : 'light';
    
    // Add listener for theme changes
    this.mediaQuery.addEventListener('change', this.handleThemeChange);
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): ThemeService {
    if (!ThemeService.instance) {
      ThemeService.instance = new ThemeService();
    }
    return ThemeService.instance;
  }

  /**
   * Handle theme preference changes
   */
  private handleThemeChange = (event: MediaQueryListEvent): void => {
    this.currentTheme = event.matches ? 'dark' : 'light';
    this.notifySubscribers();
  };

  /**
   * Notify all subscribers of theme change
   */
  private notifySubscribers(): void {
    this.subscribers.forEach(callback => {
      try {
        callback(this.currentTheme);
      } catch (error) {
        console.error('Error in theme change callback:', error);
      }
    });
  }

  /**
   * Get the current theme
   */
  public getTheme(): Theme {
    return this.currentTheme;
  }

  /**
   * Check if the current theme is dark mode
   */
  public isDarkMode(): boolean {
    return this.currentTheme === 'dark';
  }

  /**
   * Check if the current theme is light mode
   */
  public isLightMode(): boolean {
    return this.currentTheme === 'light';
  }

  /**
   * Subscribe to theme changes
   * @returns A function to unsubscribe
   */
  public subscribe(callback: ThemeChangeCallback): () => void {
    this.subscribers.add(callback);
    
    // Call the callback immediately with the current theme
    callback(this.currentTheme);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Clean up service resources
   */
  public destroy(): void {
    this.mediaQuery.removeEventListener('change', this.handleThemeChange);
    this.subscribers.clear();
    ThemeService.instance = null;
  }
}