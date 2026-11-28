'use strict';

/* ==========================================================================
   DIAMOND LUXURY — Application vitrine
   ========================================================================== */

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? '' : 'https://dlback-97h3.onrender.com';

const IMG_FAVICON = 'assets/IMG_7657.jpeg';
const IMG_LOGO_FULL = 'assets/IMG_7657.jpeg';
const IMG_LOGO_MARK = 'assets/IMG_7657.jpeg';

const STORES = [
  { label: 'Dely Brahim, Alger', query: 'Dely Brahim, Alger, Algérie' },
  { label: 'City Center, Alger', query: 'City Center, Alger, Algérie' },
  { label: 'Park Mall, Sétif', query: 'Park Mall, Sétif, Algérie' }
];

const OPENING_HOURS = 'Tous les jours · 9h – minuit';

function mapsUrl(query) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
}

/* Logos / initiales des transporteurs.
   Pour afficher un vrai logo, renseignez simplement `logo` avec une URL
   (fichier local ou hébergé) : il remplacera les initiales automatiquement. */
const CARRIER_LOGOS = {
  yalidine: { match: /yalidine/i, name: 'Yalidine Express', initials: 'YA', logo: 'https://zimou.express/storage/5906/1twbrw8xoMWK1h9sdRhKdI1JQBkBqHpggcOytFDY.svg', color: '#0f6b3a', bg: '#e7f3ea' },
  noest: { match: /noest/i, name: 'Noest Express', initials: 'NO', logo: 'https://zimou.express/storage/5916/8zd2kfjvZbrvtUYQFUBpwKPmPK2m0yQvM3ITjYFd.svg', color: '#1d4ed8', bg: '#e8eefc' },
  zr: { match: /\bzr\b/i, name: 'ZR Express', initials: 'ZR', logo: 'https://zimou.express/storage/5902/0Q2ELStA5D4OdfncOY3zVvPSUijoLVknT1eEzyTv.svg', color: '#b45309', bg: '#fdf1e3' },
  dhd: { match: /\bdhd\b/i, name: 'DHD Express', initials: 'DHD', logo: 'https://zimou.express/storage/5913/3Wztz7vZNPTnXGSZpC4ew6KaHwX82Tmi2OEcahTz.svg', color: '#7c2d12', bg: '#fbeae3' },
  anderson: { match: /anderson/i, name: 'Anderson Express', initials: 'AN', logo: 'https://zimou.express/storage/5922/401VLgCQ3l7Kw97GnYZTwJlymnm1awY36cOghllI.svg', color: '#6d28d9', bg: '#f0e9fd' },
  zimou: { match: /zimou/i, name: 'Zimou Express', initials: 'ZE', logo: 'https://zimou.express/storage/5921/kgpDluZg45cjgvWacRcAnV6mEHwgRFG5dmAEB6AB.svg', color: '#0f766e', bg: '#e6f4f1' },
  default: { match: null, name: 'Point relais', initials: 'PR', logo: 'https://zimou.express/storage/5277/mKNdCFtYI5T9WW60HhrMMr1xDFGVTAkEgjveVwWc.svg', color: '#8a6a1f', bg: '#f7f0dc' },
maystro: { match: /maystro/i, name: 'Maystro Delivery', initials: 'MA', logo: 'https://zimou.express/storage/5918/vOigAOwX95np3YfAl2KHFZTxV4sgsApjFxyHdo1u.svg' },
  world: { match: /world/i, name: 'World Express', initials: 'WE', logo: 'https://zimou.express/storage/5919/zzgAcMgTGqN8e6A1g0FVV4rSgTu45rNrS3IzIqCH.svg' }
};


function carrierOf(office) {
  const raw = String((office && (office.carrier || office.provider || office.name)) || '');
  const found = Object.values(CARRIER_LOGOS).find((entry) => entry.match && entry.match.test(raw));
  if (found) return found;
  const fallbackName = office && office.name ? String(office.name).split('—')[0].trim() : '';
  return fallbackName ? { ...CARRIER_LOGOS.default, name: fallbackName } : CARRIER_LOGOS.default;
}

function assetUrl(src) {
  if (!src || typeof src !== 'string') return src;
  if (/assets\/(favicon\.svg|logo-full\.svg|logo-mark\.svg)$/.test(src)) {
    return src.includes('favicon.svg') ? IMG_FAVICON : src.includes('logo-mark.svg') ? IMG_LOGO_MARK : IMG_LOGO_FULL;
  }
  if (src.startsWith('data:') || /^https?:\/\//i.test(src)) return src;
  return src.startsWith('/') ? API_BASE + src : src;
}

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

const state = {
  settings: {},
  categories: [],
  products: [],
  cart: readStorage('dl_cart', []),
  wishlist: readStorage('dl_wish', []),
  shipping: {
    wilayas: [],
    communes: new Map(),
    stopdesks: new Map(),
    quotes: new Map(),
    zimouConfigured: false
  },
  filters: {
    cat: 'tout',
    q: '',
    sort: 'new',
    stockOnly: false,
    promoOnly: false,
    color: '',
    size: '',
    min: '',
    max: ''
  }
};

let productView = null;
let quickView = null;
let quickViewTrigger = null;
let revealObserver = null;
let smoothTopOnRoute = false;

/* ------------------------------ Utilitaires ------------------------------ */

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible */
  }
}

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

const priceFormatter = new Intl.NumberFormat('fr-FR');

