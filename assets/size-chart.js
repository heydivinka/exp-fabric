function initSizeChart() {
  const dialog = document.getElementById('SizeChartDialog');
  const trigger = document.getElementById('SizeChartTrigger');
  const closeBtn = document.getElementById('SizeChartClose');
  if (!(dialog instanceof HTMLDialogElement) || !(trigger instanceof HTMLElement)) return;

  // Auto-dock tombol Size Guide agar sebaris dengan teks "Size" / "Ukuran" (rata kanan)
  /** @type {HTMLElement | null} */
  const wrapper = document.querySelector('.product__size-chart-wrapper');
  if (wrapper instanceof HTMLElement) {
    const optionLabels = document.querySelectorAll(
      '.variant-option legend, .variant-option label.form__label, .product-form__input legend, .product-form__input label'
    );
    for (const el of optionLabels) {
      if (el instanceof HTMLElement) {
        const text = (el.childNodes[0]?.textContent || el.textContent || '').trim().toLowerCase();
        if (text === 'size' || text === 'ukuran' || text.startsWith('size') || text.startsWith('ukuran')) {
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

  // Bonus: Rekomendasi Ukuran Interaktif (Size Recommender)
  const recommenderEl = dialog.querySelector('.size-chart-recommender');
  if (recommenderEl instanceof HTMLElement) {
    /** @type {HTMLSelectElement | null} */
    const metricSelect = recommenderEl.querySelector('#SizeRecommenderMetricSelect');
    /** @type {HTMLInputElement | null} */
    const recInput = recommenderEl.querySelector('#SizeRecommenderInput');
    /** @type {HTMLElement | null} */
    const recBtn = recommenderEl.querySelector('#SizeRecommenderBtn');
    /** @type {HTMLElement | null} */
    const recReset = recommenderEl.querySelector('#SizeRecommenderReset');
    /** @type {HTMLElement | null} */
    const recResult = recommenderEl.querySelector('#SizeRecommenderResult');
    /** @type {NodeListOf<HTMLTableRowElement>} */
    const rows = dialog.querySelectorAll('.size-chart-table tbody tr');

    const handleRecommendation = () => {
      if (!recInput) return;
      const rawVal = parseFloat(recInput.value);
      if (isNaN(rawVal) || rawVal <= 0) return;

      const metric = metricSelect && metricSelect.value ? metricSelect.value : recommenderEl.dataset.metric || 'chest';
      const currentUnit = localStorage.getItem('kainara_size_unit') || defaultUnit;
      // Konversi ke cm jika input dalam satuan inci
      const inputInCm = currentUnit === 'inch' ? rawVal * 2.54 : rawVal;

      /** @type {HTMLTableRowElement | null} */
      let bestRow = null;
      let minDiff = Infinity;

      for (const row of rows) {
        if (row instanceof HTMLElement) {
          let valStr = '';
          if (metric === 'waist') {
            valStr = row.dataset.waist || '';
          } else if (metric === 'hip') {
            valStr = row.dataset.hip || '';
          } else {
            valStr = row.dataset.chest || '';
          }

          const rowVal = parseFloat(valStr);
          if (!isNaN(rowVal) && rowVal > 0) {
            const diff = Math.abs(rowVal - inputInCm);
            if (diff < minDiff) {
              minDiff = diff;
              bestRow = row;
            }
          }
        }
      }

      if (bestRow instanceof HTMLElement) {
        for (const r of rows) {
          if (r instanceof HTMLElement) {
            r.classList.remove('is-highlighted');
          }
        }
        bestRow.classList.add('is-highlighted');
        bestRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        const bestSize = bestRow.dataset.size || '';
        if (recResult instanceof HTMLElement) {
          const template = recResult.dataset.template || 'Recommended size: [SIZE]';
          const message = template.replace('[SIZE]', bestSize);
          recResult.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span><strong>${message}</strong></span>
          `;
          recResult.classList.remove('hidden');
        }
        if (recReset instanceof HTMLElement) recReset.classList.remove('hidden');
      }
    };

    if (recBtn instanceof HTMLElement) recBtn.addEventListener('click', handleRecommendation);
    if (recInput instanceof HTMLInputElement) {
      recInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleRecommendation();
        }
      });
    }

    if (recReset instanceof HTMLElement) {
      recReset.addEventListener('click', () => {
        if (recInput instanceof HTMLInputElement) recInput.value = '';
        for (const r of rows) {
          if (r instanceof HTMLElement) {
            r.classList.remove('is-highlighted');
          }
        }
        if (recResult instanceof HTMLElement) recResult.classList.add('hidden');
        recReset.classList.add('hidden');
      });
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSizeChart);
} else {
  initSizeChart();
}

document.addEventListener('shopify:section:load', initSizeChart);
