/**
 * chat-bot.js
 * Self-contained customer service chatbot with multi-language support.
 * Languages: en (default), id, fr, de, es, ja
 */

/* ─── i18n strings ──────────────────────────────────────────────────── */
const I18N = {
  en: {
    lang_name:       'English',
    title:           'Customer Support',
    subtitle:        'Typically replies instantly',
    placeholder:     'Type a message…',
    send:            'Send',
    lang_label:      'Language',
    greeting:        "Hi there 👋 How can I help you today? You can ask about **orders**, **shipping**, **returns**, **products**, or **contact**.",
    fallback:        "I'm not sure about that. Try asking about **orders**, **shipping**, **returns**, **products**, or type **contact** to reach our team.",
    quick_replies:   ['Orders', 'Shipping', 'Returns', 'Products', 'Contact'],
  },
  id: {
    lang_name:       'Indonesia',
    title:           'Layanan Pelanggan',
    subtitle:        'Biasanya membalas seketika',
    placeholder:     'Ketik pesan…',
    send:            'Kirim',
    lang_label:      'Bahasa',
    greeting:        "Halo! 👋 Ada yang bisa kami bantu? Tanya tentang **pesanan**, **pengiriman**, **pengembalian**, **produk**, atau **kontak** kami.",
    fallback:        "Maaf, kami belum paham pertanyaan itu. Coba tanya tentang **pesanan**, **pengiriman**, **pengembalian**, **produk**, atau ketik **kontak**.",
    quick_replies:   ['Pesanan', 'Pengiriman', 'Pengembalian', 'Produk', 'Kontak'],
  },
  fr: {
    lang_name:       'Français',
    title:           'Service Client',
    subtitle:        'Répond généralement instantanément',
    placeholder:     'Tapez un message…',
    send:            'Envoyer',
    lang_label:      'Langue',
    greeting:        "Bonjour 👋 Comment puis-je vous aider ? Posez des questions sur les **commandes**, **livraison**, **retours**, **produits** ou **contact**.",
    fallback:        "Je ne suis pas sûr. Essayez de demander les **commandes**, **livraison**, **retours**, **produits**, ou tapez **contact**.",
    quick_replies:   ['Commandes', 'Livraison', 'Retours', 'Produits', 'Contact'],
  },
  de: {
    lang_name:       'Deutsch',
    title:           'Kundendienst',
    subtitle:        'Antwortet in der Regel sofort',
    placeholder:     'Nachricht eingeben…',
    send:            'Senden',
    lang_label:      'Sprache',
    greeting:        "Hallo 👋 Wie kann ich helfen? Fragen Sie nach **Bestellungen**, **Versand**, **Rücksendungen**, **Produkten** oder **Kontakt**.",
    fallback:        "Das habe ich nicht verstanden. Versuchen Sie **Bestellungen**, **Versand**, **Rücksendungen**, **Produkte** oder **Kontakt**.",
    quick_replies:   ['Bestellungen', 'Versand', 'Rücksendungen', 'Produkte', 'Kontakt'],
  },
  es: {
    lang_name:       'Español',
    title:           'Servicio al Cliente',
    subtitle:        'Generalmente responde al instante',
    placeholder:     'Escribe un mensaje…',
    send:            'Enviar',
    lang_label:      'Idioma',
    greeting:        "¡Hola! 👋 ¿En qué puedo ayudarte? Pregunta sobre **pedidos**, **envíos**, **devoluciones**, **productos** o **contacto**.",
    fallback:        "No estoy seguro. Prueba preguntando sobre **pedidos**, **envíos**, **devoluciones**, **productos** o escribe **contacto**.",
    quick_replies:   ['Pedidos', 'Envíos', 'Devoluciones', 'Productos', 'Contacto'],
  },
  ja: {
    lang_name:       '日本語',
    title:           'カスタマーサポート',
    subtitle:        '通常すぐに返信します',
    placeholder:     'メッセージを入力…',
    send:            '送信',
    lang_label:      '言語',
    greeting:        "こんにちは！👋 ご用件は？**注文**、**配送**、**返品**、**商品**、または**お問い合わせ**についてお気軽にどうぞ。",
    fallback:        "申し訳ありませんが、よく分かりませんでした。**注文**、**配送**、**返品**、**商品**、または**お問い合わせ**をお試しください。",
    quick_replies:   ['注文', '配送', '返品', '商品', 'お問い合わせ'],
  },
};