function formatPrice(value) {
  return priceFormatter.format(Number(value) || 0) + ' ' + (state.settings.currency || 'DA');
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function instagramUrl() {
  return 'https://instagram.com/' + (state.settings.instagram || 'diamond__luxury_');
}

function instagramDmUrl() {
  return 'https://ig.me/m/' + (state.settings.instagram || 'diamond__luxury_');
}

function phoneUrl() {
  const raw = digits(state.settings.phone);
  if (!raw) return '#';
  const international = raw.startsWith('0') ? '+213' + raw.slice(1) : '+' + raw;
  return 'tel:' + international;
}

const VARIANT_META = {
  taille: { label: 'Taille', choose: 'Choisir la taille', lower: 'taille', empty: 'taille' },
  format: { label: 'Format', choose: 'Choisir le format', lower: 'format', empty: 'format' },
  pointure: { label: 'Pointure', choose: 'Choisir la pointure', lower: 'pointure', empty: 'pointure' }
};

function variantMeta(product) {
  return VARIANT_META[product && product.variantType] || VARIANT_META.taille;
}

function variantText(product) {
  const meta = variantMeta(product);
  return meta.label + ' ' + (product ? product.sizes.length : '');
}

async function copyText(value) {
  const text = String(value || '');
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* on tente l'ancienne méthode */ }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

async function loadShippingWilayas() {
  try {
    const response = await fetch(API_BASE + '/api/shipping/wilayas', { headers: { Accept: 'application/json' } });
    if (!response.ok) return;
    const data = await response.json();
    state.shipping.wilayas = data.wilayas || [];
    state.shipping.zimouConfigured = Boolean(data.zimouConfigured);
  } catch { /* le checkout affichera un message */ }
}

async function shippingCommunes(wilayaId) {
  const key = String(wilayaId);
  if (state.shipping.communes.has(key)) return state.shipping.communes.get(key);
  const response = await fetch(API_BASE + '/api/shipping/communes?wilaya=' + encodeURIComponent(wilayaId), { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Impossible de charger les communes.');
  const data = await response.json();
  state.shipping.communes.set(key, data.communes || []);
  return data.communes || [];
}

async function shippingStopDesks(communeId, wilayaId, subtotal) {
  const key = [wilayaId, communeId, subtotal].join(':');
  if (state.shipping.stopdesks.has(key)) return state.shipping.stopdesks.get(key);
  const query = new URLSearchParams({
    commune: communeId,
    wilaya: wilayaId || '',
    subtotal: subtotal || 0
  });
  const response = await fetch(API_BASE + '/api/shipping/stopdesks?' + query.toString(), { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Impossible de charger les bureaux stop-desk.');
  const data = await response.json();
  const payload = { items: data.stopdesks || [], source: data.source, message: data.message || '' };
  state.shipping.stopdesks.set(key, payload);
  return payload;
}

async function shippingQuote(wilayaId, communeId, mode, subtotal, officeId) {
  const key = [wilayaId, communeId, mode, subtotal, officeId || ''].join(':');
  if (state.shipping.quotes.has(key)) return state.shipping.quotes.get(key);
  const query = new URLSearchParams({ wilaya: wilayaId, commune: communeId, mode, subtotal: subtotal || 0 });
  if (officeId != null && officeId !== '') query.set('office', officeId);
  const response = await fetch(API_BASE + '/api/shipping/quote?' + query.toString(), { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Impossible de calculer les frais de livraison.');
  const data = await response.json();
  state.shipping.quotes.set(key, data);
  return data;
}

function activeProducts() {
  return state.products.filter((product) => product.active !== false);
}

function productById(id) {
  return state.products.find((product) => product.id === id);
}

function categoryById(id) {
  return state.categories.find((category) => category.id === id);
}

function categoryOf(product) {
  return categoryById(product.categoryId);
}

function productUrl(product) {
  return '#/produit/' + encodeURIComponent(product.slug);
}

function productStock(product) {
  return (product.variants || []).reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0);
}

function variantStock(product, color, size) {
  const variant = (product.variants || []).find((row) => row.color === color && row.size === size);
  return variant ? Number(variant.stock) || 0 : 0;
}

function firstAvailableVariant(product, color) {
  const colors = product.colors && product.colors.length ? product.colors : [{ name: 'Unique', hex: '#c9a227' }];
  for (const tone of colors) {
    if (color && tone.name !== color) continue;
    for (const size of product.sizes || []) {
      if (variantStock(product, tone.name, size) > 0) return { color: tone.name, size };
    }
  }
  return null;
}

function isNew(product) {
  const created = new Date(product.createdAt).getTime();
  return Number.isFinite(created) && Date.now() - created < 1000 * 60 * 60 * 24 * 21;
}

function discountPercent(product) {
  if (!product.comparePrice || product.comparePrice <= product.price) return 0;
  return Math.round((1 - product.price / product.comparePrice) * 100);
}

function toast(message, type = 'success') {
  const stack = $('#toasts');
  if (!stack) return;
  const node = document.createElement('div');
  node.className = 'toast ' + (type === 'error' ? 'error' : '');
  node.innerHTML = '<svg class="icon"><use href="#' + (type === 'error' ? 'i-close' : 'i-check') + '"></use></svg><span>' + esc(message) + '</span>';
  stack.appendChild(node);
  setTimeout(() => {
    node.classList.add('out');
    setTimeout(() => node.remove(), 320);
  }, 3600);
}

function emptyState(title, text, linkLabel, linkHref) {
  return '<div class="empty-state" style="grid-column:1/-1">' +
    '<svg class="icon"><use href="#i-diamond"></use></svg>' +
    '<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' +
    (linkLabel ? '<a class="btn btn-gold" href="' + linkHref + '">' + esc(linkLabel) + '</a>' : '') +
    '</div>';
}

/* ------------------------------ Données ------------------------------ */

async function loadStore() {
  const response = await fetch(API_BASE + '/api/store', { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Impossible de charger la boutique.');
  const data = await response.json();
  state.settings = data.settings || {};
  state.settings.heroImage = assetUrl(state.settings.heroImage);
  state.categories = (data.categories || []).map((category) => ({ ...category, image: assetUrl(category.image) }));
  state.products = (data.products || []).map((product) => ({ ...product, images: (product.images || []).map(assetUrl) }));
  sanitizeCart();
  renderChrome();
  loadShippingWilayas();
}

function sanitizeCart() {
  const next = [];
  state.cart.forEach((item) => {
    const product = productById(item.productId);
    if (!product) return;
    const stock = variantStock(product, item.color, item.size);
    if (stock <= 0) return;
    next.push({ productId: item.productId, color: item.color, size: item.size, qty: Math.min(item.qty, stock) });
  });
  if (JSON.stringify(next) !== JSON.stringify(state.cart)) {
    state.cart = next;
    writeStorage('dl_cart', next);
  }
}

/* ------------------------------ Chrome (header, footer) ------------------------------ */

function renderChrome() {
  const settings = state.settings;
  const announcement = settings.announcement || 'LIVRAISON 58 WILAYAS · PAIEMENT À LA LIVRAISON · PIÈCES LIMITÉES';
  const announceLine = Array(3).fill(announcement).join(' · ');
  $$('.announce-group').forEach((node) => { node.textContent = announceLine; });
  $('#year').textContent = new Date().getFullYear();

  const handle = '@' + (settings.instagram || 'diamond__luxury_');
  if ($('#instaHandle')) $('#instaHandle').textContent = handle;
  if ($('#instaLink')) $('#instaLink').href = instagramUrl();
  if ($('#footerInstagram')) $('#footerInstagram').href = instagramUrl();
  if ($('#footerPhoneIcon')) { $('#footerPhoneIcon').href = phoneUrl(); $('#footerPhoneIcon').hidden = !settings.phone; }
  if ($('#footerEmail')) $('#footerEmail').href = 'mailto:' + (settings.email || '');
  if ($('#contactInstagram')) $('#contactInstagram').href = instagramDmUrl();
  if ($('#drawerInstagram')) {
    $('#drawerInstagram').textContent = handle;
    $('#drawerInstagram').href = instagramUrl();
  }

  if ($('#footerCategories')) {
    $('#footerCategories').innerHTML = state.categories.slice(0, 6).map((category) =>
      '<li><a href="#/boutique?cat=' + encodeURIComponent(category.slug) + '">' + esc(category.name) + '</a></li>'
    ).join('');
  }

  if ($('#drawerCategories')) {
    $('#drawerCategories').innerHTML = state.categories.map((category) =>
      '<a href="#/boutique?cat=' + encodeURIComponent(category.slug) + '">' + esc(category.name) +
      ' <small>' + (category.productCount || 0) + '</small></a>'
    ).join('');
  }

  if ($('#footerPhone')) {
    $('#footerPhone').textContent = settings.phone || '—';
    $('#footerPhone').href = phoneUrl();
  }
  if ($('#footerMail')) {
    $('#footerMail').textContent = settings.email || '—';
    $('#footerMail').href = 'mailto:' + (settings.email || '');
  }

  const storeItems = STORES.map((store) =>
    '<div class="contact-item store-item"><svg class="icon"><use href="#i-map"></use></svg><div><small>Magasin</small>' +
    '<a href="' + mapsUrl(store.query) + '" target="_blank" rel="noopener noreferrer">' + esc(store.label) + '</a></div></div>'
  ).join('');

  if ($('#contactList')) {
    $('#contactList').innerHTML =
      '<div class="contact-item"><svg class="icon"><use href="#i-instagram"></use></svg><div><small>Instagram</small><a href="' + instagramUrl() + '" target="_blank" rel="noopener">' + esc(handle) + '</a></div></div>' +
      (settings.phone ? '<div class="contact-item"><svg class="icon"><use href="#i-phone"></use></svg><div><small>Téléphone</small><a href="' + phoneUrl() + '">' + esc(settings.phone) + '</a></div></div>' : '') +
      '<div class="contact-item"><svg class="icon"><use href="#i-mail"></use></svg><div><small>Email</small><a href="mailto:' + esc(settings.email || '') + '">' + esc(settings.email || '—') + '</a></div></div>' +
      storeItems +
      '<div class="contact-item"><svg class="icon"><use href="#i-clock"></use></svg><div><small>Horaires</small><span>' + esc(OPENING_HOURS) + '</span></div></div>';
  }

  updateBadges();
}

function updateBadges() {
  const cartQty = state.cart.reduce((sum, item) => sum + item.qty, 0);
  const cartBadge = $('#cartCount');
  if (cartBadge) {
    cartBadge.textContent = cartQty;
    cartBadge.hidden = cartQty === 0;
  }
  const wishBadge = $('#wishCount');
  if (wishBadge) {
    wishBadge.textContent = state.wishlist.length;
    wishBadge.hidden = state.wishlist.length === 0;
  }
  const head = $('#cartHeadCount');
  if (head) head.textContent = cartQty ? '(' + cartQty + ')' : '';
}

/* ------------------------------ Cartes produit ------------------------------ */

function productCard(product, index = 0, reveal = false) {
  const category = categoryOf(product);
  const secondImage = product.images && product.images[1];
  const favorited = state.wishlist.includes(product.id);
  const promo = discountPercent(product);
  const badges = [];
  if (isNew(product)) badges.push('<span class="badge new">Nouveau</span>');
  if (promo) badges.push('<span class="badge promo">-' + promo + '%</span>');
  if (product.featured) badges.push('<span class="badge featured">Signature</span>');

  return '<article class="product-card' + (reveal ? ' reveal' : '') + '"' + (reveal ? ' style="animation-delay:' + Math.min(index, 3) * 90 + 'ms"' : '') + ' data-quick-view="' + esc(product.id) + '">' +
    '<div class="product-media">' +
      '<a href="' + productUrl(product) + '" aria-label="Voir ' + esc(product.name) + '">' +
        '<img class="product-img" src="' + esc(product.images[0] || IMG_LOGO_FULL) + '" alt="' + esc(product.name) + '" loading="lazy">' +
        (secondImage ? '<img class="product-img alt" src="' + esc(secondImage) + '" alt="" loading="lazy" aria-hidden="true">' : '') +
      '</a>' +
      '<div class="product-badges">' + badges.join('') + (product.stock === 0 ? '<span class="badge out">En rupture</span>' : '') + '</div>' +
      '<button class="wish-btn' + (favorited ? ' active' : '') + '" data-wish="' + esc(product.id) + '" aria-label="' + (favorited ? 'Retirer des favoris' : 'Ajouter aux favoris') + '">' +
        '<svg class="icon"><use href="#i-heart"></use></svg>' +
      '</button>' +
    '</div>' +
    '<div class="product-body">' +
      '<div class="product-cat">' + esc(category ? category.name : '') + '</div>' +
      '<h3 class="product-name"><a href="' + productUrl(product) + '">' + esc(product.name) + '</a></h3>' +
      '<div class="product-price">' +
        '<span class="price' + (promo ? ' price-promo' : '') + '">' + formatPrice(product.price) + '</span>' +
        (product.comparePrice > product.price ? '<span class="price-old">' + formatPrice(product.comparePrice) + '</span>' : '') +
      '</div>' +
    '</div>' +
  '</article>';
}

function productGrid(products, reveal = false) {
  return products.map((product, index) => productCard(product, index, reveal)).join('');
}

/* ------------------------------ Accueil ------------------------------ */

function renderHome() {
  const cats = state.categories;
  $('#homeCategories').innerHTML = cats.map((category, index) =>
    '<a class="cat-card reveal' + (index % 3 === 1 ? ' d1' : index % 3 === 2 ? ' d2' : '') + '" href="#/boutique?cat=' + encodeURIComponent(category.slug) + '">' +
      '<img src="' + esc(category.image || IMG_LOGO_FULL) + '" alt="' + esc(category.name) + '" loading="lazy">' +
      '<div class="cat-overlay">' +
        '<div class="cat-name">' + esc(category.name) + '</div>' +
        '<div class="cat-count">' + (category.productCount || 0) + ' pièce' + ((category.productCount || 0) > 1 ? 's' : '') + '</div>' +
      '</div>' +
    '</a>'
  ).join('');

  const newest = [...activeProducts()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4);
  $('#homeProducts').innerHTML = productGrid(newest, true);

  const featured = activeProducts().filter((product) => product.featured).slice(0, 4);
  const fill = activeProducts().filter((product) => !product.featured).sort((a, b) => b.stock - a.stock);
  const selection = [...featured, ...fill].slice(0, 4);
  $('#featuredProducts').innerHTML = productGrid(selection, true);

  observeReveals();
}

/* ------------------------------ Boutique ------------------------------ */

function availableColors(products) {
  const map = new Map();
  products.forEach((product) => {
    (product.colors || []).forEach((color) => {
      if (!map.has(color.name)) map.set(color.name, color.hex);
    });
  });
  return Array.from(map.entries()).map(([name, hex]) => ({ name, hex }));
}

function availableSizes(products) {
  const sizes = [];
  products.forEach((product) => {
    (product.sizes || []).forEach((size) => {
      if (!sizes.includes(size)) sizes.push(size);
    });
  });
  return sizes;
}

function filteredProducts() {
  const filters = state.filters;
  let list = activeProducts();

  if (filters.cat !== 'tout') {
    const category = state.categories.find((entry) => entry.slug === filters.cat);
    if (category) list = list.filter((product) => product.categoryId === category.id);
  }
  if (filters.q) {
    const query = filters.q.toLowerCase();
    list = list.filter((product) => {
      const category = categoryOf(product);
      return (product.name + ' ' + (product.description || '') + ' ' + (category ? category.name : ''))
        .toLowerCase().includes(query);
    });
  }
  if (filters.stockOnly) list = list.filter((product) => product.stock > 0);
  if (filters.promoOnly) list = list.filter((product) => product.comparePrice > product.price);
  if (filters.color) list = list.filter((product) => (product.colors || []).some((color) => color.name === filters.color));
  if (filters.size) list = list.filter((product) => (product.sizes || []).includes(filters.size));
  if (filters.min !== '') list = list.filter((product) => product.price >= Number(filters.min));
  if (filters.max !== '') list = list.filter((product) => product.price <= Number(filters.max));

  switch (filters.sort) {
    case 'price-asc': list.sort((a, b) => a.price - b.price); break;
    case 'price-desc': list.sort((a, b) => b.price - a.price); break;
    case 'name': list.sort((a, b) => a.name.localeCompare(b.name, 'fr')); break;
    default: list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  return list;
}

function renderFilters() {
  const container = $('#shopFilters');
  if (!container) return;
  const currentCategory = state.categories.find((category) => category.slug === state.filters.cat);
  const scope = currentCategory
    ? activeProducts().filter((product) => product.productCategory === currentCategory.id || product.categoryId === currentCategory.id)
    : activeProducts();
  const colors = availableColors(scope);
  const sizes = availableSizes(scope);

  const categoryLinks = [{ name: 'Tout voir', slug: 'tout', productCount: activeProducts().length }, ...state.categories];
  container.innerHTML =
    '<div class="filter-block">' +
      '<div class="filter-title">Catégories</div>' +
      '<ul class="filter-list">' + categoryLinks.map((category) =>
        '<li><a class="filter-link' + (state.filters.cat === category.slug ? ' active' : '') + '" href="#/boutique' + (category.slug === 'tout' ? '' : '?cat=' + encodeURIComponent(category.slug)) + '" data-filter-cat="' + esc(category.slug) + '">' +
        esc(category.name) + '<span>' + (category.productCount || 0) + '</span></a></li>'
      ).join('') + '</ul>' +
    '</div>' +
    '<div class="filter-block">' +
      '<div class="filter-title">Disponibilité</div>' +
      '<label class="checkline"><input type="checkbox" data-filter-stock ' + (state.filters.stockOnly ? 'checked' : '') + '> En stock uniquement</label>' +
      '<label class="checkline"><input type="checkbox" data-filter-promo ' + (state.filters.promoOnly ? 'checked' : '') + '> En promotion</label>' +
    '</div>' +
    '<div class="filter-block">' +
      '<div class="filter-title">Prix</div>' +
      '<div class="price-inputs">' +
        '<input type="number" min="0" placeholder="Min" value="' + esc(state.filters.min) + '" data-price-min aria-label="Prix minimum">' +
        '<span style="color:var(--muted)">–</span>' +
        '<input type="number" min="0" placeholder="Max" value="' + esc(state.filters.max) + '" data-price-max aria-label="Prix maximum">' +
      '</div>' +
    '</div>' +
    (colors.length ?
    '<div class="filter-block">' +
      '<div class="filter-title">Couleurs</div>' +
      '<div class="swatches">' + colors.map((color) =>
        '<button class="swatch' + (state.filters.color === color.name ? ' active' : '') + '" style="background:' + esc(color.hex) + '" data-filter-color="' + esc(color.name) + '" title="' + esc(color.name) + '" aria-label="' + esc(color.name) + '"></button>'
      ).join('') + '</div>' +
    '</div>' : '') +
    (sizes.length > 1 ?
    '<div class="filter-block">' +
      '<div class="filter-title">Tailles &amp; formats</div>' +
      '<div class="size-chips">' + sizes.map((size) =>
        '<button class="chip' + (state.filters.size === size ? ' active' : '') + '" data-filter-size="' + esc(size) + '">' + esc(size) + '</button>'
      ).join('') + '</div>' +
    '</div>' : '') +
    '<div class="filter-actions">' +
      '<button class="btn btn-outline btn-sm" data-filter-reset>Réinitialiser</button>' +
      '<button class="btn btn-dark btn-sm filter-toggle" data-close-filters>Voir les articles</button>' +
    '</div>';
}

function renderShop(animate = false) {
  const category = state.categories.find((entry) => entry.slug === state.filters.cat);
  $('#shopTitle').textContent = category ? category.name : 'La boutique';
  $('#shopSubtitle').textContent = category ? category.description : 'Toutes les pièces Diamond Luxury, réunies avec soin.';
  $('#shopSort').value = state.filters.sort;
  renderFilters();

  const list = filteredProducts();
  $('#shopCount').innerHTML = '<strong>' + list.length + '</strong> article' + (list.length > 1 ? 's' : '');
  $('#shopGrid').innerHTML = list.length
    ? productGrid(list)
    : emptyState('Aucun article trouvé', 'Essayez d’élargir vos filtres ou de parcourir une autre catégorie.', 'Réinitialiser les filtres', '#/boutique');

  if (animate) animateShopEntry();
}

function animateShopEntry() {
  [$('#shopTitle'), $('#shopSubtitle')].forEach((element, index) => {
    if (!element) return;
    element.classList.remove('shop-enter');
    void element.offsetWidth;
    element.style.animationDelay = (index * 60) + 'ms';
    element.classList.add('shop-enter');
  });

  $$('#shopGrid .product-card').forEach((card, index) => {
    card.classList.remove('shop-card-enter');
    void card.offsetWidth;
    card.style.animationDelay = (Math.min(index, 12) * 55) + 'ms';
    card.classList.add('shop-card-enter');
  });
}

function resetFilters() {
  state.filters = { cat: 'tout', q: '', sort: 'new', stockOnly: false, promoOnly: false, color: '', size: '', min: '', max: '' };
  if (location.hash !== '#/boutique') {
    location.hash = '#/boutique';
  } else {
    renderShop(true);
  }
}

/* ------------------------------ Fiche produit ------------------------------ */

function renderProduct(slug) {
  const product = state.products.find((entry) => entry.slug === slug);
  const container = $('#productPage');
  if (!product || !product.active) {
    container.innerHTML = emptyState('Pièce introuvable', 'Cette pièce n’est plus disponible ou l’adresse est incorrecte.', 'Retour à la boutique', '#/boutique');
    return;
  }

  const category = categoryOf(product);
  const meta = variantMeta(product);
  const initial = firstAvailableVariant(product);
  productView = {
    productId: product.id,
    color: initial ? initial.color : (product.colors[0] ? product.colors[0].name : 'Unique'),
    size: initial ? initial.size : (product.sizes[0] || 'Taille unique'),
    qty: 1,
    image: 0
  };

  const related = activeProducts()
    .filter((entry) => entry.categoryId === product.categoryId && entry.id !== product.id)
    .slice(0, 4);

  container.innerHTML =
    '<div class="breadcrumb"><a href="#/">Accueil</a><span>/</span><a href="#/boutique">Boutique</a><span>/</span>' +
      (category ? '<a href="#/boutique?cat=' + encodeURIComponent(category.slug) + '">' + esc(category.name) + '</a><span>/</span>' : '') +
      '<span>' + esc(product.name) + '</span></div>' +
    '<div class="product-page">' +
      '<div class="gallery">' +
        '<div class="gallery-thumbs">' + (product.images || []).map((image, index) =>
          '<button class="gallery-thumb' + (index === 0 ? ' active' : '') + '" data-image="' + index + '" aria-label="Image ' + (index + 1) + '">' +
            '<img src="' + esc(image) + '" alt="' + esc(product.name) + ' — vue ' + (index + 1) + '"></button>'
        ).join('') + '</div>' +
        '<div class="gallery-main">' +
          '<img id="galleryMain" src="' + esc(product.images[0] || IMG_LOGO_FULL) + '" alt="' + esc(product.name) + '">' +
          ((product.images || []).length > 1 ? '<div class="gallery-nav">' +
            '<button data-gallery="prev" aria-label="Image précédente"><svg class="icon"><use href="#i-chevron-left"></use></svg></button>' +
            '<button data-gallery="next" aria-label="Image suivante"><svg class="icon"><use href="#i-chevron-right"></use></svg></button>' +
          '</div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="product-info">' +
        '<div class="product-cat">' + esc(category ? category.name : '') + '</div>' +
        '<h1 class="product-title">' + esc(product.name) + '</h1>' +
        '<div class="product-price-lg">' +
          '<span class="price">' + formatPrice(product.price) + '</span>' +
          (product.comparePrice > product.price ? '<span class="price-old">' + formatPrice(product.comparePrice) + '</span><span class="badge promo">-' + discountPercent(product) + '%</span>' : '') +
        '</div>' +
        '<div class="availability" id="availabilityLine"></div>' +
        (product.description ? '<p class="product-desc">' + esc(product.description) + '</p>' : '') +
        '<div class="option-row">' +
          '<div class="option-label">Couleur <span id="colorLabel"></span></div>' +
          '<div class="color-options" id="colorOptions">' + (product.colors || []).map((color) => {
            const available = (product.sizes || []).some((size) => variantStock(product, color.name, size) > 0);
            return '<button class="color-option' + (!available ? ' disabled' : '') + '" data-color="' + esc(color.name) + '"' + (!available ? ' disabled' : '') + '>' +
              '<span class="dot" style="background:' + esc(color.hex) + '"></span>' + esc(color.name) + '</button>';
          }).join('') + '</div>' +
        '</div>' +
        '<div class="option-row">' +
          '<div class="option-label">' + esc(meta.choose) + ' <span id="sizeLabel"></span></div>' +
          '<div class="size-options" id="sizeOptions">' + (product.sizes || []).map((size) => {
            const stock = variantStock(product, productView.color, size);
            return '<button class="size-option' + (stock <= 0 ? ' disabled' : '') + '" data-size="' + esc(size) + '"' + (stock <= 0 ? ' disabled' : '') + '>' + esc(size) + '</button>';
          }).join('') + '</div>' +
        '</div>' +
        '<div class="stock-note" id="stockNote"></div>' +
        '<div class="add-row">' +
          '<div class="qty">' +
            '<button class="qty-btn" data-qty="minus" aria-label="Diminuer la quantité"><svg class="icon sm"><use href="#i-minus"></use></svg></button>' +
            '<span class="qty-num" id="qtyNum">1</span>' +
            '<button class="qty-btn" data-qty="plus" aria-label="Augmenter la quantité"><svg class="icon sm"><use href="#i-plus"></use></svg></button>' +
          '</div>' +
          '<button class="btn btn-gold add-cart" id="addToCart">' + addCartInner('Ajouter au panier') + '</button>' +
        '</div>' +
        '<div class="product-actions">' +
          '<button class="icon-action' + (state.wishlist.includes(product.id) ? ' active' : '') + '" data-wish="' + esc(product.id) + '" aria-label="Ajouter aux favoris"><svg class="icon"><use href="#i-heart"></use></svg></button>' +
          '<a class="btn btn-outline" id="productInstagram" href="' + instagramDmUrl() + '" target="_blank" rel="noopener"><svg class="icon sm"><use href="#i-instagram"></use></svg> Commander sur Instagram</a>' +
        '</div>' +
        '<div class="perks">' +
          '<div class="perk"><svg class="icon"><use href="#i-truck"></use></svg><span><strong>Livraison</strong> — 58 wilayas' + (state.settings.freeShippingFrom > 0 ? ' · offerte dès ' + formatPrice(state.settings.freeShippingFrom) : '') + '</span></div>' +
          '<div class="perk"><svg class="icon"><use href="#i-shield"></use></svg><span><strong>Paiement à la livraison</strong> — vous vérifiez avant de payer</span></div>' +
          '<div class="perk"><svg class="icon"><use href="#i-instagram"></use></svg><span><strong>Conseil personnalisé</strong> — écrivez-nous sur Instagram</span></div>' +
        '</div>' +
        '<div class="accordion" style="margin-top:8px">' +
          '<div class="accordion-item open">' +
            '<button class="accordion-head">Détails de la pièce <svg class="icon"><use href="#i-chevron"></use></svg></button>' +
            '<div class="accordion-body"><ul>' + (product.details && product.details.length ? product.details.map((line) => '<li>' + esc(line) + '</li>').join('') : '<li>Une pièce sélectionnée avec soin par Diamond Luxury.</li>') + '</ul></div>' +
          '</div>' +
          '<div class="accordion-item">' +
            '<button class="accordion-head">Livraison & paiement <svg class="icon"><use href="#i-chevron"></use></svg></button>' +
            '<div class="accordion-body"><ul><li>Livraison dans les 58 wilayas sous 2 à 5 jours ouvrés.</li><li>Paiement à la livraison, après vérification de votre pièce.</li><li>Frais calculés selon votre wilaya et le mode choisi (domicile ou bureau)' + (state.settings.freeShippingFrom > 0 ? ' — offerts dès ' + formatPrice(state.settings.freeShippingFrom) + ' d’achat.' : '.') + '</li></ul></div>' +
          '</div>' +
          '<div class="accordion-item">' +
            '<button class="accordion-head">Échanges & retours <svg class="icon"><use href="#i-chevron"></use></svg></button>' +
            '<div class="accordion-body"><ul><li>Échange possible sous 48 h, article non porté et dans son emballage.</li><li>Contactez-nous sur Instagram pour organiser un retour.</li><li>Les bijoux et parfums ne peuvent pas être échangés pour des raisons d’hygiène.</li></ul></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    (related.length ?
      '<div class="section tight" style="padding-bottom:0">' +
        '<div class="section-head"><div class="eyebrow">À compléter avec</div><h2 style="font-size:clamp(30px,3.4vw,42px)">Dans le même <em class="gold-text">univers.</em></h2></div>' +
        '<div class="product-grid">' + productGrid(related) + '</div>' +
      '</div>' : '');

  bindProduct(product);
  updateVariantUI(product);
}

function bindProduct(product) {
  const main = $('#galleryMain');

  $$('#productPage .gallery-thumb').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.image);
      productView.image = index;
      main.src = product.images[index];
      $$('#productPage .gallery-thumb').forEach((thumb) => thumb.classList.toggle('active', thumb === button));
    });
  });

  $$('#productPage [data-gallery]').forEach((button) => {
    button.addEventListener('click', () => {
      const total = (product.images || []).length;
      if (!total) return;
      productView.image = (productView.image + (button.dataset.gallery === 'next' ? 1 : -1) + total) % total;
      main.src = product.images[productView.image];
      $$('#productPage .gallery-thumb').forEach((thumb, index) => thumb.classList.toggle('active', index === productView.image));
    });
  });

  $$('#productPage [data-color]').forEach((button) => {
    if (button.disabled) return;
    button.addEventListener('click', () => {
      const color = button.dataset.color;
      productView.color = color;
      const available = (product.sizes || []).find((size) => variantStock(product, color, size) > 0);
      if (!available) {
        productView.size = product.sizes[0];
      } else if (variantStock(product, color, productView.size) <= 0) {
        productView.size = available;
      }
      productView.qty = 1;
      $$('#productPage [data-color]').forEach((entry) => entry.classList.toggle('active', entry.dataset.color === color));
      $$('#productPage [data-size]').forEach((entry) => {
        const stock = variantStock(product, color, entry.dataset.size);
        entry.classList.toggle('disabled', stock <= 0);
        entry.disabled = stock <= 0;
        entry.classList.toggle('active', entry.dataset.size === productView.size);
      });
      updateVariantUI(product);
    });
  });

  $$('#productPage [data-size]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.disabled) return;
      productView.size = button.dataset.size;
      productView.qty = 1;
      $$('#productPage [data-size]').forEach((entry) => entry.classList.toggle('active', entry === button));
      updateVariantUI(product);
    });
  });

  $$('#productPage [data-qty]').forEach((button) => {
    button.addEventListener('click', () => {
      const stock = variantStock(product, productView.color, productView.size);
      const delta = button.dataset.qty === 'plus' ? 1 : -1;
      productView.qty = Math.max(1, Math.min(stock || 1, productView.qty + delta));
      $('#qtyNum').textContent = productView.qty;
    });
  });

  $('#addToCart').addEventListener('click', () => {
    const add = $('#addToCart');
    const done = () => addToCart(product, productView.color, productView.size, productView.qty);
    if (!playAddToCart(add, done)) done();
  });

  $$('#productPage .accordion-head').forEach((head) => {
    head.addEventListener('click', () => head.parentElement.classList.toggle('open'));
  });
}

function updateVariantUI(product) {
  const color = productView.color;
  const size = productView.size;
  const stock = variantStock(product, color, size);
  const available = stock > 0;

  $$('#productPage [data-color]').forEach((button) => button.classList.toggle('active', button.dataset.color === color));
  $$('#productPage [data-size]').forEach((button) => {
    const buttonStock = variantStock(product, color, button.dataset.size);
    button.classList.toggle('active', button.dataset.size === size);
    button.classList.toggle('disabled', buttonStock <= 0);
    button.disabled = buttonStock <= 0;
  });

  const colorLabel = $('#colorLabel');
  if (colorLabel) colorLabel.textContent = color;
  const sizeLabel = $('#sizeLabel');
  if (sizeLabel) sizeLabel.textContent = size;

  const availability = $('#availabilityLine');
  if (availability) {
    if (!available) {
      availability.className = 'availability out';
      availability.textContent = 'En rupture';
    } else {
      availability.className = 'availability';
      availability.textContent = 'En stock — prêt à être expédié';
    }
  }

  const note = $('#stockNote');
  if (note) {
    note.className = 'stock-note' + (!available ? ' out' : '');
    note.textContent = !available
      ? 'En rupture. Choisissez une autre couleur ou ' + variantMeta(product).lower + '.'
      : '';
  }

  const add = $('#addToCart');
  if (add) {
    add.disabled = !available;
    setAddCartLabel(add, available ? 'Ajouter au panier' : 'En rupture');
  }
  const qty = $('#qtyNum');
  if (qty) qty.textContent = productView.qty;

  const insta = $('#productInstagram');
  if (insta) {
    const category = categoryOf(product);
    insta.href = instagramDmUrl();
    insta.dataset.category = category ? category.name : '';
  }
}

/* ------------------------------ Aperçu rapide (Quick View) ------------------------------ */

function quickViewProduct() {
  return quickView ? productById(quickView.productId) : null;
}

function quickViewMarkup(product) {
  const category = categoryOf(product);
  const images = product.images || [];
  const meta = variantMeta(product);
  const color = quickView.color;
  const favorited = state.wishlist.includes(product.id);

  const thumbs = images.length > 1
    ? '<div class="qv-thumbs">' + images.map((image, index) =>
        '<button type="button" class="qv-thumb' + (index === quickView.image ? ' active' : '') + '" data-qv-image="' + index + '" aria-label="Vue ' + (index + 1) + '">' +
          '<img src="' + esc(image) + '" alt="" loading="lazy">' +
        '</button>').join('') + '</div>'
    : '';

  const arrows = images.length > 1
    ? '<div class="gallery-nav">' +
        '<button type="button" data-qv-gallery="prev" aria-label="Image précédente"><svg class="icon"><use href="#i-chevron-left"></use></svg></button>' +
        '<button type="button" data-qv-gallery="next" aria-label="Image suivante"><svg class="icon"><use href="#i-chevron-right"></use></svg></button>' +
      '</div>'
    : '';

  const colorOptions = (product.colors || []).map((tone) => {
    const available = (product.sizes || []).some((size) => variantStock(product, tone.name, size) > 0);
    return '<button type="button" class="color-option' + (!available ? ' disabled' : '') + '" data-qv-color="' + esc(tone.name) + '"' + (!available ? ' disabled' : '') + '>' +
      '<span class="dot" style="background:' + esc(tone.hex) + '"></span>' + esc(tone.name) + '</button>';
  }).join('');

  const sizeOptions = (product.sizes || []).map((size) => {
    const stock = variantStock(product, color, size);
    return '<button type="button" class="size-option' + (stock <= 0 ? ' disabled' : '') + '" data-qv-size="' + esc(size) + '"' + (stock <= 0 ? ' disabled' : '') + '>' + esc(size) + '</button>';
  }).join('');

  const details = product.details && product.details.length
    ? product.details
    : ['Une pièce sélectionnée avec soin par Diamond Luxury.'];

  return '<div class="qv-grid">' +
    '<div class="qv-gallery">' +
      '<div class="qv-main">' +
        '<img id="qvMainImage" src="' + esc(images[0] || IMG_LOGO_FULL) + '" alt="' + esc(product.name) + '">' +
        arrows +
      '</div>' +
      thumbs +
    '</div>' +
    '<div class="qv-info">' +
      '<div class="product-cat">' + esc(category ? category.name : '') + '</div>' +
      '<h2 class="qv-title" id="qvTitle">' + esc(product.name) + '</h2>' +
      '<div class="product-price-lg">' +
        '<span class="price' + (discountPercent(product) ? ' price-promo' : '') + '">' + formatPrice(product.price) + '</span>' +
        (product.comparePrice > product.price ? '<span class="price-old">' + formatPrice(product.comparePrice) + '</span><span class="badge promo">-' + discountPercent(product) + '%</span>' : '') +
      '</div>' +
      '<div class="availability" id="qvAvailability"></div>' +
      (product.description ? '<p class="product-desc">' + esc(product.description) + '</p>' : '') +
      '<div class="option-row">' +
        '<div class="option-label">Couleur <span id="qvColorLabel"></span></div>' +
        '<div class="color-options" id="qvColorOptions">' + colorOptions + '</div>' +
      '</div>' +
      '<div class="option-row">' +
        '<div class="option-label">' + esc(meta.choose) + ' <span id="qvSizeLabel"></span></div>' +
        '<div class="size-options" id="qvSizeOptions">' + sizeOptions + '</div>' +
      '</div>' +
      '<div class="stock-note" id="qvStockNote"></div>' +
      '<div class="add-row">' +
        '<div class="qty">' +
          '<button type="button" class="qty-btn" data-qv-qty="minus" aria-label="Diminuer la quantité"><svg class="icon sm"><use href="#i-minus"></use></svg></button>' +
          '<span class="qty-num" id="qvQtyNum">1</span>' +
          '<button type="button" class="qty-btn" data-qv-qty="plus" aria-label="Augmenter la quantité"><svg class="icon sm"><use href="#i-plus"></use></svg></button>' +
        '</div>' +
        '<button type="button" class="btn btn-gold add-cart" id="qvAddToCart">' + addCartInner('Ajouter au panier') + '</button>' +
      '</div>' +
      '<div class="product-actions">' +
        '<button type="button" class="icon-action' + (favorited ? ' active' : '') + '" data-wish="' + esc(product.id) + '" aria-label="' + (favorited ? 'Retirer des favoris' : 'Ajouter aux favoris') + '"><svg class="icon"><use href="#i-heart"></use></svg></button>' +
        '<a class="btn btn-outline" id="qvInstagram" href="' + instagramDmUrl() + '" target="_blank" rel="noopener"><svg class="icon sm"><use href="#i-instagram"></use></svg> Commander sur Instagram</a>' +
      '</div>' +
      '<div class="perks qv-perks">' +
        '<div class="perk"><svg class="icon"><use href="#i-truck"></use></svg><span><strong>Livraison</strong> — 58 wilayas' + (state.settings.freeShippingFrom > 0 ? ' · offerte dès ' + formatPrice(state.settings.freeShippingFrom) : '') + '</span></div>' +
        '<div class="perk"><svg class="icon"><use href="#i-shield"></use></svg><span><strong>Paiement à la livraison</strong> — vous vérifiez avant de payer</span></div>' +
      '</div>' +
      '<div class="accordion">' +
        '<div class="accordion-item open">' +
          '<button type="button" class="accordion-head" aria-expanded="true">Détails de la pièce <svg class="icon"><use href="#i-chevron"></use></svg></button>' +
          '<div class="accordion-body"><ul>' + details.map((line) => '<li>' + esc(line) + '</li>').join('') + '</ul></div>' +
        '</div>' +
        '<div class="accordion-item">' +
          '<button type="button" class="accordion-head" aria-expanded="false">Livraison & paiement <svg class="icon"><use href="#i-chevron"></use></svg></button>' +
          '<div class="accordion-body"><ul><li>Livraison dans les 58 wilayas sous 2 à 5 jours ouvrés.</li><li>Paiement à la livraison, après vérification de votre pièce.</li><li>Frais calculés selon votre wilaya et le mode choisi (domicile ou bureau)' + (state.settings.freeShippingFrom > 0 ? ' — offerts dès ' + formatPrice(state.settings.freeShippingFrom) + ' d’achat.' : '.') + '</li></ul></div>' +
        '</div>' +
        '<div class="accordion-item">' +
          '<button type="button" class="accordion-head" aria-expanded="false">Échanges & retours <svg class="icon"><use href="#i-chevron"></use></svg></button>' +
          '<div class="accordion-body"><ul><li>Échange possible sous 48 h, article non porté et dans son emballage.</li><li>Contactez-nous sur Instagram pour organiser un retour.</li><li>Les bijoux et parfums ne peuvent pas être échangés pour des raisons d’hygiène.</li></ul></div>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function openQuickView(idOrSlug) {
  const product = productById(idOrSlug) || state.products.find((entry) => entry.slug === idOrSlug);
  if (!product || !product.active) return;

  closeSearch();
  closeSideDrawer();
  closeCart();
  $('#shopFilters').classList.remove('open');

  const wasOpen = $('#quickViewOverlay').classList.contains('open');
  const initial = firstAvailableVariant(product);
  quickView = {
    productId: product.id,
    color: initial ? initial.color : (product.colors[0] ? product.colors[0].name : 'Unique'),
    size: initial ? initial.size : (product.sizes[0] || 'Taille unique'),
    qty: 1,
    image: 0
  };
  if (!wasOpen) quickViewTrigger = document.activeElement;

  $('#quickViewContent').innerHTML = quickViewMarkup(product);
  bindQuickView(product);
  updateQuickViewUI(product);
  $('#quickViewOverlay').classList.add('open');
  $('#quickViewOverlay').setAttribute('aria-hidden', 'false');
  syncBodyLock();
  setTimeout(() => {
    const close = $('#quickViewClose');
    if (close && $('#quickViewOverlay').classList.contains('open')) close.focus();
  }, 60);
}

function closeQuickView() {
  const overlay = $('#quickViewOverlay');
  if (!overlay.classList.contains('open')) return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  syncBodyLock();
  const trigger = quickViewTrigger;
  quickView = null;
  quickViewTrigger = null;
  setTimeout(() => {
    const content = $('#quickViewContent');
    if (content && !overlay.classList.contains('open')) content.innerHTML = '';
  }, 280);
  if (trigger && trigger.isConnected) setTimeout(() => trigger.focus({ preventScroll: true }), 80);
}

function setQuickViewImage(index) {
  const product = quickViewProduct();
  if (!product || !quickView) return;
  const images = product.images || [];
  if (!images.length) return;
  quickView.image = (index + images.length) % images.length;
  const main = $('#qvMainImage');
  if (main) main.src = images[quickView.image];
  $$('#quickViewContent [data-qv-image]').forEach((thumb) => {
    thumb.classList.toggle('active', Number(thumb.dataset.qvImage) === quickView.image);
  });
}

function bindQuickView(product) {
  $$('#quickViewContent [data-qv-image]').forEach((thumb) => {
    thumb.addEventListener('click', () => setQuickViewImage(Number(thumb.dataset.qvImage)));
  });

  $$('#quickViewContent [data-qv-gallery]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!quickView) return;
      setQuickViewImage(quickView.image + (button.dataset.qvGallery === 'next' ? 1 : -1));
    });
  });

  $$('#quickViewContent [data-qv-color]').forEach((button) => {
    if (button.disabled) return;
    button.addEventListener('click', () => {
      if (!quickView) return;
      const tone = button.dataset.qvColor;
      quickView.color = tone;
      const available = (product.sizes || []).find((size) => variantStock(product, tone, size) > 0);
      if (!available) quickView.size = product.sizes[0];
      else if (variantStock(product, tone, quickView.size) <= 0) quickView.size = available;
      quickView.qty = 1;
      updateQuickViewUI(product);
    });
  });

  $$('#quickViewContent [data-qv-size]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!quickView || button.disabled) return;
      quickView.size = button.dataset.qvSize;
      quickView.qty = 1;
      updateQuickViewUI(product);
    });
  });

  $$('#quickViewContent [data-qv-qty]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!quickView) return;
      const stock = variantStock(product, quickView.color, quickView.size);
      const delta = button.dataset.qvQty === 'plus' ? 1 : -1;
      quickView.qty = Math.max(1, Math.min(stock || 1, quickView.qty + delta));
      $('#qvQtyNum').textContent = quickView.qty;
    });
  });

  const add = $('#qvAddToCart');
  if (add) {
    add.addEventListener('click', () => {
      if (!quickView) return;
      const { color, size, qty } = quickView;
      if (variantStock(product, color, size) <= 0) return;
      const done = () => {
        closeQuickView();
        addToCart(product, color, size, qty);
      };
      if (!playAddToCart(add, done)) done();
    });
  }

  $$('#quickViewContent .accordion-head').forEach((head) => {
    head.addEventListener('click', () => {
      const item = head.parentElement;
      item.classList.toggle('open');
      head.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false');
    });
  });
}

