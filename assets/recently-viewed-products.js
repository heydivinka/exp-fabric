/**
 * Manages recently viewed products in localStorage.
 * Stores both product ID and handle so the section can fetch product data.
 */
export class RecentlyViewed {
  /** @static @constant {string} The key used to store the viewed products */
  static #STORAGE_KEY = 'viewedProducts';

  /** @static @constant {number} The maximum number of products to store */
  static #MAX_PRODUCTS = 5;

  /**
   * Adds a product to the recently viewed products list.
   * Stores {id, handle} objects so the section can fetch product data client-side.
   *
   * @param {string} productId     - The numeric ID of the product.
   * @param {string} productHandle - The URL handle of the product.
   */
  static addProduct(productId, productHandle) {
    let viewedProducts = this.getProducts();

    // Remove if already exists (dedup by id)
    viewedProducts = viewedProducts.filter(
      (/** @type {{id: string, handle: string}} */ item) => String(item.id) !== String(productId)
    );

    // Add to front
    viewedProducts.unshift({ id: String(productId), handle: productHandle });

    // Trim to max
    viewedProducts = viewedProducts.slice(0, this.#MAX_PRODUCTS);

    localStorage.setItem(this.#STORAGE_KEY, JSON.stringify(viewedProducts));
  }

  static clearProducts() {
    localStorage.removeItem(this.#STORAGE_KEY);
  }

  /**
   * Retrieves the list of recently viewed products.
   * @returns {{ id: string, handle: string }[]}
   */
  static getProducts() {
    try {
      const raw = localStorage.getItem(this.#STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Support both old format (string IDs) and new format ({id, handle})
      return parsed.map((item) => {
        if (typeof item === 'string') return { id: item, handle: null };
        if (typeof item === 'object' && item.id) return item;
        return null;
      }).filter(Boolean);
    } catch (_) {
      return [];
    }
  }
}