/* ─── FAQ knowledge base ────────────────────────────────────────────── */
const KB = {
  en: [
    {
      keys: ['order', 'orders', 'track', 'tracking', 'status'],
      answer: "**Order Tracking**\nYou can track your order by visiting your [account orders page](/account/orders) or using the tracking link in your confirmation email.\n\nOrders typically ship within 1–2 business days. Need more help? Type **contact**.",
    },
    {
      keys: ['ship', 'shipping', 'delivery', 'deliver', 'arrive', 'how long'],
      answer: "**Shipping Info**\n• Standard: 5–7 business days\n• Express: 2–3 business days\n• Free shipping on orders over $75\n\nInternational shipping is available to most countries. Type **contact** if you need specifics.",
    },
    {
      keys: ['return', 'returns', 'refund', 'exchange', 'policy'],
      answer: "**Returns & Exchanges**\nWe accept returns within **30 days** of purchase.\n\n✔ Item must be unworn and in original packaging\n✔ Start your return from your [account page](/account)\n✔ Refunds processed in 5–7 business days\n\nQuestions? Type **contact**.",
    },
    {
      keys: ['product', 'products', 'size', 'sizes', 'fit', 'material', 'fabric', 'stock'],
      answer: "**Product Help**\nYou can find size guides on each product page. Our items are crafted from sustainably sourced fabrics.\n\n• Can't find your size? It may be restocking soon.\n• For fabric details, check the product description.\n\nNeed something specific? Type **contact**.",
    },
    {
      keys: ['contact', 'email', 'phone', 'human', 'agent', 'support', 'help'],
      answer: "**Contact Us**\nOur team is happy to help!\n\n📧 Email: hello@yourbrand.com\n📞 Phone: +1 (800) 000-0000\n🕐 Hours: Mon–Fri, 9am–6pm EST\n\nOr visit our [contact page](/pages/contact).",
    },
    {
      keys: ['payment', 'pay', 'card', 'credit', 'paypal', 'checkout'],
      answer: "**Payment Methods**\nWe accept all major credit cards (Visa, Mastercard, Amex), PayPal, Apple Pay, and Google Pay.\n\nAll payments are secured and encrypted. Questions? Type **contact**.",
    },
    {
      keys: ['discount', 'promo', 'code', 'coupon', 'sale', 'offer'],
      answer: "**Discounts & Promos**\nEnter your promo code at checkout. Only one code can be used per order.\n\n💡 Tip: Sign up to our newsletter to receive exclusive offers!",
    },
    {
      keys: ['cancel', 'cancellation', 'modify'],
      answer: "**Cancel or Modify an Order**\nOrders can be cancelled or modified within **1 hour** of placing them.\n\nPlease contact us immediately at hello@yourbrand.com or type **contact** for quick help.",
    },
  ],
  id: [
    {
      keys: ['pesanan', 'pesan', 'lacak', 'pelacakan', 'status', 'order'],
      answer: "**Pelacakan Pesanan**\nLacak pesananmu di [halaman pesanan akun](/account/orders) atau gunakan tautan di email konfirmasi.\n\nPesanan biasanya dikirim dalam 1–2 hari kerja. Perlu bantuan lebih? Ketik **kontak**.",
    },
    {
      keys: ['kirim', 'pengiriman', 'ongkir', 'ongkos', 'tiba', 'berapa lama', 'delivery'],
      answer: "**Info Pengiriman**\n• Reguler: 5–7 hari kerja\n• Ekspres: 2–3 hari kerja\n• Gratis ongkir untuk pembelian di atas Rp500.000\n\nPengiriman internasional tersedia. Ketik **kontak** untuk info lebih lanjut.",
    },
    {
      keys: ['kembali', 'pengembalian', 'refund', 'tukar', 'retur'],
      answer: "**Pengembalian & Penukaran**\nKami menerima pengembalian dalam **30 hari** setelah pembelian.\n\n✔ Barang harus belum dipakai dan dalam kemasan asli\n✔ Mulai proses retur dari [halaman akun](/account)\n✔ Refund diproses dalam 5–7 hari kerja\n\nAda pertanyaan? Ketik **kontak**.",
    },
    {
      keys: ['produk', 'ukuran', 'size', 'bahan', 'material', 'stok'],
      answer: "**Info Produk**\nPanduan ukuran tersedia di setiap halaman produk. Produk kami terbuat dari bahan berkelanjutan.\n\n• Ukuran habis? Mungkin akan segera restock.\n• Detail bahan ada di deskripsi produk.\n\nButuh info spesifik? Ketik **kontak**.",
    },
    {
      keys: ['kontak', 'email', 'telepon', 'cs', 'customer service', 'hubungi', 'bantuan'],
      answer: "**Hubungi Kami**\nTim kami siap membantu!\n\n📧 Email: hello@yourbrand.com\n📞 Telepon: +62 800 000 0000\n🕐 Jam: Sen–Jum, 09.00–18.00 WIB\n\nAtau kunjungi [halaman kontak](/pages/contact).",
    },
    {
      keys: ['bayar', 'pembayaran', 'kartu', 'transfer', 'gopay', 'ovo', 'dana'],
      answer: "**Metode Pembayaran**\nKami menerima kartu kredit/debit, transfer bank, GoPay, OVO, DANA, dan PayPal.\n\nSemua transaksi aman dan terenkripsi. Ada pertanyaan? Ketik **kontak**.",
    },
    {
      keys: ['diskon', 'promo', 'kode', 'voucher', 'sale', 'potongan'],
      answer: "**Diskon & Promo**\nMasukkan kode promo saat checkout. Hanya satu kode yang bisa digunakan per pesanan.\n\n💡 Tips: Daftar newsletter kami untuk mendapatkan penawaran eksklusif!",
    },
    {
      keys: ['batal', 'batalkan', 'ubah', 'ganti pesanan'],
      answer: "**Batalkan atau Ubah Pesanan**\nPesanan bisa dibatalkan atau diubah dalam **1 jam** setelah pemesanan.\n\nSegera hubungi kami di hello@yourbrand.com atau ketik **kontak**.",
    },
  ],
  fr: [
    {
      keys: ['commande', 'commandes', 'suivi', 'suivre', 'statut'],
      answer: "**Suivi de commande**\nSuivez votre commande sur votre [page de compte](/account/orders) ou via le lien dans votre e-mail de confirmation.\n\nLes commandes sont expédiées sous 1–2 jours ouvrables. Tapez **contact** pour plus d'aide.",
    },
    {
      keys: ['livraison', 'expédition', 'délai', 'livrer'],
      answer: "**Livraison**\n• Standard : 5–7 jours ouvrables\n• Express : 2–3 jours ouvrables\n• Livraison gratuite dès 75€\n\nTapez **contact** pour les détails internationaux.",
    },
    {
      keys: ['retour', 'retours', 'remboursement', 'échange'],
      answer: "**Retours & Échanges**\nNous acceptons les retours sous **30 jours**.\n\n✔ Article non porté dans son emballage d'origine\n✔ Commencez le retour depuis votre [compte](/account)\n✔ Remboursement sous 5–7 jours. Tapez **contact** pour toute question.",
    },
    {
      keys: ['produit', 'produits', 'taille', 'matière', 'stock'],
      answer: "**Aide produit**\nLes guides de tailles sont disponibles sur chaque page produit. Tapez **contact** pour des questions spécifiques.",
    },
    {
      keys: ['contact', 'email', 'téléphone', 'aide', 'support'],
      answer: "**Nous contacter**\n📧 Email : hello@yourbrand.com\n📞 Tél : +33 1 00 00 00 00\n🕐 Lun–Ven, 9h–18h CET\n\nOu visitez notre [page contact](/pages/contact).",
    },
  ],
  de: [
    {
      keys: ['bestellung', 'bestellungen', 'verfolgen', 'tracking', 'status'],
      answer: "**Bestellverfolgung**\nVerfolgen Sie Ihre Bestellung auf Ihrer [Kontoseite](/account/orders) oder über den Link in Ihrer Bestätigungs-E-Mail.\n\nBestellungen werden in 1–2 Werktagen versendet. Tippen Sie **Kontakt** für weitere Hilfe.",
    },
    {
      keys: ['versand', 'lieferung', 'liefern', 'wie lange'],
      answer: "**Versandinfo**\n• Standard: 5–7 Werktage\n• Express: 2–3 Werktage\n• Kostenloser Versand ab 75€\n\nFür internationale Details tippen Sie **Kontakt**.",
    },
    {
      keys: ['rücksendung', 'rücksendungen', 'rückgabe', 'erstattung', 'umtausch'],
      answer: "**Rücksendungen & Umtausch**\nWir akzeptieren Rücksendungen innerhalb von **30 Tagen**.\n\n✔ Ungetragen, in Originalverpackung\n✔ Erstattung in 5–7 Werktagen. Tippen Sie **Kontakt** bei Fragen.",
    },
    {
      keys: ['produkt', 'produkte', 'größe', 'material', 'stoff'],
      answer: "**Produkthilfe**\nGrößentabellen finden Sie auf jeder Produktseite. Tippen Sie **Kontakt** für spezifische Fragen.",
    },
    {
      keys: ['kontakt', 'email', 'telefon', 'hilfe', 'support'],
      answer: "**Kontakt**\n📧 E-Mail: hello@yourbrand.com\n📞 Tel: +49 800 000 0000\n🕐 Mo–Fr, 9–18 Uhr MEZ\n\nOder besuchen Sie unsere [Kontaktseite](/pages/contact).",
    },
  ],
  es: [
    {
      keys: ['pedido', 'pedidos', 'seguimiento', 'rastrear', 'estado'],
      answer: "**Seguimiento de pedido**\nRastreá tu pedido en tu [página de cuenta](/account/orders) o con el enlace en el correo de confirmación.\n\nLos pedidos se envían en 1–2 días hábiles. Escribe **contacto** para más ayuda.",
    },
    {
      keys: ['envío', 'envios', 'entrega', 'entregar', 'cuanto tarda'],
      answer: "**Información de envío**\n• Estándar: 5–7 días hábiles\n• Express: 2–3 días hábiles\n• Envío gratis en pedidos superiores a $75\n\nEscribe **contacto** para detalles internacionales.",
    },
    {
      keys: ['devolucion', 'devoluciones', 'reembolso', 'cambio'],
      answer: "**Devoluciones y cambios**\nAceptamos devoluciones en **30 días**.\n\n✔ Artículo sin usar en embalaje original\n✔ Reembolso en 5–7 días hábiles. Escribe **contacto** para preguntas.",
    },
    {
      keys: ['producto', 'productos', 'talla', 'material', 'tela'],
      answer: "**Ayuda con productos**\nLas guías de tallas están en cada página de producto. Escribe **contacto** para preguntas específicas.",
    },
    {
      keys: ['contacto', 'email', 'teléfono', 'ayuda', 'soporte'],
      answer: "**Contáctanos**\n📧 Email: hello@yourbrand.com\n📞 Tel: +1 (800) 000-0000\n🕐 Lun–Vie, 9am–6pm EST\n\nO visita nuestra [página de contacto](/pages/contact).",
    },
  ],
  ja: [
    {
      keys: ['注文', '追跡', 'トラッキング', '状態', 'ステータス'],
      answer: "**注文の追跡**\n[アカウントページ](/account/orders)または確認メールのリンクから注文を追跡できます。\n\n通常1〜2営業日以内に発送されます。詳しくは**お問い合わせ**とご入力ください。",
    },
    {
      keys: ['配送', '発送', '届く', 'いつ', '日数'],
      answer: "**配送について**\n• 通常配送: 5〜7営業日\n• 速達: 2〜3営業日\n• 7,500円以上のご注文で送料無料\n\n国際配送も対応しています。詳しくは**お問い合わせ**まで。",
    },
    {
      keys: ['返品', '返金', '交換', '返却'],
      answer: "**返品・交換**\nご購入から**30日以内**の返品を承ります。\n\n✔ 未使用・元の包装で\n✔ 返金は5〜7営業日で処理\n\nご質問は**お問い合わせ**とご入力ください。",
    },
    {
      keys: ['商品', '製品', 'サイズ', '素材', '在庫'],
      answer: "**商品について**\n各商品ページにサイズガイドがあります。特定のご質問は**お問い合わせ**までどうぞ。",
    },
    {
      keys: ['お問い合わせ', '連絡', 'メール', '電話', 'サポート'],
      answer: "**お問い合わせ**\n📧 メール: hello@yourbrand.com\n📞 電話: +81 0 0000 0000\n🕐 月〜金、9時〜18時 JST\n\nまたは[お問い合わせページ](/pages/contact)をご覧ください。",
    },
  ],
};

