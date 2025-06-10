/**
 * SidebarElement Component
 *
 * A custom element that provides a responsive sidebar with support for mobile and desktop layouts.
 * Includes touch event handling, media query detection, and swipe gestures.
 */

import "./SidebarElement.css";

export interface SidebarOptions {
  /** Media query string that determines when sidebar is permanently visible */
  permanentMediaQuery?: string;
  /** Class to apply when sidebar is expanded */
  expandedClass?: string;
  /** Whether to show toggle button */
  showToggleButton?: boolean;
}

export class SidebarElement extends HTMLElement {
  // DOM element references
  private toggleButton: HTMLButtonElement | null = null;
  private overlay: HTMLDivElement | null = null;

  // State management
  private isPermanentlyVisible = false;
  private mediaQuery: MediaQueryList;

  // Touch handling data
  private touchData = {
    startX: 0,
    startTime: 0,
    isSwiping: false,
  };

  // Configuration
  private options: Required<SidebarOptions> = {
    permanentMediaQuery: "(min-width: 768px) and (orientation: landscape)",
    expandedClass: "expanded",
    showToggleButton: true,
  };

  // Event handlers
  private handleMediaQueryChange = (e: MediaQueryListEvent): void => {
    this.isPermanentlyVisible = e.matches;
    this.updateVisibility();
  };

  static get observedAttributes() {
    return ["expanded", "permanent-query", "toggle-visible"];
  }

  constructor() {
    super();

    // Initialize with default options
    this.mediaQuery = window.matchMedia(this.options.permanentMediaQuery);
    this.isPermanentlyVisible = this.mediaQuery.matches;
  }

  /**
   * Called when the element is added to the DOM
   */
  connectedCallback(): void {
    // Process attributes
    if (this.hasAttribute("permanent-query")) {
      this.options.permanentMediaQuery =
        this.getAttribute("permanent-query") ||
        this.options.permanentMediaQuery;
      this.mediaQuery = window.matchMedia(this.options.permanentMediaQuery);
      this.isPermanentlyVisible = this.mediaQuery.matches;
    }

    if (this.hasAttribute("expanded-class")) {
      this.options.expandedClass =
        this.getAttribute("expanded-class") || this.options.expandedClass;
    }

    this.options.showToggleButton = this.hasAttribute("toggle-visible")
      ? this.getAttribute("toggle-visible") !== "false"
      : this.options.showToggleButton;

    // Initialize UI
    this.render();
    this.setupEventListeners();
    this.updateVisibility();
  }

  /**
   * Called when component attributes change
   */
  attributeChangedCallback(
    name: string,
    oldValue: string,
    newValue: string,
  ): void {
    if (oldValue === newValue) return;

    switch (name) {
      case "expanded":
        if (newValue === "true") {
          this.expand();
        } else {
          this.collapse();
        }
        break;

      case "permanent-query":
        this.options.permanentMediaQuery =
          newValue || this.options.permanentMediaQuery;
        // Remove old listener
        this.mediaQuery.removeEventListener(
          "change",
          this.handleMediaQueryChange,
        );
        // Set up new one
        this.mediaQuery = window.matchMedia(this.options.permanentMediaQuery);
        this.isPermanentlyVisible = this.mediaQuery.matches;
        this.mediaQuery.addEventListener("change", this.handleMediaQueryChange);
        this.updateVisibility();
        break;

      case "toggle-visible":
        this.options.showToggleButton = newValue !== "false";
        if (this.toggleButton) {
          this.toggleButton.style.display = this.options.showToggleButton
            ? ""
            : "none";
        }
        break;
    }
  }

  /**
   * Create the initial DOM structure
   */
  private render(): void {
    // Add an overlay element for mobile view
    if (!this.overlay) {
      this.overlay = document.createElement("div");
      this.overlay.className = "sidebar-overlay";
      this.overlay.addEventListener("click", this.handleOverlayClick);
      document.body.appendChild(this.overlay);
    }

    // Add toggle button if it doesn't exist
    if (!this.toggleButton && this.options.showToggleButton) {
      this.toggleButton = document.createElement("button");
      this.toggleButton.className = "sidebar-toggle";
      this.toggleButton.setAttribute("aria-label", "Toggle sidebar");
      this.toggleButton.setAttribute("aria-controls", this.id || "sidebar");
      this.toggleButton.setAttribute("aria-expanded", "false");
      this.toggleButton.innerHTML = "📊";
      document.body.appendChild(this.toggleButton);
    }
  }

