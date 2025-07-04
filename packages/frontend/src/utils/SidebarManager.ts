/**
 * SidebarManager
 *
 * A lightweight utility that handles sidebar toggling, expansion and collapse.
 * This class follows a CSS-first approach with minimal JavaScript for interaction.
 */

import { DeviceHelper } from "./device/DeviceHelper.js";

export interface SidebarManagerOptions {
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

export class SidebarManager {
  private sidebar: HTMLElement | null = null;
  private toggleButton: HTMLElement | null = null;
  private contentArea: HTMLElement | null = null;
  private permanentMediaQuery: MediaQueryList;
  private options: SidebarManagerOptions;
  private documentClickListener: ((e: MouseEvent) => void) | null = null;
  private isPermanentlyVisible: boolean = false;

  constructor(options?: Partial<SidebarManagerOptions>) {
    // Default options
    this.options = {
      sidebarSelector: ".sidebar",
      toggleSelector: ".sidebar-toggle",
      contentSelector: ".main-content",
      expandedClass: "expanded",
      permanentMediaQuery: "(min-width: 992px)", // Desktop and above
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
      console.warn("SidebarManager: Sidebar or toggle button not found");
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
  private setupEventListeners(): void {
    if (!this.sidebar || !this.toggleButton) return;

    // Toggle button click
    this.toggleButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggle();
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
  private setupMobileTouchHandlers(): void {
    if (!this.sidebar) return;

    // Use touchstart for immediate response on mobile
    this.sidebar.addEventListener(
      "touchstart",
      (e) => {
        // Prevent propagation to avoid triggering document click handler
        e.stopPropagation();
      },
      { passive: true },
    );

    // Allow edge swiping to open sidebar
    if (this.contentArea) {
      let startX = 0;
      let startTime = 0;

      this.contentArea.addEventListener(
        "touchstart",
        (e) => {
          const [touch] = e.touches;
          if (touch?.clientX) {
            startX = touch.clientX;
            startTime = Date.now();
          }
        },
        { passive: true },
      );

      this.contentArea.addEventListener(
        "touchend",
        (e) => {
          const [touch] = e.changedTouches;
          if (touch?.clientX) {
            const endX = touch.clientX;
            const deltaX = endX - startX;
            const deltaTime = Date.now() - startTime;

            // Only handle edge swipes (starting from left edge)
            if (
              startX < 30 &&
              deltaX > 70 &&
              deltaTime < 300 &&
              !this.isExpanded() &&
              !this.isPermanentlyVisible
            ) {
              this.expand();
            }
          }
        },
        { passive: true },
      );
    }
  }

  /**
   * Update sidebar visibility based on viewport size
   */
  private updateSidebarVisibility(): void {
    if (!this.sidebar || !this.toggleButton) return;

    // Hide toggle button when sidebar is permanently visible
    this.toggleButton.style.display = this.isPermanentlyVisible
      ? "none"
      : "flex";

    // Always expand sidebar when permanently visible
    if (this.isPermanentlyVisible) {
      this.expand();
    } else {
      // On mobile/tablet, default to collapsed
      this.collapse();
    }
  }

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

    // Remove media query listener
    this.permanentMediaQuery.removeEventListener("change", () => {});

    // Remove toggle button listener
    if (this.toggleButton) {
      this.toggleButton.removeEventListener("click", () => {});
    }
  }
}
