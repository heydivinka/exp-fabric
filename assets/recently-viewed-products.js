/**
 * Updates the recently viewed products in localStorage.
 */
export class RecentlyViewed {
  /** @static @constant {string} The key used to store the viewed products in session storage */
  static #STORAGE_KEY = 'viewedProducts';

  /** @static @constant {number} The maximum number of products to store */
  static #MAX_PRODUCTS = 5;

  /**
   * Adds a product to the recently viewed products list.
   * @param {string} productId - The ID of the product to add.
   */
  static addProduct(productId) {
    let viewedProducts = this.getProducts();
    viewedProducts = viewedProducts.filter((/** @type {string} */ id) => id !== String(productId));
    viewedProducts.unshift(String(productId));
    viewedProducts = viewedProducts.slice(0, this.#MAX_PRODUCTS);
    localStorage.setItem(this.#STORAGE_KEY, JSON.stringify(viewedProducts));
  }

  static clearProducts() {
    localStorage.removeItem(this.#STORAGE_KEY);
  }

  /**
   * Retrieves the list of recently viewed products from session storage.
   * @returns {string[]} The list of viewed product IDs as strings.
   */
  static getProducts() {
    try {
      const raw = localStorage.getItem(this.#STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Normalise — support both string IDs and legacy {id, handle} objects
      return parsed
        .map((item) => {
          if (typeof item === 'string') return item;
          if (typeof item === 'object' && item !== null && item.id) return String(item.id);
          return null;
        })
        .filter((id) => id !== null);
    } catch (_) {
      return [];
    }
  }

  /**
   * Initialises the recently-viewed section on the page.
   * Reads stored IDs, matches them against pre-rendered `.rv-card` elements,
   * and reveals matching cards in recency order.
   *
   * @param {string} sectionId - The Shopify section ID used to locate the wrapper element.
   */
  static initSection(sectionId) {
    const wrapper = /** @type {HTMLElement|null} */ (document.getElementById(`rv-section-${sectionId}`));
    if (!wrapper) return;

    const currentId = String(wrapper.dataset.currentId || '');
    const viewedIds = this.getProducts()
      .filter((id) => id !== currentId)
      .slice(0, this.#MAX_PRODUCTS);

    if (viewedIds.length === 0) {
      wrapper.style.display = 'none';
      return;
    }

    const allCards = wrapper.querySelectorAll('.rv-card');
    if (allCards.length === 0) {
      wrapper.style.display = 'none';
      return;
    }

    /** @type {Record<string, Element>} */
    const cardMap = {};
    allCards.forEach((card) => {
      const pid = String(/** @type {HTMLElement} */ (card).dataset.productId || '');
      if (pid) cardMap[pid] = card;
    });

    let shown = 0;
    viewedIds.forEach((id) => {
      if (shown >= this.#MAX_PRODUCTS) return;
      const card = cardMap[id];
      if (card) {
        card.classList.remove('rv-hidden');
        shown++;
      }
    });

    if (shown === 0) {
      wrapper.style.display = 'none';
      return;
    }

    wrapper.querySelector('.rv-grid')?.classList.remove('rv-hidden');
    wrapper.querySelector('.rv-heading')?.classList.remove('rv-hidden');
  }

  /**
   * Auto-initialises all recently-viewed sections found in the DOM.
   * Called automatically on 'load' when this file is loaded as a plain script.
   * Scans for elements with id matching `rv-section-*`.
   */
  static initAll() {
    document.querySelectorAll('[id^="rv-section-"]').forEach((el) => {
      const sectionId = el.id.replace('rv-section-', '');
      this.initSection(sectionId);
    });
  }
}

/* Auto-init: when this module is loaded as a direct <script src> tag,
   scan the DOM for any rv-section-* wrappers and initialise them. */
if (document.readyState === 'complete') {
  RecentlyViewed.initAll();
} else {
  window.addEventListener('load', () => RecentlyViewed.initAll());
}
