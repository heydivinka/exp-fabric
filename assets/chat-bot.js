/**
 * chat-bot.js
 * Self-contained customer service chatbot — multi-language, FAQ-based.
 * Languages: en (default), id, fr, de, es, ja
 */

/** @typedef {{ title: string, subtitle: string, placeholder: string, send: string, greeting: string, fallback: string, quick_replies: string[] }} I18nEntry */
/** @typedef {{ keys: string[], answer: string }} KbEntry */

/* ─── i18n ──────────────────────────────────────────────────────────── */
/** @type {Record<string, I18nEntry>} */
const I18N = {
  en: {
    title: 'Customer Support', subtitle: 'Typically replies instantly',
    placeholder: 'Type a message…', send: 'Send',
    greeting: "Hi there 👋 How can I help? Ask about **orders**, **shipping**, **returns**, **products**, or **contact**.",
    fallback: "I'm not sure about that. Try asking about **orders**, **shipping**, **returns**, **products**, or type **contact**.",
    quick_replies: ['Orders', 'Shipping', 'Returns', 'Products', 'Contact'],
  },
  id: {
    title: 'Layanan Pelanggan', subtitle: 'Biasanya membalas seketika',
    placeholder: 'Ketik pesan…', send: 'Kirim',
    greeting: "Halo! 👋 Ada yang bisa kami bantu? Tanya tentang **pesanan**, **pengiriman**, **pengembalian**, **produk**, atau **kontak**.",
    fallback: "Maaf, coba tanya tentang **pesanan**, **pengiriman**, **pengembalian**, **produk**, atau ketik **kontak**.",
    quick_replies: ['Pesanan', 'Pengiriman', 'Pengembalian', 'Produk', 'Kontak'],
  },
  fr: {
    title: 'Service Client', subtitle: 'Répond généralement instantanément',
    placeholder: 'Tapez un message…', send: 'Envoyer',
    greeting: "Bonjour 👋 Comment puis-je vous aider ? Posez des questions sur les **commandes**, **livraison**, **retours**, **produits** ou **contact**.",
    fallback: "Je ne suis pas sûr. Essayez **commandes**, **livraison**, **retours**, **produits**, ou tapez **contact**.",
    quick_replies: ['Commandes', 'Livraison', 'Retours', 'Produits', 'Contact'],
  },
  de: {
    title: 'Kundendienst', subtitle: 'Antwortet in der Regel sofort',
    placeholder: 'Nachricht eingeben…', send: 'Senden',
    greeting: "Hallo 👋 Wie kann ich helfen? Fragen Sie nach **Bestellungen**, **Versand**, **Rücksendungen**, **Produkten** oder **Kontakt**.",
    fallback: "Das habe ich nicht verstanden. Versuchen Sie **Bestellungen**, **Versand**, **Rücksendungen**, **Produkte** oder **Kontakt**.",
    quick_replies: ['Bestellungen', 'Versand', 'Rücksendungen', 'Produkte', 'Kontakt'],
  },
  es: {
    title: 'Servicio al Cliente', subtitle: 'Generalmente responde al instante',
    placeholder: 'Escribe un mensaje…', send: 'Enviar',
    greeting: "¡Hola! 👋 ¿En qué puedo ayudarte? Pregunta sobre **pedidos**, **envíos**, **devoluciones**, **productos** o **contacto**.",
    fallback: "No estoy seguro. Prueba **pedidos**, **envíos**, **devoluciones**, **productos** o **contacto**.",
    quick_replies: ['Pedidos', 'Envíos', 'Devoluciones', 'Productos', 'Contacto'],
  },
  ja: {
    title: 'カスタマーサポート', subtitle: '通常すぐに返信します',
    placeholder: 'メッセージを入力…', send: '送信',
    greeting: "こんにちは！👋 ご用件は？**注文**、**配送**、**返品**、**商品**、または**お問い合わせ**についてどうぞ。",
    fallback: "よく分かりませんでした。**注文**、**配送**、**返品**、**商品**、または**お問い合わせ**をお試しください。",
    quick_replies: ['注文', '配送', '返品', '商品', 'お問い合わせ'],
  },
};

