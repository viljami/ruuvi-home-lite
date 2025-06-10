/**
 * ViewportManager
 *
 * Simple manager for viewport changes including resize and orientation changes.
 * Provides callbacks for responsive layout management.
 */

import { Utils } from "../utils/Utils.js";

export type ViewportSize = "small" | "medium" | "large";
export type Orientation = "portrait" | "landscape";

export interface ViewportState {
  size: ViewportSize;
  orientation: Orientation;
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

// Callback types
type ResizeCallback = () => void;
type OrientationChangeCallback = () => void;

interface ViewportManagerOptions {
  smallBreakpoint?: number;
  mediumBreakpoint?: number;
  debounceTime: number;
}

export class ViewportManager {
  private state: ViewportState = {} as ViewportState;
  private resizeCallbacks: Set<ResizeCallback> = new Set();
  private orientationChangeCallbacks: Set<OrientationChangeCallback> =
    new Set();
  private debouncedViewportChange: () => void = () => {};
  private debouncedOrientationChange: () => void = () => {};

  // Singleton instance
  private static instance: ViewportManager | null = null;

  private options = {
    smallBreakpoint: 480,
    mediumBreakpoint: 768,
    debounceTime: 150,
  };

  constructor(options?: ViewportManagerOptions) {
    // Singleton pattern
    if (ViewportManager.instance) {
      return ViewportManager.instance;
    }
    ViewportManager.instance = this;

    if (options) {
      this.options = { ...this.options, ...options };
    }

    // Initialize state
    this.state = this.getViewportState();

    this.debouncedViewportChange = Utils.debounce(
      () => this.handleViewportChange(),
      this.options.debounceTime,
    );

    this.debouncedOrientationChange = Utils.debounce(
      () => this.handleOrientationtChange(),
      this.options.debounceTime,
    );

    // Setup event listeners
    this.setupEventListeners();

    // Apply initial state
    document.body.classList.add(this.state.orientation);
    document.body.classList.add(
      this.state.isMobile
        ? "mobile"
        : this.state.isTablet
          ? "tablet"
          : "desktop",
    );
  }

  /**
   * Get the current viewport state
   */
  private getViewportState(): ViewportState {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const orientation: Orientation = height > width ? "portrait" : "landscape";

    let size: ViewportSize;
    if (width <= this.options.smallBreakpoint) {
      size = "small";
    } else if (width <= this.options.mediumBreakpoint) {
      size = "medium";
    } else {
      size = "large";
    }

    const isMobile = size === "small";
    const isTablet = size === "medium";
    const isDesktop = size === "large";

    return {
      size,
      orientation,
      width,
      height,
      isMobile,
      isTablet,
      isDesktop,
    };
  }

  private handleOrientationtChange = () => {
    document.body.classList.remove("portrait", "landscape");
    document.body.classList.add(
      window.innerHeight > window.innerWidth ? "portrait" : "landscape",
    );

    this.handleViewportChange();
    this.notifyOrientationChangeListeners();
  };

  private setupEventListeners(): void {
    window.addEventListener("resize", this.debouncedViewportChange);
    window.addEventListener(
      "orientationchange",
      this.debouncedOrientationChange,
    );
  }

  /**
   * Handle viewport changes
   */
  private handleViewportChange(): void {
    // Get new state
    const newState = this.getViewportState();
    const oldState = this.state;

    // Detect changes
    const orientationChanged = oldState.orientation !== newState.orientation;
    const sizeChanged = oldState.size !== newState.size;

    // Update state
    this.state = newState;

    // Update body classes
    if (sizeChanged) {
      document.body.classList.remove("mobile", "tablet", "desktop");
      document.body.classList.add(
        newState.isMobile ? "mobile" : newState.isTablet ? "tablet" : "desktop",
      );
    }

    // Notify resize listeners
    this.notifyResizeListeners();

    // Notify orientation listeners if needed
    if (orientationChanged) {
      this.notifyOrientationChangeListeners();
    }
  }

  private notifyResizeListeners(): void {
    this.resizeCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error("Error in resize callback:", error);
      }
    });
  }

  private notifyOrientationChangeListeners(): void {
    this.orientationChangeCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error("Error in orientation change callback:", error);
      }
    });
  }

  public getState(): ViewportState {
    return { ...this.state };
  }

  /**
   * Register a callback for resize events
   */
  public onResize(callback: ResizeCallback): () => void {
    this.resizeCallbacks.add(callback);
    return () => {
      this.resizeCallbacks.delete(callback);
    };
  }

  public onOrientationChange(callback: OrientationChangeCallback): () => void {
    this.orientationChangeCallbacks.add(callback);
    return () => {
      this.orientationChangeCallbacks.delete(callback);
    };
  }

  /**
   * Force a viewport state update
   */
  public forceUpdate(): void {
    this.handleViewportChange();
  }

  /**
   * Get the singleton instance of ViewportManager
   */
  public static getInstance(): ViewportManager {
    if (!ViewportManager.instance) {
      ViewportManager.instance = new ViewportManager();
    }
    return ViewportManager.instance;
  }

  public destroy(): void {
    this.resizeCallbacks.clear();
    this.orientationChangeCallbacks.clear();

    // Remove window event listeners
    window.removeEventListener("resize", this.debouncedViewportChange);
    window.removeEventListener(
      "orientationchange",
      this.debouncedOrientationChange,
    );

    // Remove singleton instance
    ViewportManager.instance = null;
  }
}