function updateQuickViewUI(product) {
  if (!quickView) return;
  const { color, size } = quickView;
  const stock = variantStock(product, color, size);
  const available = stock > 0;

  $$('#quickViewContent [data-qv-color]').forEach((button) => button.classList.toggle('active', button.dataset.qvColor === color));
  $$('#quickViewContent [data-qv-size]').forEach((button) => {
    const buttonStock = variantStock(product, color, button.dataset.qvSize);
    button.classList.toggle('disabled', buttonStock <= 0);
    button.disabled = buttonStock <= 0;
    button.classList.toggle('active', button.dataset.qvSize === size);
  });

  const colorLabel = $('#qvColorLabel');
  if (colorLabel) colorLabel.textContent = color;
  const sizeLabel = $('#qvSizeLabel');
  if (sizeLabel) sizeLabel.textContent = size;

  const availability = $('#qvAvailability');
  if (availability) {
    availability.className = 'availability' + (!available ? ' out' : '');
    availability.textContent = available ? 'En stock — prêt à être expédié' : 'En rupture';
  }

  const note = $('#qvStockNote');
  if (note) {
    note.className = 'stock-note' + (!available ? ' out' : '');
    note.textContent = available ? '' : 'En rupture. Choisissez une autre couleur ou ' + variantMeta(product).lower + '.';
  }

  const add = $('#qvAddToCart');
  if (add) {
    add.disabled = !available;
    setAddCartLabel(add, available ? 'Ajouter au panier' : 'En rupture');
  }

  const qty = $('#qvQtyNum');
  if (qty) qty.textContent = quickView.qty;

  const insta = $('#qvInstagram');
  if (insta) insta.href = instagramDmUrl();
}