/* ─── Knowledge base ────────────────────────────────────────────────── */
/** @type {Record<string, KbEntry[]>} */
const KB = {
  en: [
    { keys: ['order','orders','track','tracking','status'], answer: "**Order Tracking**\nVisit your [account orders page](/account/orders) or use the tracking link in your confirmation email.\n\nOrders ship within 1–2 business days. Need more help? Type **contact**." },
    { keys: ['ship','shipping','delivery','deliver','arrive','how long'], answer: "**Shipping**\n• Standard: 5–7 business days\n• Express: 2–3 business days\n• Free shipping on orders over $75\n\nType **contact** for international specifics." },
    { keys: ['return','returns','refund','exchange','policy'], answer: "**Returns & Exchanges**\nWe accept returns within **30 days**.\n\n✔ Unworn, in original packaging\n✔ Start from your [account page](/account)\n✔ Refunds in 5–7 business days\n\nQuestions? Type **contact**." },
    { keys: ['product','products','size','sizes','fit','material','fabric','stock'], answer: "**Product Help**\nSize guides are on each product page. Our items use sustainably sourced fabrics.\n\nNeed specifics? Type **contact**." },
    { keys: ['contact','email','phone','human','agent','support','help'], answer: "**Contact Us**\n📧 hello@yourbrand.com\n📞 +1 (800) 000-0000\n🕐 Mon–Fri, 9am–6pm EST\n\n[Contact page](/pages/contact)" },
    { keys: ['payment','pay','card','credit','paypal','checkout'], answer: "**Payment Methods**\nVisa, Mastercard, Amex, PayPal, Apple Pay, Google Pay.\n\nAll transactions are secured and encrypted." },
    { keys: ['discount','promo','code','coupon','sale'], answer: "**Discounts & Promos**\nEnter your promo code at checkout. One code per order.\n\n💡 Sign up to our newsletter for exclusive offers!" },
    { keys: ['cancel','cancellation','modify'], answer: "**Cancel or Modify**\nOrders can be cancelled within **1 hour** of placing them.\n\nContact us immediately at hello@yourbrand.com or type **contact**." },
  ],
  id: [
    { keys: ['pesanan','lacak','pelacakan','status','order'], answer: "**Pelacakan Pesanan**\nLacak di [halaman pesanan akun](/account/orders) atau gunakan tautan di email konfirmasi.\n\nPesanan dikirim dalam 1–2 hari kerja. Ketik **kontak** untuk bantuan lebih." },
    { keys: ['kirim','pengiriman','ongkir','tiba','berapa lama','delivery'], answer: "**Pengiriman**\n• Reguler: 5–7 hari kerja\n• Ekspres: 2–3 hari kerja\n• Gratis ongkir di atas Rp500.000\n\nKetik **kontak** untuk info lebih lanjut." },
    { keys: ['kembali','pengembalian','refund','tukar','retur'], answer: "**Pengembalian**\nDiterima dalam **30 hari** setelah pembelian.\n\n✔ Belum dipakai, kemasan asli\n✔ Mulai dari [halaman akun](/account)\n✔ Refund dalam 5–7 hari kerja\n\nKetik **kontak**." },
    { keys: ['produk','ukuran','size','bahan','material','stok'], answer: "**Info Produk**\nPanduan ukuran ada di setiap halaman produk. Bahan dari sumber berkelanjutan.\n\nKetik **kontak** untuk info spesifik." },
    { keys: ['kontak','email','telepon','cs','hubungi','bantuan'], answer: "**Hubungi Kami**\n📧 hello@yourbrand.com\n📞 +62 800 000 0000\n🕐 Sen–Jum, 09.00–18.00 WIB\n\n[Halaman kontak](/pages/contact)" },
    { keys: ['bayar','pembayaran','kartu','transfer','gopay','ovo','dana'], answer: "**Pembayaran**\nKartu kredit/debit, transfer bank, GoPay, OVO, DANA, PayPal.\n\nSemua transaksi aman dan terenkripsi." },
    { keys: ['diskon','promo','kode','voucher','sale'], answer: "**Promo**\nMasukkan kode promo saat checkout. Satu kode per pesanan.\n\n💡 Daftar newsletter untuk penawaran eksklusif!" },
    { keys: ['batal','batalkan','ubah','ganti pesanan'], answer: "**Batalkan Pesanan**\nBisa dibatalkan dalam **1 jam** setelah pemesanan.\n\nHubungi kami di hello@yourbrand.com atau ketik **kontak**." },
  ],
};

