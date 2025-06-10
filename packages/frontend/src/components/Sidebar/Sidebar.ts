/**
 * Sidebar Component
 *
 * A lightweight component that handles sidebar toggling, expansion and collapse.
 * This component follows a CSS-first approach with minimal JavaScript for interaction.
 */

import { DeviceHelper } from "../../utils/device/DeviceHelper.js";
import "./Sidebar.css";

export interface SidebarOptions {
  /** Selector for the sidebar element */
  sidebarSelector: string;
  /** Selector for the toggle button */
  toggleSelector: string;
  /** Selector for the main content area (for overlay) */
  contentSelector: string;
  /** CSS class added when sidebar is expanded */
  expandedClass: string;
  /** Media query that determines when sidebar is permanently visible */
  permanentMediaQuery: string;
}

export class Sidebar {
  private sidebar: HTMLElement | null = null;
  private toggleButton: HTMLElement | null = null;
  private contentArea: HTMLElement | null = null;
  private permanentMediaQuery: MediaQueryList;
  private options: SidebarOptions;
  private documentClickListener: ((e: MouseEvent) => void) | null = null;
  private isPermanentlyVisible: boolean = false;

  constructor(options?: Partial<SidebarOptions>) {
    // Default options
    this.options = {
      sidebarSelector: ".sidebar",
      toggleSelector: ".sidebar-toggle",
      contentSelector: ".main-content",
      expandedClass: "expanded",
      permanentMediaQuery: "(min-width: 768px) and (orientation: landscape)", // Tablet landscape and above
      ...options,
    };

    // Initialize media query listener
    this.permanentMediaQuery = window.matchMedia(
      this.options.permanentMediaQuery,
    );

    // Initialize elements and event listeners
    this.initialize();
  }