/* ------------------------------ Favoris ------------------------------ */

function toggleWishlist(id) {
  const index = state.wishlist.indexOf(id);
  if (index === -1) {
    state.wishlist.push(id);
    toast('Ajouté à vos favoris.');
  } else {
    state.wishlist.splice(index, 1);
    toast('Retiré de vos favoris.');
  }
  writeStorage('dl_wish', state.wishlist);
  updateBadges();
  $$('[data-wish="' + CSS.escape(id) + '"]').forEach((button) => {
    const active = state.wishlist.includes(id);
    button.classList.toggle('active', active);
    button.setAttribute('aria-label', active ? 'Retirer des favoris' : 'Ajouter aux favoris');
  });
  if (location.hash.startsWith('#/favoris')) renderWishlist();
}

function renderWishlist() {
  const products = state.wishlist.map(productById).filter(Boolean);
  $('#wishlistGrid').innerHTML = products.length
    ? productGrid(products)
    : emptyState('Aucun favori pour l’instant', 'Cliquez sur le cœur d’une pièce pour la retrouver ici.', 'Découvrir la boutique', '#/boutique');
}

/* ------------------------------ Panier ------------------------------ */

function cartLines() {
  return state.cart.map((item) => {
    const product = productById(item.productId);
    if (!product) return null;
    return { ...item, product, stock: variantStock(product, item.color, item.size) };
  }).filter(Boolean);
}

