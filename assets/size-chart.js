function initSizeChart() {
  const dialog = document.getElementById('SizeChartDialog');
  const trigger = document.getElementById('SizeChartTrigger');
  const closeBtn = document.getElementById('SizeChartClose');
  if (!(dialog instanceof HTMLDialogElement) || !(trigger instanceof HTMLElement)) return;

  // Auto-dock ke heading Size / Ukuran jika ada
  /** @type {HTMLElement | null} */
  const wrapper = document.querySelector('.product__size-chart-wrapper');
  if (wrapper instanceof HTMLElement) {
    const headings = document.querySelectorAll('.variant-option > legend, .variant-option > label');
    for (const el of headings) {
      if (el instanceof HTMLElement) {
        const text = el.childNodes[0]?.textContent ? el.childNodes[0].textContent.toLowerCase() : (el.textContent ? el.textContent.toLowerCase() : '');
        if (text.includes('size') || text.includes('ukuran')) {
          if (!el.contains(wrapper)) {
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'space-between';
            el.style.width = '100%';
            wrapper.style.margin = '0';
            wrapper.style.marginLeft = 'auto';
            el.appendChild(wrapper);
          }
          break;
        }
      }
    }
  }

  if (dialog.dataset.sizeChartInitialized === 'true') return;
  dialog.dataset.sizeChartInitialized = 'true';

  // Buka Modal Drawer & Kunci Scroll Body
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dialog.showModal();
    document.body.style.overflow = 'hidden';
  });

  // Tutup Modal Drawer, Lepas Kunci Scroll, & Kembalikan Fokus
  const closeModal = () => {
    dialog.close();
    document.body.style.overflow = '';
    trigger.focus();
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closeModal();
  });
  dialog.addEventListener('cancel', () => {
    document.body.style.overflow = '';
    trigger.focus();
  });

  // Toggle Satuan cm / inci & Simpan ke localStorage
  /** @type {NodeListOf<HTMLElement>} */
  const unitButtons = dialog.querySelectorAll('.unit-toggle-btn');
  /** @type {NodeListOf<HTMLElement>} */
  const values = dialog.querySelectorAll('.size-val');
  /** @type {NodeListOf<HTMLElement>} */
  const labels = dialog.querySelectorAll('.unit-text');

  /**
   * @param {string} unit
   */
  const updateUnits = (unit) => {
    localStorage.setItem('kainara_size_unit', unit);
    unitButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.unit === unit);
    });
    labels.forEach(lbl => {
      lbl.textContent = unit === 'inch' ? 'in' : 'cm';
    });

    values.forEach(el => {
      const cm = parseFloat(el.dataset.cm || '');
      if (!isNaN(cm)) {
        el.textContent = unit === 'inch' ? (cm / 2.54).toFixed(1) : String(cm);
      }
    });
  };

  unitButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.unit) {
        updateUnits(btn.dataset.unit);
      }
    });
  });

  const savedUnit = localStorage.getItem('kainara_size_unit') || 'cm';
  updateUnits(savedUnit);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSizeChart);
} else {
  initSizeChart();
}

document.addEventListener('shopify:section:load', initSizeChart);
