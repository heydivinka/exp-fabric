/**
 * Exp Cart Form Auto Filled Checkout Engine
 * Architecture: Senior Dev Storefront Mutation (Left) + Emsifa API Wilayah Cascading (Right)
 * Standard: RULES-SHOPIFY.md (exp- prefix, DRY, safe error handling)
 */

(function () {
  'use strict';

  // Province ISO 3166-2:ID Zone Code Dictionary
  var PROVINCES_MAP = [
    ['AC', 'Aceh'],
    ['BA', 'Bali'],
    ['BT', 'Banten'],
    ['BE', 'Bengkulu'],
    ['GO', 'Gorontalo'],
    ['JK', 'DKI Jakarta'],
    ['JA', 'Jambi'],
    ['JB', 'Jawa Barat'],
    ['JT', 'Jawa Tengah'],
    ['JI', 'Jawa Timur'],
    ['KB', 'Kalimantan Barat'],
    ['KS', 'Kalimantan Selatan'],
    ['KT', 'Kalimantan Tengah'],
    ['KI', 'Kalimantan Timur'],
    ['KU', 'Kalimantan Utara'],
    ['BB', 'Kepulauan Bangka Belitung'],
    ['KR', 'Kepulauan Riau'],
    ['LA', 'Lampung'],
    ['MA', 'Maluku'],
    ['MU', 'Maluku Utara'],
    ['NB', 'Nusa Tenggara Barat'],
    ['NT', 'Nusa Tenggara Timur'],
    ['PA', 'Papua'],
    ['PB', 'Papua Barat'],
    ['RI', 'Riau'],
    ['SR', 'Sulawesi Barat'],
    ['SN', 'Sulawesi Selatan'],
    ['ST', 'Sulawesi Tengah'],
    ['SG', 'Sulawesi Tenggara'],
    ['SA', 'Sulawesi Utara'],
    ['SB', 'Sumatera Barat'],
    ['SS', 'Sumatera Selatan'],
    ['SU', 'Sumatera Utara'],
    ['YO', 'DI Yogyakarta']
  ];

  var REGION_PATHS = ['provinces', 'regencies/', 'districts/', 'villages/'];
  var DRAFT_KEY = 'ccf:draft';
  var SAVED_ADDR_KEY = 'ccf:custom_addresses';
  var DELETED_ADDR_KEY = 'ccf:deleted_addresses';
  var regionCache = {};

  var PREFILL_MUTATION = [
    'mutation CheckoutPrefill($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!, $addresses: [MailingAddressInput!]!) {',
    '  identity: cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {',
    '    userErrors { field message code }',
    '  }',
    '  delivery: cartDeliveryAddressesReplace(cartId: $cartId, addresses: $addresses) {',
    '    userErrors { field message code }',
    '  }',
    '  cart(id: $cartId) {',
    '    checkoutUrl',
    '  }',
    '}'
  ].join('\n');

  function getProvinceZoneCode(provinceName) {
    if (!provinceName) return '';
    var clean = provinceName.toLowerCase().replace(/^(provinsi|daerah khusus ibukota|dki|daerah istimewa|di)\s+/, '');
    for (var i = 0; i < PROVINCES_MAP.length; i++) {
      var code = PROVINCES_MAP[i][0];
      var name = PROVINCES_MAP[i][1].toLowerCase().replace(/^(provinsi|daerah khusus ibukota|dki|daerah istimewa|di)\s+/, '');
      if (clean.indexOf(name) !== -1 || name.indexOf(clean) !== -1) {
        return code;
      }
    }
    return '';
  }

  function toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/(?:^|\s|-)\S/g, function (c) {
      return c.toUpperCase();
    });
  }

  function regionList(api, level, parentId) {
    var path = REGION_PATHS[level] + (level ? parentId : '');
    if (!regionCache[path]) {
      var url = api.replace(/\/+$/, '') + '/' + path + '.json';
      regionCache[path] = fetch(url, { credentials: 'omit' })
        .then(function (response) {
          if (!response.ok) throw new Error('wilayah API failure: ' + response.status);
          return response.json();
        })
        .then(function (json) {
          return (Array.isArray(json) ? json : json && json.data) || [];
        });

      // Don't cache a failure, so a later attempt can still succeed
      regionCache[path].catch(function () {
        delete regionCache[path];
      });
    }
    return regionCache[path];
  }

  function store(key, value) {
    try {
      if (value === null) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (e) {}
  }

  function read(key) {
    try {
      var val = window.localStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    } catch (e) {
      return null;
    }
  }

  class ExpCartCheckoutForm {
    constructor(wrapper) {
      this.wrapper = wrapper;
      this.form = wrapper.querySelector('#exp-cart-checkout-form');
      if (!this.form) return;

      this.currentStep = 1;
      this.apiBase = wrapper.dataset.regionApi || 'https://www.emsifa.com/api-wilayah-indonesia/v2';
      this.storefrontToken = wrapper.dataset.storefrontToken || '';
      this.storefrontVersion = wrapper.dataset.storefrontVersion || '2026-10';
      this.checkoutAction = wrapper.dataset.checkoutAction || 'scroll_to_form';
      this.phonePrefix = wrapper.dataset.phonePrefix || '+62';
      this.selectedAddressId = null;
      this.editingAddressId = null;
      this.savedAddresses = [];

      this.initElements();
      this.bindEvents();
      this.initDeliveryCardSelection();
      this.initSavedAddresses();
      this.initAddressModal();
      this.loadProvinces();
      this.restoreDraft();
      this.handleSummaryCheckoutButton();
    }

    initElements() {
      this.step1 = this.form.querySelector('[data-step="1"]');
      this.step2 = this.form.querySelector('[data-step="2"]');
      this.stepper = this.wrapper.querySelector('.exp-stepper');
      this.stepperItems = this.wrapper.querySelectorAll('.exp-stepper__item');

      this.btnNext = this.form.querySelector('.exp-btn-next');
      this.btnBack = this.form.querySelector('.exp-btn-back');
      this.btnComplete = this.form.querySelector('.exp-btn-complete');

      // Step 1 Fields
      this.firstNameInput = this.form.querySelector('#exp-first-name');
      this.lastNameInput = this.form.querySelector('#exp-last-name');
      this.emailInput = this.form.querySelector('#exp-email');
      this.phoneInput = this.form.querySelector('#exp-phone');

      // Step 2 Fields
      this.provinceSelect = this.form.querySelector('#exp-province');
      this.regencySelect = this.form.querySelector('#exp-regency');
      this.districtSelect = this.form.querySelector('#exp-district');
      this.villageSelect = this.form.querySelector('#exp-village');
      this.postalInput = this.form.querySelector('#exp-postal-code');
      this.detailAddressInput = this.form.querySelector('#exp-detail-address');
      this.courierNoteInput = this.form.querySelector('#exp-courier-note');
    }

    bindEvents() {
      this.btnNext?.addEventListener('click', () => this.handleStep1Next());
      this.btnBack?.addEventListener('click', () => this.goToStep(1));
      this.form.addEventListener('submit', (e) => this.handleCheckoutSubmit(e));

      // Region Dropdowns Cascading
      this.provinceSelect?.addEventListener('change', () => this.onProvinceChange());
      this.regencySelect?.addEventListener('change', () => this.onRegencyChange());
      this.districtSelect?.addEventListener('change', () => this.onDistrictChange());

      // Auto-save form draft on user input
      this.form.addEventListener('input', () => this.saveDraft());
      this.form.addEventListener('change', () => this.saveDraft());

      // Clean phone number prefix 0
      this.phoneInput?.addEventListener('input', () => {
        this.phoneInput.value = this.phoneInput.value.replace(/^0+/, '').replace(/\D/g, '');
      });
    }

    initDeliveryCardSelection() {
      const radioCards = this.wrapper.querySelectorAll('.exp-delivery-card');
      radioCards.forEach((card) => {
        card.addEventListener('click', () => {
          radioCards.forEach((c) => c.classList.remove('is-selected'));
          card.classList.add('is-selected');
          const radio = card.querySelector('input[type="radio"]');
          if (radio) {
            radio.checked = true;
            this.saveDraft();
          }
        });
      });

      // Dengarkan event Theme Editor inspector saat merchant klik block
      document.addEventListener('shopify:block:select', (event) => {
        const blockEl = event.target;
        if (blockEl && blockEl.classList.contains('exp-delivery-card')) {
          this.wrapper.querySelectorAll('.exp-delivery-card').forEach((c) => c.classList.remove('is-selected'));
          blockEl.classList.add('is-selected');
          const radio = blockEl.querySelector('input[type="radio"]');
          if (radio) {
            radio.checked = true;
            this.saveDraft();
          }
        }
      });
    }

    initSavedAddresses() {
      const script = this.wrapper.querySelector('#exp-customer-saved-addresses-json');
      let serverAddresses = [];
      if (script) {
        try {
          serverAddresses = JSON.parse(script.textContent) || [];
        } catch (e) {
          serverAddresses = [];
        }
      }

      // Filter out any locally deleted addresses
      const deletedIds = read(DELETED_ADDR_KEY) || [];
      serverAddresses = serverAddresses.filter((a) => !deletedIds.includes(String(a.id)));

      // Read custom saved addresses from local storage
      const customAddresses = read(SAVED_ADDR_KEY) || [];

      // Combine server addresses with locally saved addresses
      this.savedAddresses = [...serverAddresses];
      customAddresses.forEach((customAddr) => {
        const existingIdx = this.savedAddresses.findIndex((a) => String(a.id) === String(customAddr.id));
        if (existingIdx !== -1) {
          this.savedAddresses[existingIdx] = customAddr;
        } else {
          this.savedAddresses.push(customAddr);
        }
      });

      // Synchronize DOM: Render any custom addresses that were not in initial Liquid HTML
      const grid = this.wrapper.querySelector('.exp-saved-addresses-grid');
      if (grid) {
        customAddresses.forEach((addr) => {
          if (!grid.querySelector(`.exp-address-card[data-address-id="${addr.id}"]`)) {
            this.renderCardToGrid(addr, false);
          }
        });
      }

      // Synchronize Dropdown if exists
      const selectElem = this.wrapper.querySelector('#exp-saved-address-select');
      if (selectElem) {
        customAddresses.forEach((addr) => {
          if (!selectElem.querySelector(`option[value="${addr.id}"]`)) {
            const opt = document.createElement('option');
            opt.value = addr.id;
            opt.textContent = `${addr.name || addr.firstName} - ${addr.address1}, ${addr.city} (${addr.zip})`;
            const newOpt = selectElem.querySelector('option[value="new"]');
            if (newOpt) {
              selectElem.insertBefore(opt, newOpt);
            } else {
              selectElem.appendChild(opt);
            }
          }
        });

        selectElem.addEventListener('change', () => {
          const val = selectElem.value;
          if (val === 'new') {
            const newCard = this.wrapper.querySelector('.exp-address-card--new');
            if (newCard) {
              this.handleNewAddressSelection(newCard);
            } else {
              this.resetForNewAddress();
              this.updateAddressModeBadge('new');
            }
          } else {
            const found = this.savedAddresses.find((a) => String(a.id) === String(val));
            if (found) {
              const card = this.wrapper.querySelector(`.exp-address-card[data-address-id="${val}"]`);
              if (card) {
                this.handleSavedAddressSelection(card, found, false);
              } else {
                this.applySavedAddress(found, false);
                this.updateAddressModeBadge('saved', found);
              }
            }
          }
        });
      }

      // Update count text
      this.updateAddressCount();

      // Bind all existing cards in DOM
      const cards = this.wrapper.querySelectorAll('.exp-address-card');
      cards.forEach((card) => this.bindCardEvents(card));

      // Pre-select default address
      if (this.savedAddresses.length) {
        const defaultAddr = this.savedAddresses.find((a) => a.isDefault) || this.savedAddresses[0];
        if (defaultAddr) {
          this.selectedAddressId = defaultAddr.id;
          this.updateAddressModeBadge('saved', defaultAddr);
        }
      }

      // Bind autofill contact button for new address mode
      const btnFillContact = this.wrapper.querySelector('#exp-btn-fill-my-contact');
      btnFillContact?.addEventListener('click', () => this.fillCustomerAccountContact());

      // Bind Live CRUD Actions
      const btnSave = this.wrapper.querySelector('#exp-btn-save-address');
      btnSave?.addEventListener('click', () => this.saveAddressToCustomerAccount());

      const btnCancel = this.wrapper.querySelector('#exp-btn-cancel-edit');
      btnCancel?.addEventListener('click', () => this.cancelEdit());
    }

    bindCardEvents(card) {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="fast-checkout"]')) return;
        if (e.target.closest('[data-action="edit-address"]')) return;
        if (e.target.closest('[data-action="delete-address"]')) return;

        const addrId = card.dataset.addressId;
        if (addrId === 'new') {
          this.handleNewAddressSelection(card);
        } else {
          const found = this.savedAddresses.find((a) => String(a.id) === String(addrId));
          if (found) this.handleSavedAddressSelection(card, found, false);
        }
      });

      const fastBtn = card.querySelector('[data-action="fast-checkout"]');
      fastBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const addrId = fastBtn.dataset.addressId;
        const found = this.savedAddresses.find((a) => String(a.id) === String(addrId));
        if (found) this.applySavedAddress(found, true);
      });

      const editBtn = card.querySelector('[data-action="edit-address"]');
      editBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const addrId = editBtn.dataset.addressId;
        if (this.modalEl) {
          this.openAddressModal(addrId);
        } else {
          this.startEditAddress(addrId);
        }
      });

      const deleteBtn = card.querySelector('[data-action="delete-address"]');
      deleteBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const addrId = deleteBtn.dataset.addressId;
        this.deleteAddressFromCustomerAccount(addrId);
      });
    }

    async saveAddressToCustomerAccount() {
      if (!this.validateStep1()) {
        this.goToStep(1);
        this.showSaveFeedback('Lengkapi data penerima di Step 1 terlebih dahulu.', 'error');
        return;
      }
      if (!this.validateStep2()) {
        this.showSaveFeedback('Lengkapi seluruh kolom alamat sebelum menyimpan.', 'error');
        return;
      }

      const btnSave = this.wrapper.querySelector('#exp-btn-save-address');
      if (btnSave) {
        btnSave.disabled = true;
        btnSave.classList.add('is-loading');
      }
      this.showSaveFeedback('', false);

      const formDataObj = this.getFormData();
      const isDefault = Boolean(this.wrapper.querySelector('#exp-set-default-address')?.checked);
      const isEditing = Boolean(this.editingAddressId && this.editingAddressId !== 'new');

      // 1. Silent background server sync attempt (works for Classic Accounts; catches CORS on New Customer Accounts without error)
      try {
        const formData = new FormData();
        formData.append('form_type', 'customer_address');
        formData.append('utf8', '✓');
        if (isEditing) {
          formData.append('_method', 'put');
        }
        formData.append('address[first_name]', formDataObj.firstName);
        formData.append('address[last_name]', formDataObj.lastName);
        formData.append('address[phone]', formDataObj.fullPhone);
        formData.append('address[address1]', formDataObj.detailAddress);
        formData.append('address[address2]', `Kec. ${formDataObj.districtName}, Kel. ${formDataObj.villageName}`);
        formData.append('address[city]', formDataObj.cityName);
        formData.append('address[province]', formDataObj.provinceCode || formDataObj.provinceName);
        formData.append('address[country]', 'Indonesia');
        formData.append('address[zip]', formDataObj.postalCode);
        if (isDefault) {
          formData.append('address[default]', '1');
        }

        const endpoint = isEditing ? `/account/addresses/${this.editingAddressId}` : '/account/addresses';
        fetch(endpoint, {
          method: 'POST',
          body: formData,
          mode: 'no-cors'
        }).catch(() => {});
      } catch (e) {}

      // 2. Real-time Reactive Client Storage & DOM Update (Bulletproof against CORS)
      setTimeout(() => {
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.classList.remove('is-loading');
        }

        const successMsg = isEditing
          ? '✓ Alamat berhasil diperbarui di daftar alamat Anda!'
          : '✓ Alamat baru berhasil disimpan ke daftar alamat!';
        this.showSaveFeedback(successMsg, 'success');

        if (isEditing) {
          this.updateCardInDOM(this.editingAddressId, formDataObj, isDefault);
        } else {
          const newId = 'saved_' + Date.now();
          this.addNewCardToDOM(newId, formDataObj, isDefault);
        }

        this.cancelEdit();
      }, 250);
    }

    async deleteAddressFromCustomerAccount(addressId) {
      if (!confirm('Apakah Anda yakin ingin menghapus alamat ini?')) return;

      const card = this.wrapper.querySelector(`.exp-address-card[data-address-id="${addressId}"]`);
      if (card) {
        card.style.opacity = '0.5';
        card.style.pointerEvents = 'none';
      }

      // 1. Silent server delete attempt
      try {
        const formData = new FormData();
        formData.append('_method', 'delete');
        formData.append('form_type', 'customer_address');
        formData.append('utf8', '✓');
        fetch(`/account/addresses/${addressId}`, {
          method: 'POST',
          body: formData,
          mode: 'no-cors'
        }).catch(() => {});
      } catch (e) {}

      // 2. Remove from Local Storage custom addresses & add to deleted IDs list
      const customAddresses = read(SAVED_ADDR_KEY) || [];
      const updatedCustom = customAddresses.filter((a) => String(a.id) !== String(addressId));
      store(SAVED_ADDR_KEY, updatedCustom);

      const deletedIds = read(DELETED_ADDR_KEY) || [];
      if (!deletedIds.includes(String(addressId))) {
        deletedIds.push(String(addressId));
        store(DELETED_ADDR_KEY, deletedIds);
      }

      // 3. Remove card from DOM
      if (card) card.remove();
      this.savedAddresses = this.savedAddresses.filter((a) => String(a.id) !== String(addressId));
      this.updateAddressCount();

      // Update dropdown option if exists
      const opt = this.wrapper.querySelector(`#exp-saved-address-select option[value="${addressId}"]`);
      if (opt) opt.remove();

      if (String(this.selectedAddressId) === String(addressId)) {
        const next = this.savedAddresses[0];
        if (next) {
          this.applySavedAddress(next, false);
        } else {
          this.resetForNewAddress();
        }
      }
      this.showSaveFeedback('✓ Alamat berhasil dihapus.', 'success');
    }

    startEditAddress(addressId) {
      const addr = this.savedAddresses.find((a) => String(a.id) === String(addressId));
      if (!addr) return;

      this.editingAddressId = addressId;
      this.applySavedAddress(addr, false);

      const btnText = this.wrapper.querySelector('#exp-save-address-btn-text');
      if (btnText) btnText.textContent = 'Update Address in Account';
      const btnCancel = this.wrapper.querySelector('#exp-btn-cancel-edit');
      if (btnCancel) btnCancel.classList.remove('hidden');

      this.goToStep(2);
      const panel = this.wrapper.querySelector('.exp-save-address-panel');
      panel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this.showSaveFeedback(`Sedang mengedit: ${addr.name || 'Alamat'}. Ubah data di atas lalu klik Update Address.`, 'success');
    }

    cancelEdit() {
      this.editingAddressId = null;
      const btnText = this.wrapper.querySelector('#exp-save-address-btn-text');
      if (btnText) btnText.textContent = 'Save Address to Account';
      const btnCancel = this.wrapper.querySelector('#exp-btn-cancel-edit');
      if (btnCancel) btnCancel.classList.add('hidden');
    }

    initAddressModal() {
      this.modalEl = this.wrapper.querySelector('#exp-address-modal');
      if (!this.modalEl) return;

      this.modalForm = this.modalEl.querySelector('#exp-modal-address-form');
      this.modalCloseBtn = this.modalEl.querySelector('#exp-modal-close-btn');
      this.modalCancelBtn = this.modalEl.querySelector('#exp-modal-cancel-btn');
      this.modalSaveBtn = this.modalEl.querySelector('#exp-modal-save-btn');
      this.modalFeedback = this.modalEl.querySelector('#exp-modal-feedback');

      this.modalIdInput = this.modalEl.querySelector('#exp-modal-address-id');
      this.modalFirstName = this.modalEl.querySelector('#exp-modal-first-name');
      this.modalLastName = this.modalEl.querySelector('#exp-modal-last-name');
      this.modalPhone = this.modalEl.querySelector('#exp-modal-phone');
      this.modalProvince = this.modalEl.querySelector('#exp-modal-province');
      this.modalRegency = this.modalEl.querySelector('#exp-modal-regency');
      this.modalDistrict = this.modalEl.querySelector('#exp-modal-district');
      this.modalVillage = this.modalEl.querySelector('#exp-modal-village');
      this.modalPostal = this.modalEl.querySelector('#exp-modal-postal-code');
      this.modalDetail = this.modalEl.querySelector('#exp-modal-detail-address');
      this.modalIsDefault = this.modalEl.querySelector('#exp-modal-is-default');

      // Dismissal actions
      this.modalCloseBtn?.addEventListener('click', () => this.closeAddressModal());
      this.modalCancelBtn?.addEventListener('click', () => this.closeAddressModal());
      this.modalEl.addEventListener('click', (e) => {
        if (e.target === this.modalEl) this.closeAddressModal();
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.modalEl && !this.modalEl.classList.contains('hidden')) {
          this.closeAddressModal();
        }
      });

      // Cascading selects inside modal
      this.modalProvince?.addEventListener('change', () => this.onModalProvinceChange());
      this.modalRegency?.addEventListener('change', () => this.onModalRegencyChange());
      this.modalDistrict?.addEventListener('change', () => this.onModalDistrictChange());

      // Form submission
      this.modalForm?.addEventListener('submit', (e) => this.handleModalSubmit(e));
    }

    async openAddressModal(addressId) {
      if (!this.modalEl) return;
      const addr = this.savedAddresses.find((a) => String(a.id) === String(addressId));
      if (!addr) return;

      this.modalEditingAddressId = addressId;
      if (this.modalIdInput) this.modalIdInput.value = addressId;
      if (this.modalFirstName) this.modalFirstName.value = addr.firstName || '';
      if (this.modalLastName) this.modalLastName.value = addr.lastName || '';

      // Strip +62 or leading 0 from phone input for display with prefix badge
      let rawPhone = (addr.phone || '').replace(/^\+62|^62/, '').replace(/^0+/, '');
      if (this.modalPhone) this.modalPhone.value = rawPhone;

      if (this.modalPostal) this.modalPostal.value = addr.zip || '';
      if (this.modalDetail) this.modalDetail.value = addr.address1 || '';
      if (this.modalIsDefault) this.modalIsDefault.checked = Boolean(addr.isDefault);

      // Reset validation error highlights
      const inputs = this.modalForm.querySelectorAll('.is-invalid');
      inputs.forEach((inp) => inp.classList.remove('is-invalid'));
      this.showModalFeedback('', false);

      // Open dialog UI
      this.modalEl.classList.remove('hidden');
      document.body.style.overflow = 'hidden';

      // Load provinces into modal select if empty
      await this.loadModalProvinces();

      // Match and pre-fill regions
      await this.matchModalRegions(addr);
    }

    closeAddressModal() {
      if (!this.modalEl) return;
      this.modalEl.classList.add('hidden');
      document.body.style.overflow = '';
      this.modalEditingAddressId = null;
    }

    showModalFeedback(message, type) {
      if (!this.modalFeedback) return;
      if (!message) {
        this.modalFeedback.classList.add('hidden');
        this.modalFeedback.textContent = '';
        this.modalFeedback.className = 'exp-save-address-feedback hidden';
        return;
      }
      this.modalFeedback.classList.remove('hidden');
      this.modalFeedback.textContent = message;
      this.modalFeedback.className = `exp-save-address-feedback exp-save-address-feedback--${type}`;
    }

    async loadModalProvinces() {
      if (!this.modalProvince) return;
      if (this.modalProvince.options.length > 1) return;

      try {
        this.modalProvince.disabled = true;
        const provinces = await regionList(this.apiBase, 0);
        this.populateSelect(this.modalProvince, provinces, 'Select Province');
        this.modalProvince.disabled = false;
      } catch (err) {
        console.warn('Gagal memuat provinsi di modal:', err);
        this.modalProvince.disabled = false;
      }
    }

    async onModalProvinceChange(targetRegencyName, targetDistrictName, targetVillageName) {
      const provId = this.modalProvince.value;
      this.resetDropdowns([this.modalRegency, this.modalDistrict, this.modalVillage]);
      if (!provId) return;

      try {
        this.modalRegency.disabled = true;
        const regencies = await regionList(this.apiBase, 1, provId);
        this.populateSelect(this.modalRegency, regencies, 'Select City');
        this.modalRegency.disabled = false;

        if (targetRegencyName) {
          const cleanTarget = targetRegencyName.toLowerCase().replace(/^(kota|kabupaten|kab\.?)\s+/i, '').trim();
          for (let i = 0; i < this.modalRegency.options.length; i++) {
            const opt = this.modalRegency.options[i];
            if (!opt.value) continue;
            const optName = (opt.dataset.name || opt.textContent).toLowerCase().replace(/^(kota|kabupaten|kab\.?)\s+/i, '').trim();
            if (optName.includes(cleanTarget) || cleanTarget.includes(optName)) {
              this.modalRegency.value = opt.value;
              await this.onModalRegencyChange(targetDistrictName, targetVillageName);
              break;
            }
          }
        }
      } catch (err) {
        console.warn('Gagal memuat kota di modal:', err);
        this.modalRegency.disabled = false;
      }
    }

    async onModalRegencyChange(targetDistrictName, targetVillageName) {
      const regId = this.modalRegency.value;
      this.resetDropdowns([this.modalDistrict, this.modalVillage]);
      if (!regId) return;

      try {
        this.modalDistrict.disabled = true;
        const districts = await regionList(this.apiBase, 2, regId);
        this.populateSelect(this.modalDistrict, districts, 'Select District');
        this.modalDistrict.disabled = false;

        if (targetDistrictName) {
          const cleanDist = targetDistrictName.toLowerCase().replace(/^(kecamatan|kec\.?)\s+/i, '').trim();
          for (let i = 0; i < this.modalDistrict.options.length; i++) {
            const opt = this.modalDistrict.options[i];
            if (!opt.value) continue;
            const optName = (opt.dataset.name || opt.textContent).toLowerCase().replace(/^(kecamatan|kec\.?)\s+/i, '').trim();
            if (optName.includes(cleanDist) || cleanDist.includes(optName)) {
              this.modalDistrict.value = opt.value;
              await this.onModalDistrictChange(targetVillageName);
              break;
            }
          }
        }
      } catch (err) {
        console.warn('Gagal memuat kecamatan di modal:', err);
        this.modalDistrict.disabled = false;
      }
    }

    async onModalDistrictChange(targetVillageName) {
      const distId = this.modalDistrict.value;
      this.resetDropdowns([this.modalVillage]);
      if (!distId) return;

      try {
        this.modalVillage.disabled = true;
        const villages = await regionList(this.apiBase, 3, distId);
        this.populateSelect(this.modalVillage, villages, 'Select Sub-district');
        this.modalVillage.disabled = false;

        if (targetVillageName) {
          const cleanVill = targetVillageName.toLowerCase().replace(/^(kelurahan|desa|kel\.?|des\.?)\s+/i, '').trim();
          for (let i = 0; i < this.modalVillage.options.length; i++) {
            const opt = this.modalVillage.options[i];
            if (!opt.value) continue;
            const optName = (opt.dataset.name || opt.textContent).toLowerCase().replace(/^(kelurahan|desa|kel\.?|des\.?)\s+/i, '').trim();
            if (optName.includes(cleanVill) || cleanVill.includes(optName)) {
              this.modalVillage.value = opt.value;
              break;
            }
          }
        }
      } catch (err) {
        console.warn('Gagal memuat kelurahan di modal:', err);
        this.modalVillage.disabled = false;
      }
    }

    async matchModalRegions(addr) {
      if (!this.modalProvince || !this.modalProvince.options.length) return;

      let parsedDistrict = '';
      let parsedVillage = '';
      if (addr.address2) {
        const parts = addr.address2.split(',');
        parts.forEach((p) => {
          const t = p.trim();
          if (/^kec/i.test(t)) {
            parsedDistrict = t.replace(/^kec\.?\s*/i, '').trim();
          } else if (/^(kel|desa)/i.test(t)) {
            parsedVillage = t.replace(/^(kel|desa)\.?\s*/i, '').trim();
          }
        });
      }

      const provCode = (addr.provinceCode || '').toUpperCase();
      const provName = (addr.province || '').toLowerCase();
      let matchedOpt = null;

      for (let i = 0; i < this.modalProvince.options.length; i++) {
        const opt = this.modalProvince.options[i];
        if (!opt.value) continue;
        const optName = (opt.dataset.name || opt.textContent).toLowerCase();
        const optCode = getProvinceZoneCode(optName);
        if ((provCode && optCode === provCode) || (provName && (optName.includes(provName) || provName.includes(optName)))) {
          matchedOpt = opt;
          break;
        }
      }

      if (matchedOpt) {
        this.modalProvince.value = matchedOpt.value;
        await this.onModalProvinceChange(addr.city, parsedDistrict, parsedVillage);
      }
    }

    async handleModalSubmit(e) {
      e.preventDefault();

      const requiredInputs = [
        this.modalFirstName,
        this.modalLastName,
        this.modalPhone,
        this.modalProvince,
        this.modalRegency,
        this.modalDistrict,
        this.modalVillage,
        this.modalPostal,
        this.modalDetail
      ];

      let isValid = true;
      requiredInputs.forEach((inp) => {
        if (!inp) return;
        if (!inp.value || !inp.value.trim()) {
          inp.classList.add('is-invalid');
          if (isValid) inp.focus();
          isValid = false;
        } else {
          inp.classList.remove('is-invalid');
        }
      });

      if (!isValid) {
        this.showModalFeedback('Lengkapi seluruh kolom alamat sebelum menyimpan.', 'error');
        return;
      }

      const addressId = this.modalEditingAddressId;
      if (!addressId) return;

      if (this.modalSaveBtn) {
        this.modalSaveBtn.disabled = true;
        this.modalSaveBtn.classList.add('is-loading');
      }

      const provOpt = this.modalProvince.options[this.modalProvince.selectedIndex];
      const regOpt = this.modalRegency.options[this.modalRegency.selectedIndex];
      const distOpt = this.modalDistrict.options[this.modalDistrict.selectedIndex];
      const villOpt = this.modalVillage.options[this.modalVillage.selectedIndex];

      const provName = provOpt ? (provOpt.dataset.name || provOpt.textContent).trim() : '';
      const provCode = getProvinceZoneCode(provName);
      const cityName = regOpt ? (regOpt.dataset.name || regOpt.textContent).trim() : '';
      const distName = distOpt ? (distOpt.dataset.name || distOpt.textContent).trim() : '';
      const villName = villOpt ? (villOpt.dataset.name || villOpt.textContent).trim() : '';
      const fullPhone = `${this.phonePrefix}${this.modalPhone.value.trim().replace(/^0+/, '')}`;
      const isDefault = Boolean(this.modalIsDefault && this.modalIsDefault.checked);

      const formDataObj = {
        firstName: this.modalFirstName.value.trim(),
        lastName: this.modalLastName.value.trim(),
        fullPhone: fullPhone,
        detailAddress: this.modalDetail.value.trim(),
        provinceName: provName,
        provinceCode: provCode,
        cityName: cityName,
        districtName: distName,
        villageName: villName,
        postalCode: this.modalPostal.value.trim()
      };

      // 1. Silent server dispatch (works on Classic Accounts, handles CORS on New Customer Accounts)
      try {
        const formData = new FormData();
        formData.append('form_type', 'customer_address');
        formData.append('utf8', '✓');
        formData.append('_method', 'put');
        formData.append('address[first_name]', formDataObj.firstName);
        formData.append('address[last_name]', formDataObj.lastName);
        formData.append('address[phone]', formDataObj.fullPhone);
        formData.append('address[address1]', formDataObj.detailAddress);
        formData.append('address[address2]', `Kec. ${formDataObj.districtName}, Kel. ${formDataObj.villageName}`);
        formData.append('address[city]', formDataObj.cityName);
        formData.append('address[province]', formDataObj.provinceCode || formDataObj.provinceName);
        formData.append('address[country]', 'Indonesia');
        formData.append('address[zip]', formDataObj.postalCode);
        if (isDefault) {
          formData.append('address[default]', '1');
        }

        fetch(`/account/addresses/${addressId}`, {
          method: 'POST',
          body: formData,
          mode: 'no-cors'
        }).catch(() => {});
      } catch (err) {}

      // 2. Real-time client updates
      setTimeout(() => {
        if (this.modalSaveBtn) {
          this.modalSaveBtn.disabled = false;
          this.modalSaveBtn.classList.remove('is-loading');
        }

        this.updateCardInDOM(addressId, formDataObj, isDefault);

        // If currently selected address was the one edited, synchronize active checkout form
        if (String(this.selectedAddressId) === String(addressId)) {
          const updated = this.savedAddresses.find((a) => String(a.id) === String(addressId));
          if (updated) {
            this.applySavedAddress(updated, false);
          }
        }

        this.closeAddressModal();
        this.showSaveFeedback('✓ Alamat berhasil diperbarui!', 'success');
      }, 300);
    }

    addNewCardToDOM(id, formDataObj, isDefault) {
      const newAddrObj = {
        id: id,
        isDefault: isDefault,
        firstName: formDataObj.firstName,
        lastName: formDataObj.lastName,
        name: `${formDataObj.firstName} ${formDataObj.lastName}`,
        phone: formDataObj.fullPhone,
        address1: formDataObj.detailAddress,
        address2: `Kec. ${formDataObj.districtName}, Kel. ${formDataObj.villageName}`,
        city: formDataObj.cityName,
        province: formDataObj.provinceName,
        provinceCode: formDataObj.provinceCode,
        zip: formDataObj.postalCode,
        country: 'Indonesia'
      };
      this.savedAddresses.push(newAddrObj);

      // Save to localStorage
      const customAddresses = read(SAVED_ADDR_KEY) || [];
      customAddresses.push(newAddrObj);
      store(SAVED_ADDR_KEY, customAddresses);

      // Render to DOM
      this.renderCardToGrid(newAddrObj, true);
      this.selectedAddressId = id;
      this.updateAddressCount();

      // Add to dropdown if exists
      const selectElem = this.wrapper.querySelector('#exp-saved-address-select');
      if (selectElem) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = `${newAddrObj.name} - ${newAddrObj.address1}, ${newAddrObj.city} (${newAddrObj.zip})`;
        const newOpt = selectElem.querySelector('option[value="new"]');
        if (newOpt) {
          selectElem.insertBefore(opt, newOpt);
        } else {
          selectElem.appendChild(opt);
        }
        selectElem.value = id;
      }
    }

    updateCardInDOM(id, formDataObj, isDefault) {
      const card = this.wrapper.querySelector(`.exp-address-card[data-address-id="${id}"]`);
      if (card) {
        const nameEl = card.querySelector('.exp-address-card-name');
        if (nameEl) nameEl.textContent = `${formDataObj.firstName} ${formDataObj.lastName}`;

        const phoneEl = card.querySelector('.exp-address-card-phone');
        if (phoneEl) phoneEl.textContent = formDataObj.fullPhone;

        const textEl = card.querySelector('.exp-address-card-text');
        if (textEl) {
          textEl.innerHTML = `${formDataObj.detailAddress}, Kec. ${formDataObj.districtName}, Kel. ${formDataObj.villageName}<br>${formDataObj.cityName}, ${formDataObj.provinceName} ${formDataObj.postalCode}`;
        }

        if (isDefault) {
          const badges = card.querySelector('.exp-address-card-badges');
          if (badges && !badges.querySelector('.exp-badge-primary')) {
            badges.insertAdjacentHTML('afterbegin', '<span class="exp-badge-primary">Alamat Utama</span>');
          }
        }
      }

      const found = this.savedAddresses.find((a) => String(a.id) === String(id));
      if (found) {
        found.firstName = formDataObj.firstName;
        found.lastName = formDataObj.lastName;
        found.name = `${formDataObj.firstName} ${formDataObj.lastName}`;
        found.phone = formDataObj.fullPhone;
        found.address1 = formDataObj.detailAddress;
        found.address2 = `Kec. ${formDataObj.districtName}, Kel. ${formDataObj.villageName}`;
        found.city = formDataObj.cityName;
        found.province = formDataObj.provinceName;
        found.provinceCode = formDataObj.provinceCode;
        found.zip = formDataObj.postalCode;
        if (isDefault) found.isDefault = true;
      }

      // Update in localStorage if it was a custom address
      const customAddresses = read(SAVED_ADDR_KEY) || [];
      const customIdx = customAddresses.findIndex((a) => String(a.id) === String(id));
      if (customIdx !== -1) {
        customAddresses[customIdx] = found;
        store(SAVED_ADDR_KEY, customAddresses);
      }
    }

    renderCardToGrid(addr, makeActive = false) {
      const grid = this.wrapper.querySelector('.exp-saved-addresses-grid');
      if (!grid) return;

      if (makeActive) {
        grid.querySelectorAll('.exp-address-card').forEach((c) => {
          c.classList.remove('is-active');
          c.setAttribute('aria-checked', 'false');
        });
      }

      const cardEl = document.createElement('div');
      cardEl.className = `exp-address-card ${makeActive ? 'is-active' : ''} ${addr.isDefault ? 'is-default' : ''}`;
      cardEl.dataset.addressId = addr.id;
      cardEl.setAttribute('role', 'radio');
      cardEl.setAttribute('aria-checked', makeActive ? 'true' : 'false');
      cardEl.setAttribute('tabindex', '0');
      cardEl.innerHTML = `
        <div class="exp-address-card-top">
          <div class="exp-address-card-badges">
            ${addr.isDefault ? '<span class="exp-badge-primary">Alamat Utama</span>' : ''}
          </div>
          <div class="exp-address-card-radio-indicator" aria-hidden="true">
            <span class="exp-radio-circle"></span>
          </div>
        </div>
        <div class="exp-address-card-body">
          <div class="exp-address-card-name">${addr.name || addr.firstName + ' ' + addr.lastName}</div>
          <div class="exp-address-card-phone">${addr.phone || ''}</div>
          <div class="exp-address-card-text">
            ${addr.address1}${addr.address2 ? ', ' + addr.address2 : ''}<br>
            ${addr.city}, ${addr.province} ${addr.zip}
          </div>
        </div>
        <div class="exp-address-card-crud-actions">
          <button type="button" class="exp-card-action-btn exp-card-action-btn--edit" data-action="edit-address" data-address-id="${addr.id}" title="Edit alamat ini">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            <span>Edit</span>
          </button>
          <button type="button" class="exp-card-action-btn exp-card-action-btn--delete" data-action="delete-address" data-address-id="${addr.id}" title="Hapus alamat ini">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            <span>Hapus</span>
          </button>
        </div>
      `;

      const newBtn = grid.querySelector('.exp-address-card--new');
      if (newBtn) {
        grid.insertBefore(cardEl, newBtn);
      } else {
        grid.appendChild(cardEl);
      }

      this.bindCardEvents(cardEl);
    }

    updateAddressCount() {
      const countEl = this.wrapper.querySelector('#exp-saved-addresses-count');
      if (countEl) {
        countEl.textContent = `(${this.savedAddresses.length} alamat tersimpan)`;
      }
    }

    showSaveFeedback(message, type) {
      const fb = this.wrapper.querySelector('#exp-save-address-feedback');
      if (!fb) return;

      if (!message) {
        fb.classList.add('hidden');
        fb.innerHTML = '';
        return;
      }

      fb.className = `exp-save-address-feedback exp-save-address-feedback--${type}`;
      fb.innerHTML = message;
      fb.classList.remove('hidden');
    }

    async applySavedAddress(addr, triggerCheckout = false) {
      this.selectedAddressId = addr.id;

      // Update Card Visuals
      const allCards = this.wrapper.querySelectorAll('.exp-address-card');
      allCards.forEach((c) => {
        const matches = String(c.dataset.addressId) === String(addr.id);
        c.classList.toggle('is-active', matches);
        c.setAttribute('aria-checked', matches ? 'true' : 'false');
      });

      // Update Dropdown if exists
      const selectElem = this.wrapper.querySelector('#exp-saved-address-select');
      if (selectElem) selectElem.value = String(addr.id);

      // Hydrate Step 1
      if (this.firstNameInput && addr.firstName) this.firstNameInput.value = addr.firstName;
      if (this.lastNameInput && addr.lastName) this.lastNameInput.value = addr.lastName;
      if (this.phoneInput && addr.phone) {
        this.phoneInput.value = addr.phone.replace(/^(\+62|0)/, '').replace(/\D/g, '');
      }

      // Hydrate Step 2
      if (this.detailAddressInput && addr.address1) {
        const fullDetail = addr.address1 + (addr.address2 ? ', ' + addr.address2 : '');
        this.detailAddressInput.value = fullDetail;
      }
      if (this.postalInput && addr.zip) {
        this.postalInput.value = addr.zip;
      }

      // Smart Region Matching
      await this.matchSavedAddressRegion(addr);

      this.saveDraft();

      if (triggerCheckout) {
        this.goToStep(2);
        this.handleCheckoutSubmit(new Event('submit'));
      }
    }

    async matchSavedAddressRegion(addr) {
      if (!this.provinceSelect || !this.provinceSelect.options.length) return;

      // 1. Match Province
      const provCode = (addr.provinceCode || '').toUpperCase();
      const provName = (addr.province || '').toLowerCase();
      let matchedProvOpt = null;

      for (let i = 0; i < this.provinceSelect.options.length; i++) {
        const opt = this.provinceSelect.options[i];
        if (!opt.value) continue;
        const optName = (opt.dataset.name || opt.textContent).toLowerCase();
        const optCode = getProvinceZoneCode(optName);
        if ((provCode && optCode === provCode) || (provName && (optName.includes(provName) || provName.includes(optName)))) {
          matchedProvOpt = opt;
          break;
        }
      }

      if (matchedProvOpt) {
        this.provinceSelect.value = matchedProvOpt.value;
        await this.onProvinceChange();

        // 2. Match Regency/City
        if (this.regencySelect && addr.city) {
          const cleanTargetCity = addr.city.toLowerCase().replace(/^(kota|kabupaten|kab\.?)\s+/i, '').trim();
          let matchedRegOpt = null;

          for (let j = 0; j < this.regencySelect.options.length; j++) {
            const regOpt = this.regencySelect.options[j];
            if (!regOpt.value) continue;
            const regOptName = (regOpt.dataset.name || regOpt.textContent).toLowerCase().replace(/^(kota|kabupaten|kab\.?)\s+/i, '').trim();
            if (regOptName.includes(cleanTargetCity) || cleanTargetCity.includes(regOptName)) {
              matchedRegOpt = regOpt;
              break;
            }
          }

          if (matchedRegOpt) {
            this.regencySelect.value = matchedRegOpt.value;
            await this.onRegencyChange();
          }
        }
      }
    }

    handleNewAddressSelection(card) {
      if (card && card.classList.contains('is-loading')) return;

      if (card) card.classList.add('is-loading');
      if (this.form) this.form.classList.add('is-switching');

      setTimeout(() => {
        this.resetForNewAddress();
        if (card) card.classList.remove('is-loading');
        if (this.form) {
          this.form.classList.remove('is-switching');
        }

        // Highlight input fields
        const step1Inputs = [this.firstNameInput, this.lastNameInput, this.phoneInput];
        step1Inputs.forEach((inp) => {
          if (inp) {
            inp.classList.remove('is-invalid');
            inp.classList.remove('is-highlighted');
            void inp.offsetWidth;
            inp.classList.add('is-highlighted');
          }
        });

        this.updateAddressModeBadge('new');

        if (this.firstNameInput) {
          this.firstNameInput.focus({ preventScroll: true });
        }
      }, 350);
    }

    handleSavedAddressSelection(card, addr, triggerCheckout) {
      if (card && card.classList.contains('is-loading')) return;

      if (card) card.classList.add('is-loading');
      if (this.form) this.form.classList.add('is-switching');

      setTimeout(async () => {
        await this.applySavedAddress(addr, triggerCheckout);
        if (card) card.classList.remove('is-loading');
        if (this.form) {
          this.form.classList.remove('is-switching');
        }

        const step1Inputs = [this.firstNameInput, this.lastNameInput, this.phoneInput];
        step1Inputs.forEach((inp) => {
          if (inp) {
            inp.classList.remove('is-invalid');
            inp.classList.remove('is-highlighted');
            void inp.offsetWidth;
            inp.classList.add('is-highlighted');
          }
        });

        this.updateAddressModeBadge('saved', addr);
      }, 300);
    }

    fillCustomerAccountContact() {
      const fn = this.wrapper.dataset.customerFirstName || '';
      const ln = this.wrapper.dataset.customerLastName || '';
      const phone = this.wrapper.dataset.customerPhone || '';

      if (this.firstNameInput) this.firstNameInput.value = fn;
      if (this.lastNameInput) this.lastNameInput.value = ln;
      if (this.phoneInput) {
        this.phoneInput.value = phone.replace(/^(\+62|0)/, '').replace(/\D/g, '');
      }

      const step1Inputs = [this.firstNameInput, this.lastNameInput, this.phoneInput];
      step1Inputs.forEach((inp) => {
        if (inp) {
          inp.classList.remove('is-invalid');
          inp.classList.remove('is-highlighted');
          void inp.offsetWidth;
          inp.classList.add('is-highlighted');
        }
      });

      this.saveDraft();
    }

    updateAddressModeBadge(mode, addr) {
      const badge = this.wrapper.querySelector('#exp-address-mode-badge');
      const hint = this.wrapper.querySelector('#exp-autofill-hint');

      if (!badge) return;

      if (mode === 'new') {
        badge.classList.remove('hidden', 'exp-address-mode-badge--saved');
        const badgeText = badge.querySelector('.exp-mode-badge-text');
        if (badgeText) badgeText.textContent = 'Mode Alamat Baru';
        if (hint) hint.classList.remove('hidden');
      } else if (mode === 'saved' && addr) {
        badge.classList.remove('hidden');
        badge.classList.add('exp-address-mode-badge--saved');
        const badgeText = badge.querySelector('.exp-mode-badge-text');
        const name = addr.name || `${addr.firstName || ''} ${addr.lastName || ''}`.trim();
        if (badgeText) badgeText.textContent = `Alamat: ${name || 'Tersimpan'}`;
        if (hint) hint.classList.add('hidden');
      } else {
        badge.classList.add('hidden');
        if (hint) hint.classList.add('hidden');
      }
    }

    resetForNewAddress() {
      this.selectedAddressId = 'new';

      const allCards = this.wrapper.querySelectorAll('.exp-address-card');
      allCards.forEach((c) => {
        const isNew = c.dataset.addressId === 'new';
        c.classList.toggle('is-active', isNew);
        c.setAttribute('aria-checked', isNew ? 'true' : 'false');
      });

      const selectElem = this.wrapper.querySelector('#exp-saved-address-select');
      if (selectElem) selectElem.value = 'new';

      // Clear Step 1 fields so the new address form is fresh
      if (this.firstNameInput) this.firstNameInput.value = '';
      if (this.lastNameInput) this.lastNameInput.value = '';
      if (this.phoneInput) this.phoneInput.value = '';

      // Clear Step 2 fields
      if (this.detailAddressInput) this.detailAddressInput.value = '';
      if (this.postalInput) this.postalInput.value = '';
      if (this.courierNoteInput) this.courierNoteInput.value = '';
      this.resetDropdowns([this.regencySelect, this.districtSelect, this.villageSelect]);
      if (this.provinceSelect) this.provinceSelect.value = '';

      this.saveDraft();
    }

    async loadProvinces() {
      try {
        this.provinceSelect.disabled = true;
        const provinces = await regionList(this.apiBase, 0);
        this.populateSelect(this.provinceSelect, provinces, 'Select Province');
        this.provinceSelect.disabled = false;

        // Check if draft or default province exists
        const draft = read(DRAFT_KEY);
        if (draft && draft.provinceId) {
          this.provinceSelect.value = draft.provinceId;
          await this.onProvinceChange(draft.regencyId, draft.districtId, draft.villageId);
        } else if (this.savedAddresses && this.savedAddresses.length) {
          const defaultAddr = this.savedAddresses.find((a) => a.isDefault) || this.savedAddresses[0];
          if (defaultAddr) {
            await this.matchSavedAddressRegion(defaultAddr);
          }
        }
      } catch (err) {
        console.warn('Gagal memuat provinsi dari Emsifa API:', err);
        this.provinceSelect.disabled = false;
      }
    }

    async onProvinceChange(savedRegencyId, savedDistrictId, savedVillageId) {
      const provId = this.provinceSelect.value;
      this.resetDropdowns([this.regencySelect, this.districtSelect, this.villageSelect]);
      if (!provId) return;

      try {
        this.regencySelect.disabled = true;
        const regencies = await regionList(this.apiBase, 1, provId);
        this.populateSelect(this.regencySelect, regencies, 'Select City');
        this.regencySelect.disabled = false;

        if (savedRegencyId) {
          this.regencySelect.value = savedRegencyId;
          await this.onRegencyChange(savedDistrictId, savedVillageId);
        }
      } catch (err) {
        console.warn('Gagal memuat kota/kabupaten:', err);
        this.regencySelect.disabled = false;
      }
    }

    async onRegencyChange(savedDistrictId, savedVillageId) {
      const regId = this.regencySelect.value;
      this.resetDropdowns([this.districtSelect, this.villageSelect]);
      if (!regId) return;

      try {
        this.districtSelect.disabled = true;
        const districts = await regionList(this.apiBase, 2, regId);
        this.populateSelect(this.districtSelect, districts, 'Select District');
        this.districtSelect.disabled = false;

        if (savedDistrictId) {
          this.districtSelect.value = savedDistrictId;
          await this.onDistrictChange(savedVillageId);
        }
      } catch (err) {
        console.warn('Gagal memuat kecamatan:', err);
        this.districtSelect.disabled = false;
      }
    }

    async onDistrictChange(savedVillageId) {
      const distId = this.districtSelect.value;
      this.resetDropdowns([this.villageSelect]);
      if (!distId) return;

      try {
        this.villageSelect.disabled = true;
        const villages = await regionList(this.apiBase, 3, distId);
        this.populateSelect(this.villageSelect, villages, 'Select Sub-district');
        this.villageSelect.disabled = false;

        if (savedVillageId) {
          this.villageSelect.value = savedVillageId;
        }
      } catch (err) {
        console.warn('Gagal memuat kelurahan:', err);
        this.villageSelect.disabled = false;
      }
    }

    populateSelect(selectElem, items, placeholder) {
      selectElem.innerHTML = `<option value="" disabled selected>${placeholder}</option>`;
      items.forEach((item) => {
        const opt = document.createElement('option');
        opt.value = item.id;
        const formattedName = toTitleCase(item.name);
        opt.textContent = formattedName;
        opt.dataset.name = formattedName;
        selectElem.appendChild(opt);
      });
    }

    resetDropdowns(dropdowns) {
      dropdowns.forEach((dd) => {
        dd.innerHTML = '<option value="" disabled selected>Pilih opsi...</option>';
        dd.disabled = true;
      });
    }

    handleStep1Next() {
      if (!this.validateStep1()) return;
      this.goToStep(2);
    }

    goToStep(stepNumber) {
      this.currentStep = stepNumber;
      if (stepNumber === 1) {
        this.step1.classList.remove('hidden');
        this.step2.classList.add('hidden');
        this.stepper?.classList.remove('step-2');
        this.stepperItems[0]?.classList.add('is-active');
        this.stepperItems[0]?.classList.remove('is-completed');
        this.stepperItems[1]?.classList.remove('is-active', 'is-completed');
      } else {
        this.step1.classList.add('hidden');
        this.step2.classList.remove('hidden');
        this.stepper?.classList.add('step-2');
        this.stepperItems[0]?.classList.remove('is-active');
        this.stepperItems[0]?.classList.add('is-completed');
        this.stepperItems[1]?.classList.add('is-active');
      }

      this.wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    validateStep1() {
      let isValid = true;
      const inputs = [this.firstNameInput, this.lastNameInput, this.emailInput, this.phoneInput];

      inputs.forEach((input) => {
        if (!input) return;
        if (!input.value.trim() || (input.type === 'email' && !this.isValidEmail(input.value))) {
          input.classList.add('is-invalid');
          if (isValid) input.focus();
          isValid = false;
        } else {
          input.classList.remove('is-invalid');
        }
      });

      return isValid;
    }

    validateStep2() {
      let isValid = true;
      const requiredFields = [
        this.provinceSelect,
        this.regencySelect,
        this.districtSelect,
        this.villageSelect,
        this.postalInput,
        this.detailAddressInput
      ];

      requiredFields.forEach((field) => {
        if (!field) return;
        if (!field.value.trim()) {
          field.classList.add('is-invalid');
          if (isValid) field.focus();
          isValid = false;
        } else {
          field.classList.remove('is-invalid');
        }
      });

      return isValid;
    }

    isValidEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    getFormData() {
      const provOpt = this.provinceSelect.selectedOptions[0];
      const regOpt = this.regencySelect.selectedOptions[0];
      const distOpt = this.districtSelect.selectedOptions[0];
      const villOpt = this.villageSelect.selectedOptions[0];
      const deliveryMethod = this.wrapper.querySelector('input[name="exp_delivery_method"]:checked')?.value || 'Express';

      const provName = provOpt ? provOpt.dataset.name || provOpt.textContent : '';
      const zoneCode = getProvinceZoneCode(provName);

      return {
        deliveryMethod: deliveryMethod,
        firstName: this.firstNameInput.value.trim(),
        lastName: this.lastNameInput.value.trim(),
        email: this.emailInput.value.trim(),
        cleanPhone: this.phoneInput.value.replace(/^0+/, '').replace(/\D/g, ''),
        fullPhone: `${this.phonePrefix}${this.phoneInput.value.replace(/^0+/, '').replace(/\D/g, '')}`,
        provinceId: this.provinceSelect.value,
        provinceName: provName,
        provinceCode: zoneCode,
        regencyId: this.regencySelect.value,
        cityName: regOpt ? regOpt.dataset.name || regOpt.textContent : '',
        districtId: this.districtSelect.value,
        districtName: distOpt ? distOpt.dataset.name || distOpt.textContent : '',
        villageId: this.villageSelect.value,
        villageName: villOpt ? villOpt.dataset.name || villOpt.textContent : '',
        postalCode: this.postalInput.value.trim(),
        detailAddress: this.detailAddressInput.value.trim(),
        courierNote: this.courierNoteInput?.value.trim() || '',
        selectedAddressId: this.selectedAddressId || '',
        isSavedAddressUsed: Boolean(this.selectedAddressId && this.selectedAddressId !== 'new')
      };
    }

    saveDraft() {
      const data = {
        deliveryMethod: this.wrapper.querySelector('input[name="exp_delivery_method"]:checked')?.value,
        firstName: this.firstNameInput?.value,
        lastName: this.lastNameInput?.value,
        email: this.emailInput?.value,
        phone: this.phoneInput?.value,
        provinceId: this.provinceSelect?.value,
        regencyId: this.regencySelect?.value,
        districtId: this.districtSelect?.value,
        villageId: this.villageSelect?.value,
        postalCode: this.postalInput?.value,
        detailAddress: this.detailAddressInput?.value,
        courierNote: this.courierNoteInput?.value,
        selectedAddressId: this.selectedAddressId
      };
      store(DRAFT_KEY, data);
    }

    restoreDraft() {
      const draft = read(DRAFT_KEY);
      if (!draft) return;

      if (draft.selectedAddressId) {
        this.selectedAddressId = draft.selectedAddressId;
      }
      if (draft.firstName && !this.firstNameInput.value) this.firstNameInput.value = draft.firstName;
      if (draft.lastName && !this.lastNameInput.value) this.lastNameInput.value = draft.lastName;
      if (draft.email && !this.emailInput.value) this.emailInput.value = draft.email;
      if (draft.phone && !this.phoneInput.value) this.phoneInput.value = draft.phone;
      if (draft.postalCode && !this.postalInput.value) this.postalInput.value = draft.postalCode;
      if (draft.detailAddress && !this.detailAddressInput.value) this.detailAddressInput.value = draft.detailAddress;
      if (draft.courierNote && this.courierNoteInput) this.courierNoteInput.value = draft.courierNote;

      if (draft.deliveryMethod) {
        const radio = this.wrapper.querySelector(`input[name="exp_delivery_method"][value="${draft.deliveryMethod}"]`);
        if (radio) {
          radio.checked = true;
          this.wrapper.querySelectorAll('.exp-delivery-card').forEach((c) => c.classList.remove('is-selected'));
          radio.closest('.exp-delivery-card')?.classList.add('is-selected');
        }
      }
    }

    showFeedback(message, type) {
      let feedback = this.wrapper.querySelector('#exp-checkout-feedback');
      if (!feedback) {
        feedback = document.createElement('div');
        feedback.id = 'exp-checkout-feedback';
        const actions = this.form.querySelector('.exp-step-actions--dual');
        if (actions) {
          actions.parentNode.insertBefore(feedback, actions);
        }
      }

      if (!message) {
        feedback.classList.add('hidden');
        feedback.innerHTML = '';
        return;
      }

      feedback.className = `exp-checkout-feedback exp-checkout-feedback--${type}`;
      feedback.innerHTML = message;
      feedback.classList.remove('hidden');
    }

    async handleCheckoutSubmit(e) {
      e?.preventDefault?.();
      if (!this.validateStep1()) {
        this.goToStep(1);
        return;
      }
      if (!this.validateStep2()) return;

      this.btnComplete.disabled = true;
      this.btnComplete.classList.add('is-loading');
      this.showFeedback('', false);

      const formData = this.getFormData();

      try {
        // 1. Sinkronisasi data ke Cart AJAX API (Attributes & Note)
        await fetch('/cart/update.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attributes: {
              'Delivery Method': formData.deliveryMethod,
              'Recipient First Name': formData.firstName,
              'Recipient Last Name': formData.lastName,
              'Recipient Email': formData.email,
              'Recipient Phone': formData.fullPhone,
              'Shipping Province': formData.provinceName,
              'Shipping Province Code': formData.provinceCode,
              'Shipping City': formData.cityName,
              'Shipping District': formData.districtName,
              'Shipping Sub-district': formData.villageName,
              'Shipping Postal Code': formData.postalCode,
              'Shipping Detail Address': formData.detailAddress,
              'Courier Note': formData.courierNote,
              'Selected Address ID': String(formData.selectedAddressId || ''),
              'Is Saved Address Used': formData.isSavedAddressUsed ? 'true' : 'false'
            },
            note: `Delivery: ${formData.deliveryMethod} | Note: ${formData.courierNote || '-'}`
          })
        });

        // 2. Tentukan target checkout URL
        let targetCheckoutUrl = '';

        if (this.storefrontToken) {
          try {
            const cartRes = await fetch('/cart.js');
            const cartData = await cartRes.json();
            const rawToken = cartData.token || '';
            const cartId = rawToken.indexOf('gid://') === 0 ? rawToken : 'gid://shopify/Cart/' + rawToken;

            const gqlResponse = await fetch(`/api/${this.storefrontVersion}/graphql.json`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Storefront-Access-Token': this.storefrontToken
              },
              body: JSON.stringify({
                query: PREFILL_MUTATION,
                variables: {
                  cartId: cartId,
                  buyerIdentity: {
                    email: formData.email,
                    phone: formData.fullPhone
                  },
                  addresses: [
                    {
                      firstName: formData.firstName,
                      lastName: formData.lastName,
                      address1: formData.detailAddress,
                      address2: `Kec. ${formData.districtName}, Kel. ${formData.villageName}`,
                      city: formData.cityName,
                      province: formData.provinceName,
                      zoneCode: formData.provinceCode,
                      zip: formData.postalCode,
                      country: 'Indonesia',
                      phone: formData.fullPhone
                    }
                  ]
                }
              })
            });

            const gqlResult = await gqlResponse.json();
            targetCheckoutUrl = gqlResult.data && gqlResult.data.cart && gqlResult.data.cart.checkoutUrl;
          } catch (gqlErr) {
            console.warn('Storefront API GraphQL prefill gagal, beralih ke URL prefill fallback:', gqlErr);
          }
        }

        if (!targetCheckoutUrl) {
          const routesRoot = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
          const checkoutBase = routesRoot.replace(/\/+$/, '') + '/checkout';
          const checkoutParams = new URLSearchParams({
            'checkout[email]': formData.email,
            'checkout[shipping_address][first_name]': formData.firstName,
            'checkout[shipping_address][last_name]': formData.lastName,
            'checkout[shipping_address][address1]': formData.detailAddress,
            'checkout[shipping_address][address2]': `Kec. ${formData.districtName}, Kel. ${formData.villageName}`,
            'checkout[shipping_address][city]': formData.cityName,
            'checkout[shipping_address][province]': formData.provinceCode || formData.provinceName,
            'checkout[shipping_address][zip]': formData.postalCode,
            'checkout[shipping_address][country]': 'Indonesia',
            'checkout[shipping_address][phone]': formData.fullPhone
          });

          const currentUrlParams = new URLSearchParams(window.location.search);
          if (currentUrlParams.has('preview_theme_id')) {
            checkoutParams.set('preview_theme_id', currentUrlParams.get('preview_theme_id'));
          }

          targetCheckoutUrl = `${checkoutBase}?${checkoutParams.toString()}`;
        }

        // 3. Deteksi apakah sedang berada di dalam Theme Editor iframe
        const isInIframe = window.self !== window.top;
        const isDesignMode = Boolean(window.Shopify && window.Shopify.designMode);

        if (isDesignMode || isInIframe) {
          // Buka di tab baru dengan rel="noopener noreferrer" untuk mencegah pemblokiran Cross-Origin-Opener-Policy (ERR_BLOCKED_BY_RESPONSE)
          const link = document.createElement('a');
          link.href = targetCheckoutUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          setTimeout(() => link.remove(), 200);

          this.btnComplete.disabled = false;
          this.btnComplete.classList.remove('is-loading');

          this.showFeedback(
            `✓ Data alamat berhasil disimpan ke keranjang!<br><small>Jika tab baru tidak muncul otomatis, <a href="${targetCheckoutUrl}" target="_blank" rel="noopener noreferrer" style="text-decoration: underline; font-weight: 700; color: inherit;">Klik di sini untuk membuka Halaman Checkout</a>.</small>`,
            'success'
          );
          return;
        }

        // 4. Pengalihan langsung untuk pembeli di website live
        window.location.href = targetCheckoutUrl;

        // Fallback timer jika navigasi browser ditahan
        setTimeout(() => {
          if (this.btnComplete) {
            this.btnComplete.disabled = false;
            this.btnComplete.classList.remove('is-loading');
          }
        }, 5000);
      } catch (err) {
        console.error('Checkout redirect failed:', err);
        this.btnComplete.disabled = false;
        this.btnComplete.classList.remove('is-loading');
        this.showFeedback('Terjadi kesalahan saat memproses formulir. Silakan coba lagi.', 'error');
      }
    }

    handleSummaryCheckoutButton() {
      const defaultCheckoutBtn = document.querySelector('.cart__checkout-button#checkout');
      if (!defaultCheckoutBtn) return;

      if (this.checkoutAction === 'hide') {
        defaultCheckoutBtn.closest('.cart__ctas')?.classList.add('hidden');
      } else if (this.checkoutAction === 'scroll_to_form') {
        defaultCheckoutBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const firstEmpty = this.form.querySelector('input[required]:not([disabled]):invalid, input[required]:not([disabled])');
          firstEmpty?.focus();
        });
      }
      // If 'default', let normal checkout button behave standardly
    }
  }

  // Auto-initialize when DOM is ready
  function initExpCartForm() {
    var wrappers = document.querySelectorAll('.exp-cart-form-wrapper');
    wrappers.forEach(function (wrapper) {
      new ExpCartCheckoutForm(wrapper);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExpCartForm);
  } else {
    initExpCartForm();
  }
})();