function cartSubtotal() {
  return cartLines().reduce((sum, line) => sum + line.product.price * line.qty, 0);
}

/* ------------------------------ Animation « Ajouter au panier » ------------------------------ */

function addCartInner(label) {
  return '<span class="ac-label">' + esc(label) + '</span>' +
    '<span class="ac-cart" aria-hidden="true">' +
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.8 4h2.3l2.3 10.3h9.9l2-7.1H7.2"/><circle cx="9.6" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/></svg>' +
      '<span class="ac-dot"></span>' +
    '</span>' +
    '<span class="ac-check" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.6l4.4 4.4L19 6.6"/></svg>' +
    '</span>';
}

function setAddCartLabel(button, label) {
  if (!button) return;
  const node = $('.ac-label', button);
  if (node) node.textContent = label;
  else button.textContent = label;
}

function playAddToCart(button, onDone) {
  if (!button || button.disabled) return false;
  if (button.dataset.busy === 'true') return true;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;

  button.dataset.busy = 'true';
  button.setAttribute('aria-busy', 'true');
  button.classList.remove('is-success');
  button.classList.add('is-adding');

  window.setTimeout(() => {
    button.classList.remove('is-adding');
    button.classList.add('is-success');
    window.setTimeout(() => {
      button.classList.remove('is-success');
      delete button.dataset.busy;
      button.removeAttribute('aria-busy');
      if (typeof onDone === 'function') onDone();
    }, 1400);
  }, 1200);

  return true;
}

function addToCart(product, color, size, qty) {
  const stock = variantStock(product, color, size);
  if (stock <= 0) {
    toast('Cette variante est en rupture.', 'error');
    return;
  }
  const existing = state.cart.find((item) => item.productId === product.id && item.color === color && item.size === size);
  if (existing) {
    existing.qty = Math.min(stock, existing.qty + qty);
  } else {
    state.cart.push({ productId: product.id, color, size, qty: Math.min(stock, qty) });
  }
  writeStorage('dl_cart', state.cart);
  updateBadges();
  renderCart();
  openCart();
  toast(product.name + ' a été ajouté au panier.');
}

function updateCartQty(index, delta) {
  const item = state.cart[index];
  if (!item) return;
  const product = productById(item.productId);
  if (!product) return;
  const stock = variantStock(product, item.color, item.size);
  const next = Math.min(stock, Math.max(0, item.qty + delta));
  if (next <= 0) {
    state.cart.splice(index, 1);
  } else {
    item.qty = next;
  }
  writeStorage('dl_cart', state.cart);
  updateBadges();
  renderCart();
}

function removeCartItem(index) {
  state.cart.splice(index, 1);
  writeStorage('dl_cart', state.cart);
  updateBadges();
  renderCart();
}

function renderCart() {
  const lines = cartLines();
  const container = $('#cartItems');
  const foot = $('#cartFoot');
  if (!container || !foot) return;

  if (!lines.length) {
    container.innerHTML =
      '<div class="cart-empty">' +
        '<svg class="icon"><use href="#i-bag"></use></svg>' +
        '<h3>Votre panier est vide</h3>' +
        '<p>Laissez-vous séduire par nos pièces sélectionnées.</p>' +
        '<button class="btn btn-gold" data-go-shop>Découvrir la boutique</button>' +
      '</div>';
    foot.innerHTML = '';
    return;
  }

  container.innerHTML = lines.map((line, index) =>
    '<div class="cart-item">' +
      '<a class="cart-thumb" href="' + productUrl(line.product) + '"><img src="' + esc(line.product.images[0] || IMG_LOGO_FULL) + '" alt="' + esc(line.product.name) + '"></a>' +
      '<div>' +
        '<div class="cart-item-top">' +
          '<div>' +
            '<h3><a href="' + productUrl(line.product) + '">' + esc(line.product.name) + '</a></h3>' +
            '<div class="variant">' + esc(line.color) + ' · ' + esc(variantMeta(line.product).label) + ' ' + esc(line.size) + '</div>' +
            '<div class="price">' + formatPrice(line.product.price) + '</div>' +
          '</div>' +
          '<button class="cart-remove" data-cart-remove="' + index + '" aria-label="Retirer ' + esc(line.product.name) + '"><svg class="icon"><use href="#i-trash"></use></svg></button>' +
        '</div>' +
        '<div class="cart-item-bottom">' +
          '<div class="qty sm">' +
            '<button class="qty-btn" data-cart-qty="' + index + '" data-delta="-1" aria-label="Diminuer"><svg class="icon sm"><use href="#i-minus"></use></svg></button>' +
            '<span class="qty-num">' + line.qty + '</span>' +
            '<button class="qty-btn" data-cart-qty="' + index + '" data-delta="1" aria-label="Augmenter"><svg class="icon sm"><use href="#i-plus"></use></svg></button>' +
          '</div>' +
          '<span class="line-total">' + formatPrice(line.product.price * line.qty) + '</span>' +
        '</div>' +
      '</div>' +
    '</div>'
  ).join('');

  const subtotal = cartSubtotal();
  const threshold = Number(state.settings.freeShippingFrom) || 0;
  const freeShipping = threshold > 0 && subtotal >= threshold;
  const remaining = threshold > 0 ? threshold - subtotal : 0;

  foot.innerHTML =
    (threshold > 0 && remaining > 0
      ? '<div class="free-ship-note">Plus que ' + formatPrice(remaining) + ' pour la livraison offerte.</div>'
      : threshold > 0 && remaining <= 0
        ? '<div class="free-ship-note">Livraison offerte sur cette commande.</div>'
        : '') +
    '<div class="summary-row"><span>Sous-total</span><span>' + formatPrice(subtotal) + '</span></div>' +
    '<div class="summary-row"><span>Livraison</span><span>' + (freeShipping ? 'Offerte' : 'Calculée au checkout') + '</span></div>' +
    '<div class="summary-row total"><span>Total articles</span><span>' + formatPrice(subtotal) + '</span></div>' +
    '<button class="btn btn-gold btn-block" id="checkoutBtn" style="margin-top:16px">Passer la commande</button>' +
    '<div style="font-size:10px;color:var(--muted);text-align:center;margin-top:10px">Paiement à la livraison · Confirmation par Instagram</div>';

  $('#checkoutBtn').addEventListener('click', openCheckout);
}

/* ------------------------------ Commande ------------------------------ */