/* ─── Fallback: copy KB entries from closest available lang ─────────── */
// For langs with partial KB, supplement with EN fallback
['fr','de','es','ja'].forEach(lang => {
  const extra = KB.en.filter(en =>
    !KB[lang].some(l => l.keys.some(k => en.keys.includes(k)))
  );
  KB[lang] = [...KB[lang], ...extra.map(e => ({
    keys: e.keys,
    answer: e.answer, // show EN answer as fallback for uncovered topics
  }))];
});

/* ─── Bot engine ────────────────────────────────────────────────────── */
class ChatBot {
  constructor(lang = 'en') {
    this.lang = lang;
  }

  setLang(lang) {
    this.lang = lang;
  }

  t(key) {
    return (I18N[this.lang] || I18N.en)[key];
  }

  respond(input) {
    const text   = input.toLowerCase().trim();
    const kb     = KB[this.lang] || KB.en;
    const match  = kb.find(entry => entry.keys.some(k => text.includes(k)));
    return match ? match.answer : this.t('fallback');
  }

  quickReplies() {
    return this.t('quick_replies');
  }
}

/* ─── Markdown-lite renderer ────────────────────────────────────────── */
function renderMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, '<br>');
}

/* ─── Widget ────────────────────────────────────────────────────────── */
class ChatWidget {
  constructor() {
    this.bot         = new ChatBot('en');
    this.isOpen      = false;
    this.isTyping    = false;
    this.history     = []; // {role: 'bot'|'user', text}
    this.el          = document.getElementById('cb-widget');

    if (!this.el) return;

    this.messagesEl  = this.el.querySelector('#cb-messages');
    this.inputEl     = this.el.querySelector('#cb-input');
    this.sendBtn     = this.el.querySelector('#cb-send');
    this.toggleBtn   = document.getElementById('cb-toggle');
    this.closeBtn    = this.el.querySelector('#cb-close');
    this.langSel     = this.el.querySelector('#cb-lang');
    this.badge       = document.getElementById('cb-badge');
    this.panel       = this.el.querySelector('#cb-panel');
    this.quickEl     = this.el.querySelector('#cb-quick-replies');

    this._bindEvents();
    this._showBadgeAfterDelay();
  }