  /**
   * Set up all event listeners
   */
  private setupEventListeners(): void {
    // Toggle button click
    if (this.toggleButton) {
      this.toggleButton.addEventListener("click", this.handleToggleClick);

      // Touch events for mobile
      this.toggleButton.addEventListener(
        "touchstart",
        this.handleButtonTouchStart,
        { passive: false },
      );
      this.toggleButton.addEventListener(
        "touchend",
        this.handleButtonTouchEnd,
        { passive: false },
      );
    }

    // Media query change
    this.mediaQuery.addEventListener("change", this.handleMediaQueryChange);

    // Keyboard events
    document.addEventListener("keydown", this.handleKeyDown);

    // Touch events for swipe gestures
    this.addEventListener("touchstart", this.handleSidebarTouchStart, {
      passive: true,
    });
    document.addEventListener("touchstart", this.handleDocumentTouchStart, {
      passive: true,
    });
    document.addEventListener("touchmove", this.handleDocumentTouchMove, {
      passive: false,
    });
    document.addEventListener("touchend", this.handleDocumentTouchEnd, {
      passive: true,
    });
  }

  /**
   * Event Handlers
   */
  private handleToggleClick = (e: Event): void => {
    e.preventDefault();
    e.stopPropagation();
    this.toggle();
  };

  private handleButtonTouchStart = (e: TouchEvent): void => {
    e.stopPropagation();

    if (this.toggleButton) {
      this.toggleButton.classList.add("touch-active");
    }
  };

  private handleButtonTouchEnd = (e: TouchEvent): void => {
    e.stopPropagation();

    if (this.toggleButton) {
      this.toggleButton?.classList.remove("touch-active");
    }
  };

