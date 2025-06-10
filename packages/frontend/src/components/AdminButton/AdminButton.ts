/**
 * AdminButton Component
 *
 * A button that toggles admin mode in the application.
 * Displays a settings gear icon and changes appearance when admin mode is active.
 */

import "./AdminButton.css";

export interface AdminButtonConfig {
  /** Initial active state */
  isActive?: boolean;
  /** Callback when button is clicked */
  onClick: () => void;
}

export class AdminButton extends HTMLElement {
  public config: AdminButtonConfig;
  private button?: HTMLButtonElement;

  static get observedAttributes() {
    return ["active"];
  }

  constructor(config: AdminButtonConfig) {
    super();
    this.config = {
      isActive: false,
      ...config,
    };

    this.render();
    this.setupEventListeners();
  }

  /**
   * Create or update the button element
   */
  private render(): void {
    this.classList.add("admin-button-container");

    // If a button already exists, just update its class
    if (this.button && this.contains(this.button)) {
      this.button.className = `admin-button ${this.config.isActive ? "active" : ""}`;
      return;
    }

    // Remove any existing children (just in case)
    this.innerHTML = "";

    // Create new button
    this.button = document.createElement("button");
    this.button.className = `admin-button ${this.config.isActive ? "active" : ""}`;
    this.button.setAttribute("aria-label", "Admin settings");
    this.button.textContent = "⚙️";

    this.appendChild(this.button);
  }

  /**
   * Event handler for click events
   */
  private handleClick = (): void => {
    this.config.onClick();
  };

  /**
   * Event handler for touchstart events
   */
  private handleTouchStart = (): void => {
    this.button?.classList.add("touch-active");
  };

  /**
   * Event handler for touchend events
   */
  private handleTouchEnd = (): void => {
    setTimeout(() => {
      this.button?.classList.remove("touch-active");
    }, 150);
  };

  /**
   * Event handler for touchcancel events
   */
  private handleTouchCancel = (): void => {
    this.button?.classList.remove("touch-active");
  };

  /**
   * Set up event listeners for the button
   */
  private setupEventListeners(): void {
    // Click handler
    this.button?.addEventListener("click", this.handleClick);

    // Touch feedback for mobile
    this.button?.addEventListener("touchstart", this.handleTouchStart, {
      passive: true,
    });
    this.button?.addEventListener("touchend", this.handleTouchEnd, {
      passive: true,
    });
    this.button?.addEventListener("touchcancel", this.handleTouchCancel, {
      passive: true,
    });
  }

  /**
   * Set the active state of the button
   */
  setActive(isActive: boolean): void {
    this.config.isActive = isActive;
    this.button?.classList.toggle("active", isActive);
  }

  /**
   * Check if the button is in active state
   */
  isActive(): boolean {
    return this.config.isActive || false;
  }

  /**
   * Handle attribute changes
   */
  attributeChangedCallback(
    name: string,
    oldValue: string,
    newValue: string,
  ): void {
    if (name === "active" && oldValue !== newValue) {
      this.setActive(newValue === "true");
    }
  }

  /**
   * Called when element is added to DOM
   */
  connectedCallback(): void {
    if (this.hasAttribute("active")) {
      this.setActive(this.getAttribute("active") === "true");
    }
  }

  /**
   * Cleanup event listeners when component is removed
   */
  disconnectedCallback(): void {
    // Remove event listeners with proper references
    if (this.button) {
      this.button.removeEventListener("click", this.handleClick);
      this.button.removeEventListener("touchstart", this.handleTouchStart);
      this.button.removeEventListener("touchend", this.handleTouchEnd);
      this.button.removeEventListener("touchcancel", this.handleTouchCancel);
    }
  }
}

// Register the custom element before any instances are created
customElements.define("admin-button", AdminButton);