  /* ── Init ── */
  _bindEvents() {
    this.toggleBtn?.addEventListener('click', () => this.toggle());
    this.closeBtn?.addEventListener('click',  () => this.close());
    this.sendBtn?.addEventListener('click',   () => this._handleSend());
    this.inputEl?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._handleSend(); }
    });
    this.langSel?.addEventListener('change', e => this._changeLang(e.target.value));
  }

  _showBadgeAfterDelay() {
    setTimeout(() => {
      this.badge?.classList.remove('cb-hidden');
    }, 4000);
  }

  /* ── Open / close ── */
  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    this.isOpen = true;
    this.panel?.classList.remove('cb-panel--closed');
    this.panel?.classList.add('cb-panel--open');
    this.toggleBtn?.setAttribute('aria-expanded', 'true');
    this.badge?.classList.add('cb-hidden');
    this.inputEl?.focus();

    if (this.history.length === 0) {
      setTimeout(() => this._botGreet(), 400);
    }
  }

  close() {
    this.isOpen = false;
    this.panel?.classList.remove('cb-panel--open');
    this.panel?.classList.add('cb-panel--closed');
    this.toggleBtn?.setAttribute('aria-expanded', 'false');
  }

  /* ── Language switch ── */
  _changeLang(lang) {
    this.bot.setLang(lang);
    // Update static UI strings
    this.el.querySelector('#cb-title').textContent    = this.bot.t('title');
    this.el.querySelector('#cb-subtitle').textContent = this.bot.t('subtitle');
    this.inputEl.placeholder                          = this.bot.t('placeholder');
    this.sendBtn.textContent                          = this.bot.t('send');
    // Re-render quick replies
    this._renderQuickReplies();
    // Greet again in new language
    this._botMessage(this.bot.t('greeting'));
  }

  /* ── Messages ── */
  _botGreet() {
    this._botMessage(this.bot.t('greeting'));
  }

  _botMessage(text) {
    const msg = { role: 'bot', text };
    this.history.push(msg);
    this._appendMessage(msg);
    this._renderQuickReplies();
  }

  _userMessage(text) {
    const msg = { role: 'user', text };
    this.history.push(msg);
    this._appendMessage(msg);
    this._clearQuickReplies();
  }

  _appendMessage({ role, text }) {
    const wrap = document.createElement('div');
    wrap.className = `cb-msg cb-msg--${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'cb-bubble';
    bubble.innerHTML = renderMarkdown(text);

    const time = document.createElement('time');
    time.className = 'cb-time';
    time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    wrap.appendChild(bubble);
    wrap.appendChild(time);
    this.messagesEl.appendChild(wrap);
    this._scrollBottom();
  }

  _showTyping() {
    this.isTyping = true;
    const el = document.createElement('div');
    el.className = 'cb-msg cb-msg--bot cb-typing-wrap';
    el.id = 'cb-typing';
    el.innerHTML = `<div class="cb-bubble cb-typing"><span></span><span></span><span></span></div>`;
    this.messagesEl.appendChild(el);
    this._scrollBottom();
  }

  _hideTyping() {
    this.isTyping = false;
    document.getElementById('cb-typing')?.remove();
  }

  _scrollBottom() {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  /* ── Quick replies ── */
  _renderQuickReplies() {
    if (!this.quickEl) return;
    this.quickEl.innerHTML = '';
    this.bot.quickReplies().forEach(label => {
      const btn = document.createElement('button');
      btn.className = 'cb-qr';
      btn.textContent = label;
      btn.addEventListener('click', () => this._handleQuickReply(label));
      this.quickEl.appendChild(btn);
    });
  }

  _clearQuickReplies() {
    if (this.quickEl) this.quickEl.innerHTML = '';
  }

  _handleQuickReply(label) {
    this._processInput(label);
  }

  /* ── Send ── */
  _handleSend() {
    const val = this.inputEl.value.trim();
    if (!val) return;
    this.inputEl.value = '';
    this._processInput(val);
  }

  _processInput(text) {
    this._userMessage(text);
    this._showTyping();

    // Simulate bot "thinking" delay
    const delay = 700 + Math.random() * 600;
    setTimeout(() => {
      this._hideTyping();
      const answer = this.bot.respond(text);
      this._botMessage(answer);
    }, delay);
  }
}

/* ─── Boot ──────────────────────────────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new ChatWidget());
} else {
  new ChatWidget();
}