/* Supplement partial KB langs with EN fallback */
['fr','de','es','ja'].forEach((/** @type {string} */ lang) => {
  KB[lang] = KB['en'];
});

/* ─── Markdown-lite ─────────────────────────────────────────────────── */
/**
 * @param {string} text
 * @returns {string}
 */
function renderMd(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, '<br>');
}

/* ─── Bot engine ─────────────────────────────────────────────────────── */
class ChatBot {
  /** @param {string} [lang] */
  constructor(lang = 'en') { this.lang = lang; }

  /** @param {string} lang */
  setLang(lang) { this.lang = lang; }

  /** @param {string} key */
  t(key) {
    const locale = I18N[this.lang] ?? I18N['en'];
    return /** @type {string} */ (/** @type {Record<string,unknown>} */ (locale)[key] ?? '');
  }

  /** @param {string} input */
  respond(input) {
    const text = input.toLowerCase().trim();
    const kb   = KB[this.lang] ?? KB['en'];
    const hit  = kb.find((/** @type {KbEntry} */ e) => e.keys.some((/** @type {string} */ k) => text.includes(k)));
    return hit ? hit.answer : this.t('fallback');
  }

  quickReplies() {
    const locale = I18N[this.lang] ?? I18N['en'];
    return locale.quick_replies;
  }
}

/* ─── Widget ─────────────────────────────────────────────────────────── */
class ChatWidget {
  constructor() {
    this.bot     = new ChatBot('en');
    this.isOpen  = false;
    /** @type {{ role: string, text: string }[]} */
    this.history = [];
    this.el      = /** @type {HTMLElement|null} */ (document.getElementById('cb-widget'));
    if (!this.el) return;
    this.messagesEl = /** @type {HTMLElement|null} */ (this.el.querySelector('#cb-messages'));
    this.inputEl    = /** @type {HTMLInputElement|null} */ (this.el.querySelector('#cb-input'));
    this.sendBtn    = /** @type {HTMLElement|null} */ (this.el.querySelector('#cb-send'));
    this.toggleBtn  = /** @type {HTMLElement|null} */ (document.getElementById('cb-toggle'));
    this.closeBtn   = /** @type {HTMLElement|null} */ (this.el.querySelector('#cb-close'));
    this.langSel    = /** @type {HTMLSelectElement|null} */ (this.el.querySelector('#cb-lang'));
    this.badge      = /** @type {HTMLElement|null} */ (document.getElementById('cb-badge'));
    this.panel      = /** @type {HTMLElement|null} */ (this.el.querySelector('#cb-panel'));
    this.quickEl    = /** @type {HTMLElement|null} */ (this.el.querySelector('#cb-quick-replies'));
    this._bind();
    setTimeout(() => this.badge?.classList.remove('cb-hidden'), 4000);
  }

