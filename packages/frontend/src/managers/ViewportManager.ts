/**
 * ViewportManager
 *
 * Handles viewport-related functionality including:
 * - Responsive layout management
 * - Orientation change detection
 * - Mobile sidebar toggling
 * - Resize event coordination with proper debouncing
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

export interface ViewportChangeEvent extends CustomEvent {
  detail: {
    previous: ViewportState;
    current: ViewportState;
    resized: boolean;
    orientationChanged: boolean;
    sizeChanged: boolean;
  };
}

type ViewportCallback = (
  state: ViewportState,
  event: ViewportChangeEvent,
) => void;

interface ViewportManagerOptions {
  sidebarSelector?: string;
  sidebarToggleSelector?: string;
  smallBreakpoint?: number;
  mediumBreakpoint?: number;
  debounceTime?: number;
}

export class ViewportManager {
  private state: ViewportState;
  private previousState: ViewportState;
  private callbacks: Set<ViewportCallback> = new Set();
  private debouncedViewportChange: (...args: any[]) => void;
  private sidebarElement: HTMLElement | null = null;
  private sidebarToggleElement: HTMLElement | null = null;

  private options: Required<ViewportManagerOptions> = {
    sidebarSelector: ".sidebar",
    sidebarToggleSelector: ".sidebar-toggle",
    smallBreakpoint: 480,
    mediumBreakpoint: 768,
    debounceTime: 100,
  };

  constructor(options?: ViewportManagerOptions) {
    // Merge default options with provided options
    if (options) {
      this.options = { ...this.options, ...options };
    }

    // Initialize state
    this.state = this.getViewportState();
    this.previousState = { ...this.state };

    // Create a single debounced handler for all viewport changes
    this.debouncedViewportChange = Utils.debounce(
      () => this.handleViewportChange(),
      this.options.debounceTime
    );

    // Setup event listeners
    this.setupEventListeners();

    // Initialize mobile UI
    this.setupMobileUI();

    // Apply initial state to DOM
    this.applyStateToDom(this.state);
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

  /**
   * Setup event listeners for resize and orientation change
   */
  private setupEventListeners(): void {
    // Handle resize events with debounce
    window.addEventListener("resize", () => {
      this.debouncedViewportChange();
    });

    // Handle orientation change events
    window.addEventListener("orientationchange", () => {
      // Just use the debounced function - browser will settle dimensions
      this.debouncedViewportChange();
    });

    // Also listen for display-mode changes (for PWA)
    window
      .matchMedia("(display-mode: standalone)")
      .addEventListener("change", () => {
        this.debouncedViewportChange();
      });
  }

  /**
   * Setup mobile UI elements and event handlers
   */
  private setupMobileUI(): void {
    // Get sidebar and toggle elements
    this.sidebarElement = document.querySelector(this.options.sidebarSelector);
    this.sidebarToggleElement = document.querySelector(
      this.options.sidebarToggleSelector,
    );

    // Setup toggle button click handler
    if (this.sidebarToggleElement && this.sidebarElement) {
      this.sidebarToggleElement.addEventListener("click", () => {
        this.toggleSidebar();
      });

      // Close sidebar when clicking outside
      document.addEventListener("click", (event) => {
        if (
          this.sidebarElement &&
          this.sidebarToggleElement &&
          this.isSidebarExpanded() &&
          !this.sidebarElement.contains(event.target as Node) &&
          event.target !== this.sidebarToggleElement
        ) {
          this.collapseSidebar();
        }
      });
    }
  }

  /**
   * Handle viewport changes (resize or orientation change)
   */
  private handleViewportChange(): void {
    // Store previous state
    this.previousState = { ...this.state };

    // Get new state
    this.state = this.getViewportState();

    // Determine what changed
    const orientationChanged =
      this.previousState.orientation !== this.state.orientation;
    const sizeChanged = this.previousState.size !== this.state.size;
    const resized =
      this.previousState.width !== this.state.width ||
      this.previousState.height !== this.state.height;

    // Apply state to DOM
    this.applyStateToDom(this.state);

    // Close sidebar on orientation change
    if (orientationChanged) {
      this.collapseSidebar();

      // Force a reflow to ensure transitions work properly
      void document.body.offsetHeight;
    }

    // Create event object
    const event = new CustomEvent("viewport-change", {
      detail: {
        previous: this.previousState,
        current: this.state,
        resized,
        orientationChanged,
        sizeChanged,
      },
    }) as ViewportChangeEvent;

    // Notify listeners
    this.notifyListeners(event);
  }

  /**
   * Apply viewport state to DOM elements
   */
  private applyStateToDom(state: ViewportState): void {
    // Remove all state classes
    document.body.classList.remove(
      "portrait",
      "landscape",
      "mobile",
      "tablet",
      "desktop",
    );

    // Add current state classes
    document.body.classList.add(state.orientation);

    if (state.isMobile) document.body.classList.add("mobile");
    if (state.isTablet) document.body.classList.add("tablet");
    if (state.isDesktop) document.body.classList.add("desktop");

    // Toggle sidebar visibility
    this.updateSidebarVisibility(state);
  }

  /**
   * Update sidebar visibility based on viewport state
   */
  private updateSidebarVisibility(state: ViewportState): void {
    if (!this.sidebarElement || !this.sidebarToggleElement) return;

    // Show toggle button on mobile and all tablet orientations
    if (state.isMobile || state.isTablet) {
      this.sidebarToggleElement.style.display = "block";

      // For tablets in landscape, position the sidebar differently
      if (state.isTablet && state.orientation === "landscape") {
        this.sidebarElement.classList.add("tablet-landscape");
        this.sidebarElement.classList.remove("tablet-portrait");
      }
      // For tablets in portrait
      else if (state.isTablet) {
        this.sidebarElement.classList.add("tablet-portrait");
        this.sidebarElement.classList.remove("tablet-landscape");
      }
    } else {
      this.sidebarToggleElement.style.display = "none";
      // Ensure sidebar is visible on desktop
      this.sidebarElement.classList.remove("expanded");
      this.sidebarElement.classList.remove(
        "tablet-landscape",
        "tablet-portrait",
      );
    }
  }

  /**
   * Notify all registered listeners about viewport changes
   */
  private notifyListeners(event: ViewportChangeEvent): void {
    this.callbacks.forEach((callback) => {
      try {
        callback(this.state, event);
      } catch (error) {
        console.error("Error in viewport change callback:", error);
      }
    });

    // Also dispatch a DOM event for components that prefer that
    document.dispatchEvent(event);
  }

  /**
   * Toggle sidebar expanded state
   */
  public toggleSidebar(): void {
    if (!this.sidebarElement) return;

    this.sidebarElement.classList.toggle("expanded");
  }

  /**
   * Collapse sidebar
   */
  public collapseSidebar(): void {
    if (!this.sidebarElement) return;

    this.sidebarElement.classList.remove("expanded");
  }

  /**
   * Expand sidebar
   */
  public expandSidebar(): void {
    if (!this.sidebarElement) return;

    this.sidebarElement.classList.add("expanded");
  }

  /**
   * Check if sidebar is expanded
   */
  public isSidebarExpanded(): boolean {
    return this.sidebarElement
      ? this.sidebarElement.classList.contains("expanded")
      : false;
  }

  /**
   * Get current viewport state
   */
  public getState(): ViewportState {
    return { ...this.state };
  }

  /**
   * Register a callback for viewport changes
   */
  public onChange(callback: ViewportCallback): () => void {
    this.callbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Force a viewport state update
   */
  public forceUpdate(): void {
    // Just use the standard debounced function
    this.debouncedViewportChange();
  }
}