  /**
   * Initialize sidebar manager
   */
  private initialize(): void {
    // Find elements
    this.sidebar = document.querySelector(this.options.sidebarSelector);
    this.toggleButton = document.querySelector(this.options.toggleSelector);
    this.contentArea = document.querySelector(this.options.contentSelector);

    if (!this.sidebar || !this.toggleButton) {
      console.warn("Sidebar: Element or toggle button not found");
      return;
    }

    // Update initial state based on media query
    this.isPermanentlyVisible = this.permanentMediaQuery.matches;
    this.updateSidebarVisibility();

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for sidebar interactions
   */
  private toggleClickHandler = (e: Event): void => {
    e.preventDefault();
    e.stopPropagation();
    this.toggle();
  };

  private touchStartHandler = (e: TouchEvent): void => {
    e.stopPropagation();
    // Add visible feedback class
    this.toggleButton?.classList.add("touch-active");
  };

  private touchEndHandler = (e: TouchEvent): void => {
    e.stopPropagation();
    this.toggleButton?.classList.remove("touch-active");
  };

  private setupEventListeners(): void {
    if (!this.sidebar || !this.toggleButton) return;

    // Toggle button click - enhanced for iOS compatibility
    this.toggleButton.addEventListener("click", this.toggleClickHandler, {
      passive: false,
    });

    // Add explicit touch events for iOS devices
    this.toggleButton.addEventListener("touchstart", this.touchStartHandler, {
      passive: false,
    });

    this.toggleButton.addEventListener("touchend", this.touchEndHandler, {
      passive: false,
    });

    // Media query change
    this.permanentMediaQuery.addEventListener("change", (e) => {
      this.isPermanentlyVisible = e.matches;
      this.updateSidebarVisibility();
    });

    // Handle click outside sidebar on mobile/tablet
    this.documentClickListener = (e: MouseEvent) => {
      if (this.isPermanentlyVisible) return;

      // Skip if the sidebar isn't expanded
      if (!this.isExpanded()) return;

      // Check if the click was outside the sidebar and toggle button
      const target = e.target as Node;
      if (
        this.sidebar &&
        this.toggleButton &&
        !this.sidebar.contains(target) &&
        target !== this.toggleButton
      ) {
        this.collapse();
      }
    };

    document.addEventListener("click", this.documentClickListener);

    // Handle ESC key to close sidebar
    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        this.isExpanded() &&
        !this.isPermanentlyVisible
      ) {
        this.collapse();
      }
    });

    // Add extra handlers for touch events on mobile
    if (DeviceHelper.isMobile) {
      this.setupMobileTouchHandlers();
    }
  }

  /**
   * Set up additional touch handlers for mobile devices
   */
  private sidebarTouchHandler = (e: TouchEvent): void => {
    // Prevent propagation to avoid triggering document click handler
    e.stopPropagation();
    if (DeviceHelper.isIOS) {
      // Prevent any default iOS behaviors
      e.preventDefault();
    }
  };

  private contentTouchStartHandler = (e: TouchEvent): void => {
    // Store references to class variables for the event handlers
    if (!this.touchData) {
      this.touchData = { startX: 0, startTime: 0, isSwiping: false };
    }

    const touch = e.touches[0];
    if (touch?.clientX) {
      this.touchData.startX = touch.clientX;
      this.touchData.startTime = Date.now();

      // Only track swipes starting from the right edge (for our right-side sidebar)
      this.touchData.isSwiping = this.touchData.startX > window.innerWidth - 30;
    }
  };

  private contentTouchMoveHandler = (e: TouchEvent): void => {
    if (!this.touchData?.isSwiping || !DeviceHelper.isIOS) return;

    const touch = e.touches[0];
    if (touch?.clientX) {
      const deltaX = this.touchData.startX - touch.clientX;
      // If clearly a horizontal swipe, prevent scrolling
      if (Math.abs(deltaX) > 10) {
        e.preventDefault();
      }
    }
  };

  private contentTouchEndHandler = (e: TouchEvent): void => {
    if (!this.touchData?.isSwiping) return;

    const touch = e.changedTouches[0];
    if (touch?.clientX) {
      const endX = touch.clientX;
      const deltaX = this.touchData.startX - endX; // Reversed for right side
      const deltaTime = Date.now() - this.touchData.startTime;

      // Handle edge swipes from right edge
      if (
        this.touchData.startX > window.innerWidth - 30 && // Right edge
        deltaX > 70 && // Swiped left enough
        deltaTime < 300 && // Fast enough
        !this.isExpanded() &&
        !this.isPermanentlyVisible
      ) {
        this.expand();
        e.preventDefault(); // Prevent any default behavior
      }
    }

    // Reset swipe tracking
    this.touchData.isSwiping = false;
  };

  // Touch data for swipe gestures
  private touchData: {
    startX: number;
    startTime: number;
    isSwiping: boolean;
  } | null = null;

  private setupMobileTouchHandlers(): void {
    if (!this.sidebar) return;

    // Use touchstart for immediate response on mobile
    this.sidebar.addEventListener(
      "touchstart",
      this.sidebarTouchHandler,
      // Use non-passive for iOS to allow preventDefault
      { passive: !DeviceHelper.isIOS },
    );

    // Allow edge swiping to open sidebar - with iOS enhancements
    if (this.contentArea) {
      this.contentArea.addEventListener(
        "touchstart",
        this.contentTouchStartHandler,
        { passive: true },
      );

      // Add touchmove handler to improve iOS gesture detection
      this.contentArea.addEventListener(
        "touchmove",
        this.contentTouchMoveHandler,
        { passive: !DeviceHelper.isIOS }, // non-passive for iOS
      );

      this.contentArea.addEventListener(
        "touchend",
        this.contentTouchEndHandler,
        { passive: !DeviceHelper.isIOS }, // non-passive for iOS
      );
    }
  }

  /**
   * Update sidebar visibility based on viewport size
   */
  private updateSidebarVisibility = (): void => {
    if (!this.sidebar || !this.toggleButton) return;

    // Hide toggle button when sidebar is permanently visible
    this.toggleButton.style.display = this.isPermanentlyVisible
      ? "none"
      : "flex";

    // Add iOS-specific attributes for better touch handling
    if (DeviceHelper.isIOS) {
      this.toggleButton.setAttribute("role", "button");
      this.toggleButton.setAttribute("aria-label", "Toggle sidebar");

      // Force hardware acceleration for better performance
      this.toggleButton.style.transform = "translateZ(0)";
    }

    // Always expand sidebar when permanently visible
    if (this.isPermanentlyVisible) {
      this.expand();
    } else {
      // On mobile/tablet, default to collapsed
      this.collapse();
    }
  };

  /**
   * Toggle sidebar expanded/collapsed state
   */
  public toggle(): void {
    if (!this.sidebar) return;

    if (this.isExpanded()) {
      this.collapse();
    } else {
      this.expand();
    }
  }

  /**
   * Expand the sidebar
   */
  public expand(): void {
    if (!this.sidebar) return;
    this.sidebar.classList.add(this.options.expandedClass);

    // Dispatch custom event
    this.sidebar.dispatchEvent(
      new CustomEvent("sidebar-expanded", {
        bubbles: true,
        detail: { isPermanent: this.isPermanentlyVisible },
      }),
    );
  }

  /**
   * Collapse the sidebar
   */
  public collapse(): void {
    if (!this.sidebar || this.isPermanentlyVisible) return;
    this.sidebar.classList.remove(this.options.expandedClass);

    // Dispatch custom event
    this.sidebar.dispatchEvent(
      new CustomEvent("sidebar-collapsed", {
        bubbles: true,
      }),
    );
  }

  /**
   * Check if sidebar is currently expanded
   */
  public isExpanded(): boolean {
    return this.sidebar
      ? this.sidebar.classList.contains(this.options.expandedClass)
      : false;
  }

  /**
   * Check if sidebar is permanently visible (based on media query)
   */
  public isPermanent(): boolean {
    return this.isPermanentlyVisible;
  }

  /**
   * Force a refresh of the sidebar state
   */
  public refresh(): void {
    this.isPermanentlyVisible = this.permanentMediaQuery.matches;
    this.updateSidebarVisibility();
  }

  /**
   * Clean up event listeners
   */
  public destroy(): void {
    if (this.documentClickListener) {
      document.removeEventListener("click", this.documentClickListener);
      this.documentClickListener = null;
    }

    // Remove event listeners with proper references
    if (this.toggleButton) {
      this.toggleButton.removeEventListener("click", this.toggleClickHandler);
      this.toggleButton.removeEventListener(
        "touchstart",
        this.touchStartHandler,
      );
      this.toggleButton.removeEventListener("touchend", this.touchEndHandler);
    }

    // Remove media query listener properly
    // Note: Modern browsers support removeEventListener for MediaQueryList
    try {
      // Use type assertion to handle the potentially incompatible types
      (this.permanentMediaQuery as any).removeEventListener(
        "change",
        this.updateSidebarVisibility,
      );
    } catch (e) {
      // Fallback for older browsers
      console.warn("Could not remove media query listener:", e);
    }
  }
}