  _bind() {
    this.toggleBtn?.addEventListener('click', () => this.toggle());
    this.closeBtn?.addEventListener('click',  () => this.close());
    this.sendBtn?.addEventListener('click',   () => this._send());
    this.inputEl?.addEventListener('keydown', (/** @type {KeyboardEvent} */ e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._send(); }
    });
    this.langSel?.addEventListener('change', (/** @type {Event} */ e) => {
      this._changeLang(/** @type {HTMLSelectElement} */ (e.target).value);
    });
  }

  toggle() { this.isOpen ? this.close() : this.open(); }

  open() {
    this.isOpen = true;
    this.panel?.classList.replace('cb-panel--closed', 'cb-panel--open');
    this.toggleBtn?.setAttribute('aria-expanded', 'true');
    this.badge?.classList.add('cb-hidden');
    this.inputEl?.focus();
    if (this.history.length === 0) setTimeout(() => this._botMsg(this.bot.t('greeting')), 400);
  }

  close() {
    this.isOpen = false;
    this.panel?.classList.replace('cb-panel--open', 'cb-panel--closed');
    this.toggleBtn?.setAttribute('aria-expanded', 'false');
  }

  /** @param {string} lang */
  _changeLang(lang) {
    this.bot.setLang(lang);
    const titleEl    = /** @type {HTMLElement|null} */ (this.el?.querySelector('#cb-title'));
    const subtitleEl = /** @type {HTMLElement|null} */ (this.el?.querySelector('#cb-subtitle'));
    if (titleEl)    titleEl.textContent    = this.bot.t('title');
    if (subtitleEl) subtitleEl.textContent = this.bot.t('subtitle');
    if (this.inputEl)  this.inputEl.placeholder = this.bot.t('placeholder');
    if (this.sendBtn)  this.sendBtn.textContent  = this.bot.t('send');
    this._renderQR();
    this._botMsg(this.bot.t('greeting'));
  }

  /** @param {string} text */
  _botMsg(text) {
    this.history.push({ role: 'bot', text });
    this._appendMsg({ role: 'bot', text });
    this._renderQR();
  }

  /** @param {string} text */
  _userMsg(text) {
    this.history.push({ role: 'user', text });
    this._appendMsg({ role: 'user', text });
    if (this.quickEl) this.quickEl.innerHTML = '';
  }

  /** @param {{ role: string, text: string }} msg */
  _appendMsg({ role, text }) {
    if (!this.messagesEl) return;
    const wrap   = document.createElement('div');
    wrap.className = `cb-msg cb-msg--${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'cb-bubble';
    bubble.innerHTML = renderMd(text);
    const time   = document.createElement('time');
    time.className = 'cb-time';
    time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    wrap.append(bubble, time);
    this.messagesEl.append(wrap);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  _showTyping() {
    if (!this.messagesEl) return;
    const el = document.createElement('div');
    el.className = 'cb-msg cb-msg--bot cb-typing-wrap';
    el.id = 'cb-typing';
    el.innerHTML = `<div class="cb-bubble cb-typing"><span></span><span></span><span></span></div>`;
    this.messagesEl.append(el);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  _hideTyping() { document.getElementById('cb-typing')?.remove(); }

  _renderQR() {
    if (!this.quickEl) return;
    this.quickEl.innerHTML = '';
    this.bot.quickReplies().forEach((/** @type {string} */ label) => {
      const btn = document.createElement('button');
      btn.className = 'cb-qr';
      btn.textContent = label;
      btn.addEventListener('click', () => this._process(label));
      this.quickEl?.append(btn);
    });
  }

  _send() {
    const val = this.inputEl?.value.trim();
    if (!val) return;
    if (this.inputEl) this.inputEl.value = '';
    this._process(val);
  }

  /** @param {string} text */
  _process(text) {
    this._userMsg(text);
    this._showTyping();
    setTimeout(() => {
      this._hideTyping();
      this._botMsg(this.bot.respond(text));
    }, 700 + Math.random() * 600);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new ChatWidget());
} else {
  new ChatWidget();
}
