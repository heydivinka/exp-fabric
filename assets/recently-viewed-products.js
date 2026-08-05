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
}
