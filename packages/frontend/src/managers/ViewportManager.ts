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
import { DeviceHelper } from "../utils/device/DeviceHelper.js";

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
  private debouncedViewportChange: () => void;
  private sidebarElement: HTMLElement | null = null;
  private sidebarToggleElement: HTMLElement | null = null;

  private options: Required<ViewportManagerOptions> = {
    sidebarSelector: ".sidebar",
    sidebarToggleSelector: ".sidebar-toggle",
    smallBreakpoint: 480,
    mediumBreakpoint: 768,
    debounceTime: 100,
  };

  // Flag to track orientation changes in progress
  private isOrientationChanging = false;

  constructor(options?: ViewportManagerOptions) {
    // Merge default options with provided options
    if (options) {
      this.options = { ...this.options, ...options };
    }

    // Adjust debounce time for iOS devices which need more time
    if (DeviceHelper.isIOS) {
      this.options.debounceTime = Math.max(150, this.options.debounceTime);
    }

    // Initialize state
    this.state = this.getViewportState();
    this.previousState = { ...this.state };

    // Create a single debounced handler for all viewport changes
    this.debouncedViewportChange = Utils.debounce(
      () => this.handleViewportChange(),
      this.options.debounceTime,
    );

    // Setup event listeners
    this.setupEventListeners();

    // Initialize mobile UI
    this.setupMobileUI();

    // Apply initial state to DOM
    this.applyStateToDom(this.state);

    // Force an additional update after a short delay to handle
    // iOS PWA and other delayed initialization scenarios
    setTimeout(() => this.forceUpdate(), 300);
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
      // Workaround for iOS Safari which fires resize events repeatedly during scroll
      if (DeviceHelper.isIOS && !this.isOrientationChanging) {
        // Only process significant size changes on iOS when not changing orientation
        const currentWidth = window.innerWidth;
        const currentHeight = window.innerHeight;
        const widthDiff = Math.abs(currentWidth - this.state.width);
        const heightDiff = Math.abs(currentHeight - this.state.height);

        if (widthDiff < 5 && heightDiff < 50) {
          return; // Ignore small changes that happen during iOS scroll
        }
      }

      this.debouncedViewportChange();
    });

    // Handle orientation change events
    window.addEventListener("orientationchange", () => {
      this.isOrientationChanging = true;

      // Apply immediate class changes for smoother transitions
      document.body.classList.remove("portrait", "landscape");
      document.body.classList.add(
        window.innerHeight > window.innerWidth ? "portrait" : "landscape",
      );

      // Use appropriate debounce time based on device
      const debounceTime = DeviceHelper.isIOS ? 300 : 150;

      // Force reflow on iOS to prevent visual glitches
      if (DeviceHelper.isIOS) {
        void document.body.offsetHeight;
      }

      // Clear the flag and update after appropriate delay
      setTimeout(() => {
        this.isOrientationChanging = false;
        this.handleViewportChange();
      }, debounceTime);
    });

    // Listen for display-mode changes (for PWA)
    window
      .matchMedia("(display-mode: standalone)")
      .addEventListener("change", () => {
        setTimeout(() => this.debouncedViewportChange(), 200);
      });

    // Add iOS-specific handlers for PWA mode
    if (DeviceHelper.isIOS && DeviceHelper.isPWA) {
      // Handle virtual keyboard showing/hiding
      window.addEventListener("focusin", () =>
        setTimeout(() => this.debouncedViewportChange(), 50),
      );
      window.addEventListener("focusout", () =>
        setTimeout(() => this.debouncedViewportChange(), 50),
      );
    }
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

    if (this.sidebarToggleElement && this.sidebarElement) {
      this.sidebarToggleElement.addEventListener("click", () => {
        this.toggleSidebar();
      });

      // Close sidebar when clicking outside - only on mobile or tablet portrait
      document.addEventListener("click", (event) => {
        const state = this.getViewportState();
        const shouldHandleOutsideClick =
          state.isMobile ||
          (state.isTablet && state.orientation === "portrait");

        if (
          shouldHandleOutsideClick &&
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

    // Safety check for zero dimensions which can happen during orientation changes
    if (this.state.width <= 0 || this.state.height <= 0) {
      setTimeout(() => this.forceUpdate(), 100);
      return;
    }

    // Apply state to DOM
    this.applyStateToDom(this.state);

    // Handle sidebar visibility on orientation change
    if (orientationChanged) {
      // Only collapse sidebar on mobile or tablet portrait
      if (
        this.state.isMobile ||
        (this.state.isTablet && this.state.orientation === "portrait")
      ) {
        this.collapseSidebar();
      } else if (
        this.state.isTablet &&
        this.state.orientation === "landscape"
      ) {
        // Ensure sidebar is visible in tablet landscape
        this.expandSidebar();
      }

      // Force a reflow to ensure transitions work properly
      void document.body.offsetHeight;

      // Extra handling for iOS which needs help with orientation changes
      if (DeviceHelper.isIOS) {
        setTimeout(() => {
          const currentState = this.getViewportState();
          if (
            currentState.width !== this.state.width ||
            currentState.height !== this.state.height
          ) {
            this.forceUpdate();
          }
        }, 300);
      }
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

    // DeviceHelper already adds these classes

    // Handle initial sidebar display after class changes
    if (
      state.isDesktop ||
      (state.isTablet && state.orientation === "landscape")
    ) {
      // Desktop and tablet landscape should always show sidebar
      if (this.sidebarElement) {
        // Use transform to ensure hardware acceleration
        this.sidebarElement.style.transform = "translateX(0)";
        // For iOS sometimes we need to force reflow
        if (DeviceHelper.isIOS) {
          void this.sidebarElement.offsetHeight;
        }
      }
    }

    // Toggle sidebar visibility
    this.updateSidebarVisibility(state);
  }

  /**
   * Update sidebar visibility based on viewport state
   */
  private updateSidebarVisibility(state: ViewportState): void {
    if (!this.sidebarElement || !this.sidebarToggleElement) return;

    // Show toggle button only on mobile and tablet portrait
    if (
      state.isMobile ||
      (state.isTablet && state.orientation === "portrait")
    ) {
      this.sidebarToggleElement.style.display = "block";
    } else {
      this.sidebarToggleElement.style.display = "none";
    }

    // Handle tablet modes
    if (state.isTablet) {
      if (state.orientation === "landscape") {
        // For tablets in landscape, always show sidebar
        this.sidebarElement.classList.add("tablet-landscape");
        this.sidebarElement.classList.remove("tablet-portrait");
        this.expandSidebar(); // Always keep expanded in landscape
      } else {
        // For tablets in portrait, use collapsible sidebar
        this.sidebarElement.classList.add("tablet-portrait");
        this.sidebarElement.classList.remove("tablet-landscape");
      }
    } else if (state.isDesktop) {
      // Desktop always shows sidebar
      this.sidebarElement.classList.remove(
        "tablet-landscape",
        "tablet-portrait",
        "expanded", // No need for expanded class on desktop
      );
    } else if (state.isMobile) {
      // Mobile uses its own classes
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
    // Bypass debouncing for immediate update
    this.handleViewportChange();
  }

  /**
   * Reset viewport manager to handle potential device issues
   */
  public reset(): void {
    this.previousState = { ...this.state };
    this.isOrientationChanging = false;

    // Reset any inline styles
    if (this.sidebarElement) {
      this.sidebarElement.style.transform = "";
    }

    // Force immediate update and another after a delay
    this.forceUpdate();
    setTimeout(() => this.forceUpdate(), 100);
  }
}