async function openCheckout() {
  const lines = cartLines();
  if (!lines.length) return;
  if (!state.shipping.wilayas.length) await loadShippingWilayas();

  const subtotal = cartSubtotal();
  const settings = state.settings;
  const draft = {
    wilayaId: '',
    communeId: '',
    mode: 'domicile',
    stopdeskId: '',
    stopdesk: null,
    quote: null,
    homeQuote: null,
    stopQuote: null,
    promo: null,
    stopdesks: []
  };

  const wilayaOptions = state.shipping.wilayas.length
    ? '<option value="">Choisir la wilaya…</option>' + state.shipping.wilayas.map((wilaya) =>
        '<option value="' + wilaya.id + '">' + esc(wilaya.label) + '</option>').join('')
    : '<option value="">Wilayas indisponibles</option>';

  openModal(
    '<h2>Finaliser la commande</h2>' +
    '<p class="modal-sub">Livraison dans les 58 wilayas — paiement à la réception de votre colis.</p>' +
    '<form id="checkoutForm" novalidate>' +
      '<div class="form-grid">' +
        '<div class="field"><label for="oFirstName">Prénom *</label><input id="oFirstName" name="firstName" required maxlength="60" autocomplete="given-name" placeholder="Votre prénom"></div>' +
        '<div class="field"><label for="oLastName">Nom *</label><input id="oLastName" name="lastName" required maxlength="60" autocomplete="family-name" placeholder="Votre nom"></div>' +
        '<div class="field"><label for="oPhone">Téléphone *</label><input id="oPhone" name="phone" required inputmode="numeric" maxlength="17" autocomplete="tel" placeholder="05 55 00 00 00"><span class="field-hint" id="phoneHint"></span></div>' +
        '<div class="field"><label for="oWilaya">Wilaya *</label><select id="oWilaya" name="wilaya" required>' + wilayaOptions + '</select></div>' +
        '<div class="field"><label for="oCommune">Commune *</label><select id="oCommune" name="commune" required disabled><option value="">Choisissez la wilaya d’abord</option></select></div>' +
        '<div class="field full"><label>Mode de livraison *</label>' +
          '<div class="delivery-modes" id="deliveryModes" role="radiogroup" aria-label="Mode de livraison">' +
            '<div class="delivery-card" data-mode-card="stopdesk">' +
              '<button type="button" class="delivery-mode" data-mode="stopdesk" role="radio" aria-checked="false">' +
                '<span class="mode-icon"><svg class="icon sm"><use href="#i-map"></use></svg></span>' +
                '<span class="mode-text"><strong>Livraison au bureau</strong><small>Retrait dans un point relais</small></span>' +
                '<span class="mode-radio" aria-hidden="true"></span>' +
              '</button>' +
              '<div class="stopdesk-panel" id="stopdeskPanel" hidden>' +
                '<div class="stopdesk-list" id="stopdeskList" role="radiogroup" aria-label="Bureaux de livraison"></div>' +
                '<span class="field-hint" id="stopdeskHint"></span>' +
              '</div>' +
            '</div>' +
            '<div class="delivery-card active" data-mode-card="domicile">' +
              '<button type="button" class="delivery-mode active" data-mode="domicile" role="radio" aria-checked="true">' +
                '<span class="mode-icon"><svg class="icon sm"><use href="#i-truck"></use></svg></span>' +
                '<span class="mode-text"><strong>Livraison à domicile</strong><small>Chez vous, à l’adresse indiquée</small></span>' +
                '<span class="mode-price" id="homePrice"></span>' +
                '<span class="mode-radio" aria-hidden="true"></span>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="field full" id="addressField"><label for="oAddress">Adresse *</label><input id="oAddress" name="address" autocomplete="street-address" placeholder="Cité, rue, numéro, repère…"></div>' +
        '<div class="field full"><label for="oNotes">Note (facultatif)</label><textarea id="oNotes" name="notes" rows="2" placeholder="Repère, préférence de livraison…"></textarea></div>' +
        '<div class="field full promo-field"><label for="oPromo">Code promo (facultatif)</label>' +
          '<div class="promo-input">' +
            '<input id="oPromo" name="promo" autocomplete="off" spellcheck="false" placeholder="EX. DIAMOND10" maxlength="30">' +
            '<button type="button" class="btn btn-outline" id="applyPromo">Appliquer</button>' +
          '</div>' +
          '<span class="field-hint" id="promoHint"></span>' +
        '</div>' +
      '</div>' +
      '<div class="checkout-summary">' +
        lines.map((line) =>
          '<div class="summary-row"><span>' + esc(line.product.name) + ' × ' + line.qty + ' <small style="color:var(--muted)">(' + esc(line.color) + ' · ' + esc(variantMeta(line.product).label) + ' ' + esc(line.size) + ')</small></span><span>' + formatPrice(line.product.price * line.qty) + '</span></div>'
        ).join('') +
        '<div class="summary-row promo-summary" id="promoSummary" hidden><span>Réduction <small id="promoLabel"></small></span><span id="promoAmount"></span></div>' +
        '<div class="summary-row"><span>Livraison</span><span id="checkoutDelivery">Choisissez votre commune</span></div>' +
        '<div class="summary-row total"><span>Total</span><span id="checkoutTotal">' + formatPrice(subtotal) + '</span></div>' +
      '</div>' +
      '<div class="shipping-source" id="shippingSource"></div>' +
      '<div class="form-error" id="checkoutError"></div>' +
      '<div style="margin-top:18px"><button type="submit" class="btn btn-gold btn-block" id="checkoutSubmit" disabled>Confirmer la commande</button></div>' +
      '<p class="wa-note" style="text-align:center">En confirmant, votre commande est enregistrée et vous pourrez la confirmer directement sur notre Instagram.</p>' +
    '</form>'
  );

  const form = $('#checkoutForm');
  const firstNameInput = $('#oFirstName');
  const lastNameInput = $('#oLastName');
  const wilayaSelect = $('#oWilaya');
  const communeSelect = $('#oCommune');
  const stopdeskPanel = $('#stopdeskPanel');
  const stopdeskList = $('#stopdeskList');
  const stopdeskHint = $('#stopdeskHint');
  const homePrice = $('#homePrice');
  const addressField = $('#addressField');
  const addressInput = $('#oAddress');
  const phoneInput = $('#oPhone');
  const phoneHint = $('#phoneHint');
  const deliveryLabel = $('#checkoutDelivery');
  const totalLabel = $('#checkoutTotal');
  const shippingSource = $('#shippingSource');
  const submit = $('#checkoutSubmit');
  const errorBox = $('#checkoutError');
  const promoInput = $('#oPromo');
  const promoApply = $('#applyPromo');
  const promoHint = $('#promoHint');
  const promoSummary = $('#promoSummary');
  const promoLabel = $('#promoLabel');
  const promoAmount = $('#promoAmount');

  const validPhone = (value) => /^0[567]\d{8}$/.test(digits(value));

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.add('show');
    errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideError() {
    errorBox.classList.remove('show');
    errorBox.textContent = '';
  }

  function setPhoneHint() {
    const value = digits(phoneInput.value);
    if (!value) {
      phoneHint.textContent = '';
      phoneInput.classList.remove('invalid');
      return;
    }
    const ok = validPhone(value);
    phoneInput.classList.toggle('invalid', !ok);
    phoneHint.textContent = ok ? '' : 'Le numéro doit commencer par 05, 06 ou 07 et contenir exactement 10 chiffres.';
    phoneHint.classList.toggle('error', !ok);
  }

  phoneInput.addEventListener('input', setPhoneHint);

  function quoteText(quote) {
    if (!quote) return '';
    return quote.price === 0 ? 'Offerte' : formatPrice(quote.price);
  }

  function officeDeliveryPrice(office) {
    if (!office) return null;
    const freeFrom = Number(state.settings.freeShippingFrom) || 0;
    if (freeFrom > 0 && subtotal >= freeFrom) return 0;
    const price = Number(office.price);
    return Number.isFinite(price) ? price : null;
  }

  function promoDiscount() {
    if (!draft.promo) return 0;
    return Math.round(subtotal * (Number(draft.promo.percent) || 0) / 100);
  }

  function updateTotal() {
    const delivery = draft.quote ? draft.quote.price : null;
    const discount = promoDiscount();
    totalLabel.textContent = formatPrice(Math.max(0, subtotal - discount) + (delivery || 0));
    if (draft.promo && discount > 0) {
      promoSummary.hidden = false;
      promoLabel.textContent = '(' + draft.promo.code + ' · −' + draft.promo.percent + '%)';
      promoAmount.textContent = '−' + formatPrice(discount);
    } else {
      promoSummary.hidden = true;
      promoLabel.textContent = '';
      promoAmount.textContent = '';
    }
  }

  async function applyPromo() {
    const code = promoInput.value.trim().toUpperCase();
    promoHint.classList.remove('error');
    if (!code) {
      draft.promo = null;
      promoHint.textContent = 'Saisissez un code pour bénéficier de la réduction.';
      applyQuote();
      return;
    }
    promoApply.disabled = true;
    promoApply.textContent = 'Vérification…';
    promoHint.textContent = '';
    try {
      const response = await fetch(API_BASE + '/api/promos/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Vérification impossible.');
      if (!result.valid) {
        draft.promo = null;
        promoHint.textContent = result.error || 'Code promo invalide ou désactivé.';
        promoHint.classList.add('error');
      } else {
        draft.promo = { code: result.code, percent: result.percent };
        promoHint.textContent = 'Code ' + result.code + ' appliqué : −' + result.percent + '% sur les articles.';
      }
      applyQuote();
    } catch (error) {
      draft.promo = null;
      promoHint.textContent = error.message;
      promoHint.classList.add('error');
      applyQuote();
    } finally {
      promoApply.disabled = false;
      promoApply.textContent = 'Appliquer';
    }
  }

  promoInput.addEventListener('input', () => {
    promoInput.value = promoInput.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  });
  promoInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    applyPromo();
  });
  promoApply.addEventListener('click', applyPromo);

  function updateStopDeskPrices() {
    $$('[data-office-index]', stopdeskList).forEach((button) => {
      const office = draft.stopdesks[Number(button.dataset.officeIndex)];
      const price = officeDeliveryPrice(office);
      const node = $('.stopdesk-price', button);
      if (node) node.textContent = '— ' + (price != null ? formatPrice(price) : (quoteText(draft.stopQuote) || '…'));
    });
  }

  function applyQuote() {
    draft.quote = draft.mode === 'stopdesk' ? draft.stopQuote : draft.homeQuote;
    const quote = draft.quote;

    if (!draft.wilayaId || !draft.communeId) {
      deliveryLabel.textContent = draft.wilayaId ? 'Choisissez votre commune' : 'Choisissez votre wilaya';
      shippingSource.textContent = '';
    } else if (!quote) {
      deliveryLabel.textContent = 'Calcul en cours…';
      shippingSource.textContent = '';
    } else {
      deliveryLabel.textContent = quoteText(quote);
      if (quote.price === 0 && quote.basePrice > 0) {
        shippingSource.textContent = 'Livraison offerte : votre panier dépasse ' + formatPrice(quote.freeShippingFrom) + '.';
      } else if (quote.source === 'zimou') {
        shippingSource.textContent = 'Tarif Zimou Express · ' + (quote.label || (draft.mode === 'stopdesk' ? 'Point relais' : 'Domicile'));
      } else {
        shippingSource.textContent = 'Tarif indicatif · Zimou Express sera utilisé dès que la clé API sera configurée.';
      }
    }

    homePrice.textContent = quoteText(draft.homeQuote);
    updateStopDeskPrices();
    updateTotal();

    const needsOffice = draft.mode === 'stopdesk' && !draft.stopdesk;
    submit.disabled = !draft.quote || !draft.communeId || needsOffice;
  }

  let officeQuoteRequest = 0;

  async function refreshSelectedOfficeQuote() {
    const office = draft.stopdesk;
    if (draft.mode !== 'stopdesk' || !office) {
      applyQuote();
      return;
    }
    const requestId = ++officeQuoteRequest;
    const localPrice = officeDeliveryPrice(office);
    draft.stopQuote = localPrice != null
      ? { price: localPrice, source: 'zimou', method: 'stopdesk', label: office.carrier ? 'Point relais · ' + office.carrier : 'Point relais' }
      : null;
    applyQuote();

    if (office.id == null) return;
    try {
      const quote = await shippingQuote(draft.wilayaId, draft.communeId, 'stopdesk', subtotal, office.id);
      if (requestId !== officeQuoteRequest) return;
      draft.stopQuote = quote;
    } catch {
      if (requestId !== officeQuoteRequest) return;
    }
    applyQuote();
  }

  function selectStopDesk(index) {
    const office = draft.stopdesks[index];
    if (!office) return;
    draft.stopdesk = office;
    draft.stopdeskId = office.id != null ? String(office.id) : '';
    $$('[data-office-index]', stopdeskList).forEach((button) => {
      const active = Number(button.dataset.officeIndex) === index;
      button.classList.toggle('active', active);
      button.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    refreshSelectedOfficeQuote();
  }

  function renderStopDesks() {
    stopdeskList.innerHTML = draft.stopdesks.map((office, index) => {
      const carrier = carrierOf(office);
      const selected = draft.stopdesk === office;
      const officePrice = officeDeliveryPrice(office);
      const priceLabel = officePrice != null ? formatPrice(officePrice) : (quoteText(draft.stopQuote) || '…');
      const logo = office.logo || carrier.logo;
      return '<button type="button" class="stopdesk-card' + (selected ? ' active' : '') + '" data-office-index="' + index + '" role="radio" aria-checked="' + (selected ? 'true' : 'false') + '">' +
        '<span class="carrier-logo" style="color:' + carrier.color + ';background:' + carrier.bg + '">' +
          (logo
            ? '<img src="' + esc(logo) + '" alt="' + esc(carrier.name) + '">'
            : esc(carrier.initials)) +
        '</span>' +
        '<span class="stopdesk-main">' +
          '<span class="stopdesk-title"><strong>' + esc(carrier.name) + '</strong> <span class="stopdesk-price">— ' + esc(priceLabel) + '</span></span>' +
          '<span class="stopdesk-name">' + esc(office.name || '') + '</span>' +
          '<span class="stopdesk-address">' + esc(office.address || '') + '</span>' +
          (office.id != null ? '<span class="stopdesk-id">ID ' + esc(office.id) + '</span>' : '') +
        '</span>' +
        '<span class="mode-radio" aria-hidden="true"></span>' +
      '</button>';
    }).join('');

    $$('[data-office-index]', stopdeskList).forEach((button) => {
      button.addEventListener('click', () => selectStopDesk(Number(button.dataset.officeIndex)));
    });
  }

  function setMode(mode) {
    draft.mode = mode;
    $$('#deliveryModes [data-mode]').forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-checked', active ? 'true' : 'false');
      const card = button.closest('.delivery-card');
      if (card) card.classList.toggle('active', active);
    });

    const isStop = mode === 'stopdesk';
    addressField.hidden = isStop;
    addressInput.required = !isStop;
    stopdeskPanel.hidden = !isStop || !draft.communeId;

    if (isStop) {
      addressInput.value = '';
      if (draft.communeId) loadStopDesks();
    }

    if (draft.communeId && (!draft.homeQuote || !draft.stopQuote)) refreshQuote();
    else applyQuote();
  }

  async function loadCommunes() {
    draft.wilayaId = wilayaSelect.value;
    draft.communeId = '';
    draft.stopdeskId = '';
    draft.stopdesk = null;
    draft.quote = null;
    draft.homeQuote = null;
    draft.stopQuote = null;
    draft.stopdesks = [];
    stopdeskList.innerHTML = '';
    stopdeskPanel.hidden = true;
    stopdeskHint.textContent = '';
    homePrice.textContent = '';
    deliveryLabel.textContent = 'Choisissez votre commune';
    shippingSource.textContent = '';
    updateTotal();
    submit.disabled = true;

    if (!draft.wilayaId) {
      communeSelect.innerHTML = '<option value="">Choisissez la wilaya d’abord</option>';
      communeSelect.disabled = true;
      return;
    }
    communeSelect.innerHTML = '<option value="">Chargement des communes…</option>';
    communeSelect.disabled = true;
    try {
      const communes = await shippingCommunes(draft.wilayaId);
      communeSelect.innerHTML = '<option value="">Choisir la commune…</option>' + communes.map((commune) =>
        '<option value="' + commune.id + '">' + esc(commune.name) + '</option>').join('');
      communeSelect.disabled = false;
    } catch (error) {
      communeSelect.innerHTML = '<option value="">Erreur de chargement</option>';
      showError(error.message);
    }
  }

  async function loadStopDesks() {
    if (!draft.communeId) {
      stopdeskList.innerHTML = '';
      stopdeskPanel.hidden = true;
      stopdeskHint.textContent = '';
      return;
    }

    stopdeskPanel.hidden = draft.mode !== 'stopdesk';
    stopdeskList.innerHTML = '<div class="stopdesk-state">Chargement des bureaux…</div>';
    stopdeskHint.textContent = '';
    officeQuoteRequest += 1;

    try {
      const result = await shippingStopDesks(draft.communeId, draft.wilayaId, subtotal);
      draft.stopdesks = result.items || [];

      if (!draft.stopdesks.length) {
        stopdeskList.innerHTML = '<div class="stopdesk-state">Aucun bureau disponible pour cette commune.</div>';
        stopdeskHint.textContent = 'Choisissez la livraison à domicile pour cette commune.';
        return;
      }

      renderStopDesks();
      if (draft.stopdesks.length === 1 && !draft.stopdesk) selectStopDesk(0);
      else if (draft.stopdesk) refreshSelectedOfficeQuote();

      if (result.source === 'fallback' && draft.stopdesks[0] && draft.stopdesks[0].fallback) {
        stopdeskHint.textContent = 'Bureau indicatif local — les vrais points relais Zimou apparaîtront dès que la clé API sera configurée.';
      } else if (result.message) {
        stopdeskHint.textContent = result.message;
      }
    } catch (error) {
      stopdeskList.innerHTML = '<div class="stopdesk-state">Impossible de charger les bureaux.</div>';
      stopdeskHint.textContent = error.message;
    }
  }

  async function refreshQuote() {
    draft.homeQuote = null;
    draft.stopQuote = null;
    draft.quote = null;

    if (!draft.wilayaId || !draft.communeId) {
      applyQuote();
      return;
    }

    deliveryLabel.textContent = 'Calcul en cours…';
    shippingSource.textContent = '';
    submit.disabled = true;

    try {
      const [homeQuote, stopQuote] = await Promise.all([
        shippingQuote(draft.wilayaId, draft.communeId, 'domicile', subtotal),
        shippingQuote(draft.wilayaId, draft.communeId, 'stopdesk', subtotal, draft.stopdesk && draft.stopdesk.id)
      ]);
      draft.homeQuote = homeQuote;
      draft.stopQuote = stopQuote;
      applyQuote();
    } catch (error) {
      deliveryLabel.textContent = 'Indisponible';
      shippingSource.textContent = error.message;
      draft.quote = null;
      homePrice.textContent = '';
      updateTotal();
      submit.disabled = true;
    }
  }

  wilayaSelect.addEventListener('change', loadCommunes);
  communeSelect.addEventListener('change', async () => {
    draft.communeId = communeSelect.value;
    draft.stopdeskId = '';
    draft.stopdesk = null;
    draft.stopdesks = [];
    stopdeskList.innerHTML = '';
    stopdeskPanel.hidden = draft.mode !== 'stopdesk' || !draft.communeId;
    if (!draft.communeId) {
      await refreshQuote();
      return;
    }
    if (draft.mode === 'stopdesk') await loadStopDesks();
    await refreshQuote();
  });
  $$('#deliveryModes [data-mode]').forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.mode));
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideError();
    const firstName = firstNameInput.value.trim();
    const lastName = lastNameInput.value.trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    const phone = digits(phoneInput.value);
    const address = addressInput.value.trim();
    const notes = $('#oNotes').value.trim();

    if (!firstName) {
      showError('Votre prénom est obligatoire.');
      firstNameInput.focus();
      return;
    }
    if (!lastName) {
      showError('Votre nom est obligatoire.');
      lastNameInput.focus();
      return;
    }
    if (!validPhone(phone)) {
      setPhoneHint();
      showError('Numéro invalide : il doit commencer par 05, 06 ou 07 et contenir exactement 10 chiffres.');
      phoneInput.focus();
      return;
    }
    if (!draft.wilayaId) { showError('Choisissez votre wilaya.'); return; }
    if (!draft.communeId) { showError('Choisissez votre commune.'); return; }
    if (draft.mode === 'domicile' && !address) { showError('Votre adresse est obligatoire pour la livraison à domicile.'); addressInput.focus(); return; }
    if (draft.mode === 'stopdesk' && !draft.stopdesk) {
      showError('Choisissez un bureau de livraison.');
      return;
    }
    if (!draft.quote) { showError('Patientez pendant le calcul des frais de livraison.'); return; }

    const stopdeskId = draft.mode === 'stopdesk' && draft.stopdesk && draft.stopdesk.id != null
      ? String(draft.stopdesk.id)
      : '';

    submit.disabled = true;
    submit.textContent = 'Envoi en cours…';
    try {
      const response = await fetch(API_BASE + '/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            firstName,
            lastName,
            fullName,
            name: fullName,
            phone,
            wilayaId: Number(draft.wilayaId),
            communeId: Number(draft.communeId),
            deliveryMode: draft.mode,
            address: draft.mode === 'domicile' ? address : '',
            notes
          },
          stopdeskId,
          promoCode: draft.promo ? draft.promo.code : '',
          items: state.cart.map((item) => ({ productId: item.productId, color: item.color, size: item.size, qty: item.qty }))
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'La commande n’a pas pu être enregistrée.');

      state.cart = [];
      writeStorage('dl_cart', state.cart);
      updateBadges();
      closeCart();
      try { await loadStore(); renderAll(); } catch { /* la commande est enregistrée */ }

      const handle = state.settings.instagram || 'diamond__luxury_';
      openModal(
        '<div class="success-panel">' +
          '<div class="success-icon"><svg class="icon"><use href="#i-check"></use></svg></div>' +
          '<h2>Merci ' + esc(firstName) + ' !</h2>' +
          '<p>Votre commande est bien enregistrée. Pour la confirmer, envoyez-nous votre référence en message direct sur Instagram.</p>' +
          '<div class="order-ref-row">' +
            '<div class="order-ref">' + esc(result.ref) + '</div>' +
            '<button type="button" class="btn btn-outline btn-sm" data-copy-ref="' + esc(result.ref) + '"><svg class="icon sm"><use href="#i-copy"></use></svg> Copier la référence</button>' +
          '</div>' +
          '<div class="summary-row" style="max-width:320px;margin:0 auto 6px"><span>Total à régler</span><span style="font-weight:500;color:var(--ink)">' + formatPrice(result.total) + '</span></div>' +
          (result.discount > 0 && result.promo ? '<div class="summary-row" style="max-width:320px;margin:0 auto 20px;color:var(--gold-deep)"><span>Code ' + esc(result.promo.code) + ' (−' + result.promo.percent + '%)</span><span>−' + formatPrice(result.discount) + '</span></div>' : '<div style="height:14px"></div>') +
          '<a class="btn btn-gold" href="' + instagramDmUrl() + '" target="_blank" rel="noopener" style="width:100%"><svg class="icon sm"><use href="#i-instagram"></use></svg> CONFIRMER SUR INSTAGRAM</a>' +
          '<p class="wa-note">Le bouton ouvre notre messagerie Instagram @' + esc(handle) + '. Collez-y votre référence de commande. <a href="' + instagramUrl() + '" target="_blank" rel="noopener" style="text-decoration:underline">Voir le profil</a></p>' +
          '<button class="btn btn-outline btn-block" data-close-modal style="margin-top:12px">Continuer mes achats</button>' +
        '</div>'
      );
    } catch (error) {
      showError(error.message);
      submit.disabled = false;
      submit.textContent = 'Confirmer la commande';
    }
  });
}

