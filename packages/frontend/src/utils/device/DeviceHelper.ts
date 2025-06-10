/**
 * DeviceHelper
 *
 * Lightweight utility for device detection and mobile-specific fixes.
 */

export class DeviceHelper {
  // Device detection (calculated once on first access)
  private static _isIOS: boolean | null = null;
  private static _isAndroid: boolean | null = null;
  private static _isMobile: boolean | null = null;
  private static _isPWA: boolean | null = null;

  /**
   * Check if the current device is iOS (iPhone, iPad, iPod)
   */
  static get isIOS(): boolean {
    if (this._isIOS === null) {
      // MSStream is a property present in IE/Edge but not in iOS
      const windowWithMSStream = window as { MSStream?: unknown };
      this._isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !windowWithMSStream.MSStream;
    }
    return this._isIOS;
  }

  /**
   * Check if the current device is Android
   */
  static get isAndroid(): boolean {
    if (this._isAndroid === null) {
      this._isAndroid = /Android/.test(navigator.userAgent);
    }
    return this._isAndroid;
  }

  /**
   * Check if the current device is a mobile device
   */
  static get isMobile(): boolean {
    if (this._isMobile === null) {
      this._isMobile =
        this.isIOS ||
        this.isAndroid ||
        /Mobile|Tablet|Android|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        );
    }
    return this._isMobile;
  }

  /**
   * Check if the app is running in PWA mode (standalone)
   */
  static get isPWA(): boolean {
    if (this._isPWA === null) {
      // Safari iOS-specific standalone property
      const navigatorWithStandalone = navigator as { standalone?: boolean };
      this._isPWA =
        window.matchMedia("(display-mode: standalone)").matches ||
        navigatorWithStandalone.standalone === true;
    }
    return this._isPWA;
  }

  /**
   * Fix touch event handling for interactive elements
   * @param element Element to apply touch event fixes to
   */
  static fixTouchEvents(element: HTMLElement): void {
    if (!element) return;

    // Add -webkit-tap-highlight-color
    (
      element.style as CSSStyleDeclaration & { webkitTapHighlightColor: string }
    ).webkitTapHighlightColor = "transparent";

    // For clickable elements, prevent ghost clicks and improve responsiveness
    if (
      element.hasAttribute("data-clickable") ||
      element.tagName === "BUTTON" ||
      element.tagName === "A" ||
      element.classList.contains("btn") ||
      element.classList.contains("sensor-item")
    ) {
      // Store state to prevent duplicate events
      let lastTouchTime = 0;

      element.addEventListener(
        "touchstart",
        () => {
          lastTouchTime = Date.now();
          element.classList.add("touch-active");
        },
        { passive: true },
      );

      element.addEventListener(
        "touchend",
        () => {
          // Remove active state after short delay for visual feedback
          setTimeout(() => {
            element.classList.remove("touch-active");
          }, 150);
        },
        { passive: true },
      );

      element.addEventListener(
        "touchcancel",
        () => {
          element.classList.remove("touch-active");
        },
        { passive: true },
      );

      // Prevent duplicate events on iOS Safari
      element.addEventListener("click", (e) => {
        const now = Date.now();
        if (now - lastTouchTime < 300 && e.detail > 1) {
          e.preventDefault();
          e.stopPropagation();
        }
      });
    }
  }

  /**
   * Fix all touch events for a container and its children
   * @param container Container element
   * @param selector CSS selector to filter which elements to fix
   */
  static fixAllTouchEvents(
    container: HTMLElement = document.body,
    selector: string = "[data-clickable], button, a, .btn, .sensor-item",
  ): void {
    // Fix the container if it matches
    if (container.matches(selector)) {
      this.fixTouchEvents(container);
    }

    // Fix all matching elements inside the container
    container.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      this.fixTouchEvents(el);
    });
  }

  /**
   * Apply core device-specific fixes
   */
  static applyAllFixes(): void {
    // Add device classes to the body for CSS targeting
    document.body.classList.toggle("ios-device", this.isIOS);
    document.body.classList.toggle("android-device", this.isAndroid);
    document.body.classList.toggle("mobile-device", this.isMobile);
    document.body.classList.toggle("pwa-mode", this.isPWA);

    // Fix touch events for all interactive elements
    this.fixAllTouchEvents();

    // Apply global touch event handling
    this.handleGlobalTouchEvents();

    // Apply orientation change handling
    this.handleOrientationChanges();

    // iOS PWA height fix
    if (this.isIOS && this.isPWA) {
      this.fixIOSPWAHeight();
      window.addEventListener("resize", () => this.fixIOSPWAHeight());
    }

    // Fix iOS scroll position on orientation change
    if (this.isIOS) {
      window.addEventListener("orientationchange", () => {
        const scrollY = window.scrollY;
        setTimeout(() => window.scrollTo(0, scrollY), 100);
      });
    }

    // Prevent pull-to-refresh on Android
    if (this.isAndroid) {
      document.body.addEventListener(
        "touchmove",
        (e) => {
          if (
            window.scrollY === 0 &&
            e.touches[0] &&
            e.touches[0].clientY > 5
          ) {
            e.preventDefault();
          }
        },
        { passive: false },
      );
    }
  }
  /**
   * Fix for iOS PWA height calculation
   */
  private static fixIOSPWAHeight(): void {
    const height = window.innerHeight;
    document.documentElement.style.height = `${height}px`;
    document.body.style.height = `${height}px`;
  }

  /**
   * Handle global touch events to prevent unwanted scrolling
   */
  private static handleGlobalTouchEvents(): void {
    // Prevent scrolling except in the sensor list
    document.addEventListener(
      "touchmove",
      (e) => {
        if (!e.target || !(e.target as Element).closest("#latest-readings")) {
          e.preventDefault();
        }
      },
      { passive: false },
    );
  }

  /**
   * Handle orientation changes with force reflow to fix visual glitches
   */
  private static handleOrientationChanges(): void {
    window.addEventListener("orientationchange", () => {
      // Force a reflow after orientation change to prevent visual glitches
      document.body.style.display = "none";
      setTimeout(() => {
        document.body.style.display = "";
      }, 20);
    });
  }
}