  private handleOverlayClick = (e: Event): void => {
    e.preventDefault();
    this.collapse();
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape" && !this.isPermanentlyVisible && this.isExpanded()) {
      this.collapse();
    }
  };

  private handleSidebarTouchStart = (e: TouchEvent): void => {
    // Prevent event bubbling to document handler
    e.stopPropagation();
  };

  private handleDocumentTouchStart = (e: TouchEvent): void => {
    const touch = e.touches[0];
    if (!touch) return;

    this.touchData.startX = touch.clientX;
    this.touchData.startTime = Date.now();

    // Determine if this is a potential swipe to open/close sidebar
    if (!this.isPermanentlyVisible) {
      // For opening: track swipes from right edge (for right sidebar)
      // For closing: track swipes from anywhere in the sidebar
      if (
        (!this.isExpanded() && touch.clientX > window.innerWidth - 30) ||
        (this.isExpanded() && this.contains(e.target as Node))
      ) {
        this.touchData.isSwiping = true;
      }
    }
  };

  private handleDocumentTouchMove = (e: TouchEvent): void => {
    if (!this.touchData.isSwiping) return;

    const touch = e.touches[0];
    if (!touch) return;

    const currentX = touch.clientX;
    const deltaX = currentX - this.touchData.startX;

    // Prevent scrolling during swipe
    if (Math.abs(deltaX) > 10) {
      e.preventDefault();
    }
  };

  private handleDocumentTouchEnd = (e: TouchEvent): void => {
    if (!this.touchData.isSwiping) return;

    const touch = e.changedTouches[0];
    if (!touch) return;

    const endX = touch.clientX;
    const deltaX = endX - this.touchData.startX;
    const deltaTime = Date.now() - this.touchData.startTime;

    // For right sidebar:
    // - Swipe left to close
    // - Swipe right to open
    if (Math.abs(deltaX) > 70 && deltaTime < 300) {
      if (deltaX < 0 && this.isExpanded()) {
        // Swipe left to close
        this.collapse();
      } else if (deltaX > 0 && !this.isExpanded()) {
        // Swipe right to open
        this.expand();
      }
    }

    // Reset swipe tracking
    this.touchData.isSwiping = false;
  };

  /**
   * Update sidebar visibility based on current state
   */
  private updateVisibility(): void {
    if (this.toggleButton) {
      // Hide toggle button when sidebar is permanently visible
      this.toggleButton.style.display =
        this.isPermanentlyVisible || !this.options.showToggleButton
          ? "none"
          : "flex";

      // Update ARIA state
      this.toggleButton.setAttribute(
        "aria-expanded",
        this.isExpanded() ? "true" : "false",
      );
    }

    // Always expand sidebar when permanently visible
    if (this.isPermanentlyVisible) {
      this.expand(false); // Silent expand - don't trigger events
    } else if (
      !this.hasAttribute("expanded") ||
      this.getAttribute("expanded") !== "true"
    ) {
      // On mobile/tablet, collapse by default unless explicitly set to expanded
      this.collapse(false); // Silent collapse - don't trigger events
    }
  }

  /**
   * Public API methods
   */

  /**
   * Toggle sidebar expanded/collapsed state
   */
  public toggle(): void {
    if (this.isExpanded()) {
      this.collapse();
    } else {
      this.expand();
    }
  }

  /**
   * Expand the sidebar
   * @param triggerEvent Whether to trigger the expanded event (default: true)
   */
  public expand(triggerEvent = true): void {
    this.classList.add(this.options.expandedClass);
    this.setAttribute("expanded", "true");

    if (this.overlay) {
      this.overlay.classList.add("visible");
    }

    if (this.toggleButton) {
      this.toggleButton.setAttribute("aria-expanded", "true");
    }

    // Dispatch custom event
    if (triggerEvent) {
      this.dispatchEvent(
        new CustomEvent("sidebar-expanded", {
          bubbles: true,
          detail: { isPermanent: this.isPermanentlyVisible },
        }),
      );
    }
  }

  /**
   * Collapse the sidebar
   * @param triggerEvent Whether to trigger the collapsed event (default: true)
   */
  public collapse(triggerEvent = true): void {
    if (this.isPermanentlyVisible) return;

    this.classList.remove(this.options.expandedClass);
    this.setAttribute("expanded", "false");

    if (this.overlay) {
      this.overlay.classList.remove("visible");
    }

    if (this.toggleButton) {
      this.toggleButton.setAttribute("aria-expanded", "false");
    }

    // Dispatch custom event
    if (triggerEvent) {
      this.dispatchEvent(
        new CustomEvent("sidebar-collapsed", {
          bubbles: true,
        }),
      );
    }
  }

  /**
   * Check if sidebar is currently expanded
   */
  public isExpanded(): boolean {
    return this.classList.contains(this.options.expandedClass);
  }

  /**
   * Check if sidebar is permanently visible
   */
  public isPermanent(): boolean {
    return this.isPermanentlyVisible;
  }

  /**
   * Force a refresh of the sidebar state
   */
  public refresh(): void {
    this.isPermanentlyVisible = this.mediaQuery.matches;
    this.updateVisibility();
  }

  /**
   * Clean up event listeners when removed from DOM
   */
  disconnectedCallback(): void {
    // Remove media query listener
    this.mediaQuery.removeEventListener("change", this.handleMediaQueryChange);

    // Remove document-level listeners
    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("touchstart", this.handleDocumentTouchStart);
    document.removeEventListener("touchmove", this.handleDocumentTouchMove);
    document.removeEventListener("touchend", this.handleDocumentTouchEnd);

    // Remove toggle button listeners
    if (this.toggleButton) {
      this.toggleButton.removeEventListener("click", this.handleToggleClick);
      this.toggleButton.removeEventListener(
        "touchstart",
        this.handleButtonTouchStart,
      );
      this.toggleButton.removeEventListener(
        "touchend",
        this.handleButtonTouchEnd,
      );

      // Optionally remove the button from DOM
      if (this.toggleButton.parentNode) {
        this.toggleButton.parentNode.removeChild(this.toggleButton);
      }
    }

    // Remove overlay
    if (this.overlay) {
      this.overlay.removeEventListener("click", this.handleOverlayClick);

      if (this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
    }

    // Clear references
    this.toggleButton = null;
    this.overlay = null;
  }
}

// Register the custom element
customElements.define("sidebar-element", SidebarElement);