/* ------------------------------ Recherche ------------------------------ */

function renderSearch(query) {
  const container = $('#searchResults');
  const q = query.trim().toLowerCase();
  if (!q) {
    const suggestions = activeProducts().filter((product) => product.featured).slice(0, 4);
    container.innerHTML = '<div class="search-hint">Nos pièces signature</div><div class="product-grid">' + productGrid(suggestions) + '</div>';
    return;
  }
  const results = activeProducts().filter((product) => {
    const category = categoryOf(product);
    return (product.name + ' ' + (product.description || '') + ' ' + (category ? category.name : '')).toLowerCase().includes(q);
  }).slice(0, 8);

  container.innerHTML = results.length
    ? '<div class="search-hint">' + results.length + ' résultat' + (results.length > 1 ? 's' : '') + '</div><div class="product-grid">' + productGrid(results) + '</div>'
    : '<div class="search-empty">Aucun résultat pour « ' + esc(query) + ' ». Essayez un autre mot-clé.</div>';
}

/* ------------------------------ Overlays ------------------------------ */

function syncBodyLock() {
  const open = $('#sideDrawer').classList.contains('open') ||
    $('#cartDrawer').classList.contains('open') ||
    $('#quickViewOverlay').classList.contains('open') ||
    $('#modalOverlay').classList.contains('open') ||
    $('#searchOverlay').classList.contains('open') ||
    $('#shopFilters').classList.contains('open');
  document.body.classList.toggle('no-scroll', open);
}

