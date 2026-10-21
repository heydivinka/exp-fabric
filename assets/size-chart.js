function initSizeChart() {
  const dialog = document.getElementById('SizeChartDialog');
  const trigger = document.getElementById('SizeChartTrigger');
  const closeBtn = document.getElementById('SizeChartClose');
  if (!(dialog instanceof HTMLDialogElement) || !(trigger instanceof HTMLElement)) return;

  if (dialog.dataset.sizeChartInitialized === 'true') return;
  dialog.dataset.sizeChartInitialized = 'true';

  // Accessibility state
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');

  // Buka Modal Drawer & Kunci Scroll Body
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    trigger.setAttribute('aria-expanded', 'true');
  });

  // Tutup Modal Drawer, Lepas Kunci Scroll, & Kembalikan Fokus
  const closeModal = () => {
    dialog.close();
  };

  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  // Tutup saat klik di luar area dialog (backdrop/overlay)
  dialog.addEventListener('click', (e) => {
    const rect = dialog.getBoundingClientRect();
    const isClickInside =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;
    if (!isClickInside) {
      closeModal();
    }
  });

  // Event 'close' native dialog (menangani ESC, tombol close, dan backdrop secara seragam)
  dialog.addEventListener('close', () => {
    document.body.style.overflow = '';
    trigger.setAttribute('aria-expanded', 'false');
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
    unitButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.unit === unit);
    });
    labels.forEach((lbl) => {
      lbl.textContent = unit === 'inch' ? 'in' : 'cm';
    });

    values.forEach((el) => {
      const cm = parseFloat(el.dataset.cm || '');
      if (!isNaN(cm)) {
        el.textContent = unit === 'inch' ? (cm / 2.54).toFixed(1) : String(cm);
      }
    });
  };

  unitButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.unit) {
        updateUnits(btn.dataset.unit);
      }
    });
  });

  // Satuan awal mengikuti setting block, atau preferensi tersimpan di localStorage
  const defaultUnit = dialog.dataset.defaultUnit || 'cm';
  const savedUnit = localStorage.getItem('kainara_size_unit') || defaultUnit;
  updateUnits(savedUnit);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSizeChart);
} else {
  initSizeChart();
}

document.addEventListener('shopify:section:load', initSizeChart);