function openSideDrawer() {
  closeCart();
  $('#sideDrawer').classList.add('open');
  $('#drawerOverlay').classList.add('open');
  syncBodyLock();
}

function closeSideDrawer() {
  $('#sideDrawer').classList.remove('open');
  $('#drawerOverlay').classList.remove('open');
  $('#shopFilters').classList.remove('open');
  syncBodyLock();
}

function openCart() {
  renderCart();
  $('#cartDrawer').classList.add('open');
  $('#cartOverlay').classList.add('open');
  syncBodyLock();
}

function closeCart() {
  $('#cartDrawer').classList.remove('open');
  $('#cartOverlay').classList.remove('open');
  syncBodyLock();
}

function openModal(html) {
  $('#modalContent').innerHTML = html;
  $('#modalOverlay').classList.add('open');
  syncBodyLock();
  const field = $('#modalContent input, #modalContent textarea');
  if (field) setTimeout(() => field.focus(), 80);
}

function closeModal() {
  $('#modalOverlay').classList.remove('open');
  syncBodyLock();
}

function openSearch() {
  $('#searchOverlay').classList.add('open');
  syncBodyLock();
  renderSearch('');
  setTimeout(() => $('#searchInput').focus(), 80);
}

function closeSearch() {
  $('#searchOverlay').classList.remove('open');
  syncBodyLock();
  $('#searchInput').value = '';
}

/* ------------------------------ Routage ------------------------------ */

function showView(name) {
  $$('.view').forEach((view) => { view.hidden = true; });
  const target = $('#view-' + name);
  if (target) target.hidden = false;
  const map = { shop: 'boutique', product: 'boutique', home: 'home', about: 'histoire', contact: 'contact', wishlist: 'wishlist' };
  $$('.nav-link').forEach((link) => link.classList.remove('active'));
  const key = map[name];
  const link = key ? $('.nav-link[data-nav="' + key + '"]') : null;
  if (link) link.classList.add('active');
}

function router() {
  const raw = (location.hash || '#/').replace(/^#\/?/, '');
  const [pathPart, queryString] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const params = new URLSearchParams(queryString || '');
  const name = segments[0] || 'home';
  closeSideDrawer();
  closeCart();
  closeQuickView();
  closeModal();
  closeSearch();
  $('#shopFilters').classList.remove('open');

  if (name === 'boutique') {
    state.filters.cat = params.get('cat') || 'tout';
    state.filters.q = params.get('q') || '';
    state.filters.sort = params.get('sort') || 'new';
    showView('shop');
    renderShop(true);
  } else if (name === 'produit') {
    showView('product');
    renderProduct(decodeURIComponent(segments[1] || ''));
  } else if (name === 'favoris') {
    showView('wishlist');
    renderWishlist();
  } else if (name === 'histoire') {
    showView('about');
  } else if (name === 'contact') {
    showView('contact');
  } else {
    showView('home');
    renderHome();
    restartHeroAnimation();
  }

  $$('.nav-link').forEach((link) => link.classList.remove('active'));
  const navKey = (name === 'boutique' || name === 'produit') ? 'boutique'
    : name === 'histoire' ? 'histoire'
      : name === 'contact' ? 'contact' : '';
  if (navKey) {
    const link = $('.nav-link[data-nav="' + navKey + '"]');
    if (link) link.classList.add('active');
  }

  window.scrollTo({ top: 0, behavior: smoothTopOnRoute ? 'smooth' : 'auto' });
  smoothTopOnRoute = false;
  observeReveals();
}

function restartHeroAnimation() {
  const inner = $('#heroInner');
  if (!inner) return;
  inner.classList.remove('hero-enter');
  void inner.offsetWidth;
  inner.classList.add('hero-enter');
}

function renderAll() {
  renderChrome();
  renderHome();
  if (!$('#view-shop').hidden) renderShop();
  if (!$('#view-wishlist').hidden) renderWishlist();
  if (!$('#view-product').hidden) {
    const raw = (location.hash || '').replace(/^#\/?/, '').split('?')[0].split('/');
    if (raw[0] === 'produit') renderProduct(decodeURIComponent(raw[1] || ''));
  }
  renderCart();
}

/* ------------------------------ Reveal ------------------------------ */

function observeReveals() {
  const elements = $$('.reveal:not(.in)');
  if (!('IntersectionObserver' in window)) {
    elements.forEach((element) => element.classList.add('in'));
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  }
  elements.forEach((element) => revealObserver.observe(element));
}

/* ------------------------------ Écouteurs ------------------------------ */

function bindGlobalEvents() {
  window.addEventListener('hashchange', router);

  const brand = $('.site-header .brand');
  if (brand) {
    brand.addEventListener('click', (event) => {
      event.preventDefault();
      const onHome = !location.hash || location.hash === '#/' || location.hash === '#';
      if (onHome) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        smoothTopOnRoute = true;
        location.hash = '#/';
      }
    });
  }

  $('#openMenu').addEventListener('click', openSideDrawer);
  $('#closeMenu').addEventListener('click', closeSideDrawer);
  $('#drawerOverlay').addEventListener('click', () => {
    closeSideDrawer();
    $('#shopFilters').classList.remove('open');
    syncBodyLock();
  });

  $('#openCart').addEventListener('click', openCart);
  $('#closeCart').addEventListener('click', closeCart);
  $('#cartOverlay').addEventListener('click', closeCart);

  $('#openSearch').addEventListener('click', openSearch);
  $('#closeSearch').addEventListener('click', closeSearch);
  $('#searchInput').addEventListener('input', (event) => renderSearch(event.target.value));

  $('#modalClose').addEventListener('click', closeModal);
  $('#modalOverlay').addEventListener('click', (event) => {
    if (event.target === $('#modalOverlay')) closeModal();
  });

  $('#quickViewClose').addEventListener('click', closeQuickView);
  $('#quickViewOverlay').addEventListener('click', (event) => {
    if (event.target === $('#quickViewOverlay')) closeQuickView();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if ($('#quickViewOverlay').classList.contains('open')) return closeQuickView();
    if ($('#modalOverlay').classList.contains('open')) return closeModal();
    if ($('#searchOverlay').classList.contains('open')) return closeSearch();
    if ($('#cartDrawer').classList.contains('open')) return closeCart();
    if ($('#sideDrawer').classList.contains('open')) return closeSideDrawer();
    if ($('#shopFilters').classList.contains('open')) {
      $('#shopFilters').classList.remove('open');
      syncBodyLock();
    }
  });

  document.addEventListener('click', (event) => {
    const copy = event.target.closest('[data-copy-ref]');
    if (copy) {
      copyText(copy.dataset.copyRef).then((ok) => {
        toast(ok ? 'Référence copiée. Collez-la dans votre message Instagram.' : 'Copie impossible : sélectionnez la référence manuellement.', ok ? 'success' : 'error');
      });
      return;
    }
    const wish = event.target.closest('[data-wish]');
    if (wish) {
      event.preventDefault();
      toggleWishlist(wish.dataset.wish);
      return;
    }
    const quick = event.target.closest('[data-quick-view]');
    if (quick) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      openQuickView(quick.dataset.quickView);
      return;
    }
    if (event.target.closest('[data-go-shop]')) {
      closeCart();
      location.hash = '#/boutique';
      return;
    }
    if (event.target.closest('[data-close-modal]')) {
      closeModal();
      return;
    }
    const cartQty = event.target.closest('[data-cart-qty]');
    if (cartQty) {
      updateCartQty(Number(cartQty.dataset.cartQty), Number(cartQty.dataset.delta));
      return;
    }
    const cartRemove = event.target.closest('[data-cart-remove]');
    if (cartRemove) {
      removeCartItem(Number(cartRemove.dataset.cartRemove));
      return;
    }
    if (event.target.closest('[data-filter-reset]')) {
      resetFilters();
      return;
    }
    if (event.target.closest('[data-close-filters]')) {
      $('#shopFilters').classList.remove('open');
      $('#drawerOverlay').classList.remove('open');
      syncBodyLock();
      return;
    }
    if (event.target.closest('#openFilters')) {
      $('#shopFilters').classList.add('open');
      $('#drawerOverlay').classList.add('open');
      syncBodyLock();
      return;
    }
    const addBtn = event.target.closest('[data-add-default]');
    if (addBtn) {
      const product = productById(addBtn.dataset.addDefault);
      const variant = product && firstAvailableVariant(product);
      if (product && variant) addToCart(product, variant.color, variant.size, 1);
      return;
    }
  });

  $('#shopSort').addEventListener('change', (event) => {
    state.filters.sort = event.target.value;
    renderShop();
  });

  $('#shopFilters').addEventListener('click', (event) => {
    const color = event.target.closest('[data-filter-color]');
    if (color) {
      state.filters.color = state.filters.color === color.dataset.filterColor ? '' : color.dataset.filterColor;
      renderShop();
      return;
    }
    const size = event.target.closest('[data-filter-size]');
    if (size) {
      state.filters.size = state.filters.size === size.dataset.filterSize ? '' : size.dataset.filterSize;
      renderShop();
      return;
    }
  });

  $('#shopFilters').addEventListener('change', (event) => {
    if (event.target.matches('[data-filter-stock]')) {
      state.filters.stockOnly = event.target.checked;
      renderShop();
    }
    if (event.target.matches('[data-filter-promo]')) {
      state.filters.promoOnly = event.target.checked;
      renderShop();
    }
    if (event.target.matches('[data-price-min]')) {
      state.filters.min = event.target.value;
      renderShop();
    }
    if (event.target.matches('[data-price-max]')) {
      state.filters.max = event.target.value;
      renderShop();
    }
  });

  $('#newsletterForm').addEventListener('submit', (event) => {
    event.preventDefault();
    event.target.reset();
    toast('Merci ! Vous êtes inscrit(e) au cercle privé.');
  });

  $('#contactForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const phone = String(data.get('phone') || '').trim();
    const email = String(data.get('email') || '').trim();
    const message = String(data.get('message') || '').trim();

    if (!name || !phone || !message) {
      toast('Merci de renseigner votre nom, votre téléphone et votre message.', 'error');
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    const original = form.dataset.originalHtml || form.innerHTML;
    form.dataset.originalHtml = original;
    if (button) {
      button.disabled = true;
      button.textContent = 'Envoi en cours…';
    }

    try {
      const response = await fetch(API_BASE + '/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: name, téléphone: phone, email, message })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Votre message n’a pas pu être envoyé.');

      form.innerHTML =
        '<div class="success-panel contact-success">' +
          '<div class="success-icon"><svg class="icon"><use href="#i-check"></use></svg></div>' +
          '<h3>Merci ' + esc(name.split(' ')[0]) + ' !</h3>' +
          '<p>Votre message a bien été reçu. Notre équipe vous répondra avec attention dans les plus brefs délais.</p>' +
          '<button type="button" class="btn btn-outline btn-block" data-contact-reset>Envoyer un autre message</button>' +
        '</div>';
      form.querySelector('[data-contact-reset]').addEventListener('click', () => {
        form.innerHTML = original;
      });
    } catch (error) {
      if (button) {
        button.disabled = false;
        button.textContent = 'Envoyer le message';
      }
      toast(error.message, 'error');
    }
  });

  const header = $('#siteHeader');
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
}

/* ------------------------------ Init ------------------------------ */

async function init() {
  bindGlobalEvents();
  try {
    await loadStore();
    renderAll();
    router();
  } catch (error) {
    console.error(error);
    const main = $('#main');
    if (main) {
      main.insertAdjacentHTML('afterbegin', '<div class="container" style="padding:60px 0"><div class="empty-state"><h3>Boutique momentanément indisponible</h3><p>Vérifiez que le serveur est bien démarré, puis rechargez la page.</p></div></div>');
    }
  }
}

init();
