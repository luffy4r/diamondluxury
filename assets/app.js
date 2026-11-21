'use strict';

/* ==========================================================================
   DIAMOND LUXURY — Application vitrine
   ========================================================================== */

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? '' : 'https://dlback.onrender.com';

const IMG_FAVICON = 'https://ik.imagekit.io/diamondluxury/IMG_7659.jpeg?updatedAt=1795273467452';
const IMG_LOGO_FULL = 'https://ik.imagekit.io/diamondluxury/IMG_7657.jpeg?updatedAt=1795273315148';
const IMG_LOGO_MARK = 'https://ik.imagekit.io/diamondluxury/55f3c57d-84e5-4dcf-afd9-0db725d48fd0.webp?updatedAt=1795273627679';

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
let revealObserver = null;

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

async function shippingStopDesks(communeId) {
  const key = String(communeId);
  if (state.shipping.stopdesks.has(key)) return state.shipping.stopdesks.get(key);
  const response = await fetch(API_BASE + '/api/shipping/stopdesks?commune=' + encodeURIComponent(communeId), { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Impossible de charger les bureaux stop-desk.');
  const data = await response.json();
  const payload = { items: data.stopdesks || [], source: data.source, message: data.message || '' };
  state.shipping.stopdesks.set(key, payload);
  return payload;
}

async function shippingQuote(wilayaId, communeId, mode, subtotal) {
  const key = [wilayaId, communeId, mode, subtotal].join(':');
  if (state.shipping.quotes.has(key)) return state.shipping.quotes.get(key);
  const query = new URLSearchParams({ wilaya: wilayaId, commune: communeId, mode, subtotal: subtotal || 0 });
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

  const hero = $('#heroImage');
  const customHero = settings.heroImage && !/^data:image\/svg\+xml/i.test(settings.heroImage);
  if (hero) hero.src = customHero ? assetUrl(settings.heroImage) : IMG_LOGO_FULL;
  const availability = $('#heroAvailability');
  const total = activeProducts().reduce((sum, product) => sum + product.stock, 0);
  if (availability) availability.textContent = total > 0 ? 'Pièces en stock' : 'En rupture';

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
  if ($('#footerAddress')) $('#footerAddress').textContent = settings.address || '—';

  if ($('#contactList')) {
    $('#contactList').innerHTML =
      '<div class="contact-item"><svg class="icon"><use href="#i-instagram"></use></svg><div><small>Instagram</small><a href="' + instagramUrl() + '" target="_blank" rel="noopener">' + esc(handle) + '</a></div></div>' +
      (settings.phone ? '<div class="contact-item"><svg class="icon"><use href="#i-phone"></use></svg><div><small>Téléphone</small><a href="' + phoneUrl() + '">' + esc(settings.phone) + '</a></div></div>' : '') +
      '<div class="contact-item"><svg class="icon"><use href="#i-mail"></use></svg><div><small>Email</small><a href="mailto:' + esc(settings.email || '') + '">' + esc(settings.email || '—') + '</a></div></div>' +
      '<div class="contact-item"><svg class="icon"><use href="#i-map"></use></svg><div><small>Atelier</small><span>' + esc(settings.address || '—') + '</span></div></div>' +
      '<div class="contact-item"><svg class="icon"><use href="#i-clock"></use></svg><div><small>Horaires</small><span>Lundi – Samedi · 9h – 19h</span></div></div>';
  }

  if ($('#storyImage') && state.products.length) {
    const pick = state.products.find((product) => product.categoryId === 'cat_robes') || state.products[0];
    $('#storyImage').src = (pick.images && pick.images[0]) || IMG_LOGO_FULL;
  }

  if ($('#editorialMain')) {
    const first = state.products.find((product) => product.categoryId === 'cat_robes') || state.products[0];
    const second = state.products.find((product) => product.categoryId === 'cat_bijoux') || state.products[1];
    if (first) $('#editorialMain').src = first.images[0] || IMG_LOGO_FULL;
    if (second) $('#editorialSmall').src = second.images[0] || IMG_LOGO_FULL;
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

function productCard(product) {
  const category = categoryOf(product);
  const secondImage = product.images && product.images[1];
  const favorited = state.wishlist.includes(product.id);
  const promo = discountPercent(product);
  const badges = [];
  if (isNew(product)) badges.push('<span class="badge new">Nouveau</span>');
  if (promo) badges.push('<span class="badge promo">-' + promo + '%</span>');
  if (product.featured) badges.push('<span class="badge featured">Signature</span>');

  return '<article class="product-card">' +
    '<div class="product-media">' +
      '<a href="' + productUrl(product) + '" aria-label="Voir ' + esc(product.name) + '">' +
        '<img class="product-img" src="' + esc(product.images[0] || IMG_LOGO_FULL) + '" alt="' + esc(product.name) + '" loading="lazy">' +
        (secondImage ? '<img class="product-img alt" src="' + esc(secondImage) + '" alt="" loading="lazy" aria-hidden="true">' : '') +
      '</a>' +
      '<div class="product-badges">' + badges.join('') + (product.stock === 0 ? '<span class="badge out">En rupture</span>' : '') + '</div>' +
      '<button class="wish-btn' + (favorited ? ' active' : '') + '" data-wish="' + esc(product.id) + '" aria-label="' + (favorited ? 'Retirer des favoris' : 'Ajouter aux favoris') + '">' +
        '<svg class="icon"><use href="#i-heart"></use></svg>' +
      '</button>' +
      '<a class="product-quick" href="' + productUrl(product) + '">Découvrir la pièce</a>' +
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

function productGrid(products) {
  return products.map(productCard).join('');
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
  $('#homeProducts').innerHTML = productGrid(newest);

  const featured = activeProducts().filter((product) => product.featured).slice(0, 4);
  const fill = activeProducts().filter((product) => !product.featured).sort((a, b) => b.stock - a.stock);
  const selection = [...featured, ...fill].slice(0, 4);
  $('#featuredProducts').innerHTML = productGrid(selection);

  const images = [];
  activeProducts().forEach((product) => {
    (product.images || []).forEach((image) => {
      if (images.length < 6 && !images.includes(image)) images.push(image);
    });
  });
  state.categories.forEach((category) => {
    if (images.length < 6 && category.image && !images.includes(category.image)) images.push(category.image);
  });
  const insta = images.slice(0, 6).map((image) =>
    '<a href="' + instagramUrl() + '" target="_blank" rel="noopener" aria-label="Voir sur Instagram">' +
      '<img src="' + esc(image) + '" alt="Diamond Luxury sur Instagram" loading="lazy">' +
      '<span class="insta-ico"><svg class="icon"><use href="#i-instagram"></use></svg></span>' +
    '</a>'
  ).join('');
  $('#instaGrid').innerHTML = insta;

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

function renderShop() {
  const category = state.categories.find((entry) => entry.slug === state.filters.cat);
  $('#shopTitle').textContent = category ? category.name : 'La boutique';
  $('#shopSubtitle').textContent = category ? category.description : 'Toutes les pièces de la maison, réunies avec soin.';
  $('#shopSort').value = state.filters.sort;
  renderFilters();

  const list = filteredProducts();
  $('#shopCount').innerHTML = '<strong>' + list.length + '</strong> article' + (list.length > 1 ? 's' : '');
  $('#shopGrid').innerHTML = list.length
    ? productGrid(list)
    : emptyState('Aucun article trouvé', 'Essayez d’élargir vos filtres ou de parcourir une autre catégorie.', 'Réinitialiser les filtres', '#/boutique');
}

function resetFilters() {
  state.filters = { cat: 'tout', q: '', sort: 'new', stockOnly: false, promoOnly: false, color: '', size: '', min: '', max: '' };
  if (location.hash !== '#/boutique') {
    location.hash = '#/boutique';
  } else {
    renderShop();
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
          '<button class="btn btn-gold" id="addToCart">Ajouter au panier</button>' +
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
            '<div class="accordion-body"><ul><li>Livraison dans les 58 wilayas sous 2 à 5 jours ouvrés.</li><li>Paiement à la livraison, après vérification de votre pièce.</li><li>Frais calculés selon votre wilaya et le mode choisi (domicile ou stop-desk)' + (state.settings.freeShippingFrom > 0 ? ' — offerts dès ' + formatPrice(state.settings.freeShippingFrom) + ' d’achat.' : '.') + '</li></ul></div>' +
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
    if (button.disabled) return;
    button.addEventListener('click', () => {
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
    addToCart(product, productView.color, productView.size, productView.qty);
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
    add.textContent = available ? 'Ajouter au panier' : 'En rupture';
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
    quote: null,
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
        '<div class="field"><label for="oName">Nom complet *</label><input id="oName" name="name" required autocomplete="name" placeholder="Prénom et nom"></div>' +
        '<div class="field"><label for="oPhone">Téléphone *</label><input id="oPhone" name="phone" required inputmode="numeric" maxlength="17" autocomplete="tel" placeholder="05 55 00 00 00"><span class="field-hint" id="phoneHint"></span></div>' +
        '<div class="field"><label for="oWilaya">Wilaya *</label><select id="oWilaya" name="wilaya" required>' + wilayaOptions + '</select></div>' +
        '<div class="field"><label for="oCommune">Commune *</label><select id="oCommune" name="commune" required disabled><option value="">Choisissez la wilaya d’abord</option></select></div>' +
        '<div class="field full"><label>Mode de livraison *</label>' +
          '<div class="delivery-modes" id="deliveryModes">' +
            '<button type="button" class="delivery-mode active" data-mode="domicile"><svg class="icon sm"><use href="#i-truck"></use></svg> Livraison à domicile</button>' +
            '<button type="button" class="delivery-mode" data-mode="stopdesk"><svg class="icon sm"><use href="#i-map"></use></svg> Retrait en stop-desk</button>' +
          '</div>' +
        '</div>' +
        '<div class="field full" id="addressField"><label for="oAddress">Adresse *</label><input id="oAddress" name="address" autocomplete="street-address" placeholder="Cité, rue, numéro, repère…"></div>' +
        '<div class="field full" id="stopdeskField" hidden><label for="oStopdesk">Bureau stop-desk *</label><select id="oStopdesk" disabled><option value="">Choisissez une commune</option></select><span class="field-hint" id="stopdeskHint"></span></div>' +
        '<div class="field full"><label for="oNotes">Note (facultatif)</label><textarea id="oNotes" name="notes" rows="2" placeholder="Repère, préférence de livraison…"></textarea></div>' +
      '</div>' +
      '<div class="checkout-summary">' +
        lines.map((line) =>
          '<div class="summary-row"><span>' + esc(line.product.name) + ' × ' + line.qty + ' <small style="color:var(--muted)">(' + esc(line.color) + ' · ' + esc(variantMeta(line.product).label) + ' ' + esc(line.size) + ')</small></span><span>' + formatPrice(line.product.price * line.qty) + '</span></div>'
        ).join('') +
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
  const wilayaSelect = $('#oWilaya');
  const communeSelect = $('#oCommune');
  const stopdeskField = $('#stopdeskField');
  const stopdeskSelect = $('#oStopdesk');
  const stopdeskHint = $('#stopdeskHint');
  const addressField = $('#addressField');
  const addressInput = $('#oAddress');
  const phoneInput = $('#oPhone');
  const phoneHint = $('#phoneHint');
  const deliveryLabel = $('#checkoutDelivery');
  const totalLabel = $('#checkoutTotal');
  const shippingSource = $('#shippingSource');
  const submit = $('#checkoutSubmit');
  const errorBox = $('#checkoutError');

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

  function updateTotal() {
    const delivery = draft.quote ? draft.quote.price : null;
    totalLabel.textContent = formatPrice(subtotal + (delivery || 0));
  }

  function setMode(mode) {
    draft.mode = mode;
    $$('#deliveryModes [data-mode]').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
    const isStop = mode === 'stopdesk';
    addressField.hidden = isStop;
    addressInput.required = !isStop;
    stopdeskField.hidden = !isStop;
    if (isStop) {
      addressInput.value = '';
      loadStopDesks();
    } else {
      draft.stopdeskId = '';
    }
    refreshQuote();
  }

  async function loadCommunes() {
    draft.wilayaId = wilayaSelect.value;
    draft.communeId = '';
    draft.stopdeskId = '';
    draft.quote = null;
    draft.stopdesks = [];
    stopdeskSelect.innerHTML = '<option value="">Choisissez une commune</option>';
    stopdeskSelect.disabled = true;
    stopdeskHint.textContent = '';
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
      stopdeskSelect.innerHTML = '<option value="">Choisissez une commune</option>';
      stopdeskSelect.disabled = true;
      stopdeskHint.textContent = '';
      return;
    }
    stopdeskSelect.innerHTML = '<option value="">Chargement des bureaux…</option>';
    stopdeskSelect.disabled = true;
    stopdeskHint.textContent = '';
    try {
      const result = await shippingStopDesks(draft.communeId);
      draft.stopdesks = result.items || [];
      if (!draft.stopdesks.length) {
        stopdeskSelect.innerHTML = '<option value="">Aucun bureau disponible</option>';
        stopdeskHint.textContent = 'Aucun bureau n’est disponible pour cette commune. Choisissez la livraison à domicile.';
        return;
      }
      stopdeskSelect.innerHTML = '<option value="">Choisir un bureau…</option>' + draft.stopdesks.map((office) =>
        '<option value="' + (office.id == null ? '' : office.id) + '">' + esc(office.name) + ' — ' + esc(office.address) + '</option>').join('');
      stopdeskSelect.disabled = false;
      if (draft.stopdesks.length === 1) {
        const only = draft.stopdesks[0];
        stopdeskSelect.value = only.id == null ? '' : String(only.id);
        draft.stopdeskId = only.id == null ? '' : String(only.id);
      }
      if (result.source === 'fallback' && draft.stopdesks[0] && draft.stopdesks[0].fallback) {
        stopdeskHint.textContent = 'Bureau indicatif local — les vrais points relais Zimou apparaîtront dès que la clé API sera configurée.';
      } else if (result.message) {
        stopdeskHint.textContent = result.message;
      }
    } catch (error) {
      stopdeskSelect.innerHTML = '<option value="">Erreur de chargement</option>';
      stopdeskHint.textContent = error.message;
    }
  }

  async function refreshQuote() {
    draft.quote = null;
    if (!draft.wilayaId || !draft.communeId) {
      deliveryLabel.textContent = draft.wilayaId ? 'Choisissez votre commune' : 'Choisissez votre wilaya';
      shippingSource.textContent = '';
      updateTotal();
      submit.disabled = true;
      return;
    }
    deliveryLabel.textContent = 'Calcul en cours…';
    shippingSource.textContent = '';
    submit.disabled = true;
    try {
      const quote = await shippingQuote(draft.wilayaId, draft.communeId, draft.mode, subtotal);
      draft.quote = quote;
      deliveryLabel.textContent = quote.price === 0 ? 'Offerte' : formatPrice(quote.price);
      if (quote.price === 0 && quote.basePrice > 0) {
        shippingSource.textContent = 'Livraison offerte : votre panier dépasse ' + formatPrice(quote.freeShippingFrom) + '.';
      } else if (quote.source === 'zimou') {
        shippingSource.textContent = 'Tarif Zimou Express · ' + (quote.label || (draft.mode === 'stopdesk' ? 'Point relais' : 'Domicile'));
      } else {
        shippingSource.textContent = 'Tarif indicatif · Zimou Express sera utilisé dès que la clé API sera configurée.';
      }
      updateTotal();
      submit.disabled = !draft.quote;
    } catch (error) {
      deliveryLabel.textContent = 'Indisponible';
      shippingSource.textContent = error.message;
      updateTotal();
      submit.disabled = true;
    }
  }

  wilayaSelect.addEventListener('change', loadCommunes);
  communeSelect.addEventListener('change', async () => {
    draft.communeId = communeSelect.value;
    draft.stopdeskId = '';
    if (draft.mode === 'stopdesk') await loadStopDesks();
    await refreshQuote();
  });
  stopdeskSelect.addEventListener('change', () => {
    draft.stopdeskId = stopdeskSelect.value;
  });
  $$('#deliveryModes [data-mode]').forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.mode));
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideError();
    const name = $('#oName').value.trim();
    const phone = digits(phoneInput.value);
    const address = addressInput.value.trim();
    const notes = $('#oNotes').value.trim();

    if (!name) { showError('Votre nom complet est obligatoire.'); return; }
    if (!validPhone(phone)) {
      setPhoneHint();
      showError('Numéro invalide : il doit commencer par 05, 06 ou 07 et contenir exactement 10 chiffres.');
      phoneInput.focus();
      return;
    }
    if (!draft.wilayaId) { showError('Choisissez votre wilaya.'); return; }
    if (!draft.communeId) { showError('Choisissez votre commune.'); return; }
    if (draft.mode === 'domicile' && !address) { showError('Votre adresse est obligatoire pour la livraison à domicile.'); addressInput.focus(); return; }
    if (draft.mode === 'stopdesk' && !draft.stopdeskId && !draft.stopdesks.length) {
      showError('Choisissez un bureau stop-desk.');
      return;
    }
    if (!draft.quote) { showError('Patientez pendant le calcul des frais de livraison.'); return; }

    const stopdeskId = draft.stopdeskId || (draft.stopdesks[0] ? (draft.stopdesks[0].id == null ? '' : String(draft.stopdesks[0].id)) : '');

    submit.disabled = true;
    submit.textContent = 'Envoi en cours…';
    try {
      const response = await fetch(API_BASE + '/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            name,
            phone,
            wilayaId: Number(draft.wilayaId),
            communeId: Number(draft.communeId),
            deliveryMode: draft.mode,
            address: draft.mode === 'domicile' ? address : '',
            notes
          },
          stopdeskId,
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
          '<h2>Merci ' + esc(name.split(' ')[0]) + ' !</h2>' +
          '<p>Votre commande est bien enregistrée. Pour la confirmer, envoyez-nous votre référence en message direct sur Instagram.</p>' +
          '<div class="order-ref-row">' +
            '<div class="order-ref">' + esc(result.ref) + '</div>' +
            '<button type="button" class="btn btn-outline btn-sm" data-copy-ref="' + esc(result.ref) + '"><svg class="icon sm"><use href="#i-copy"></use></svg> Copier la référence</button>' +
          '</div>' +
          '<div class="summary-row" style="max-width:320px;margin:0 auto 20px"><span>Total à régler</span><span style="font-weight:500;color:var(--ink)">' + formatPrice(result.total) + '</span></div>' +
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
  const link = $('.nav-link[data-nav="' + key + '"]');
  if (link) link.classList.add('active');
  if (name === 'shop' && state.filters.sort === 'new') {
    const newLink = $('.nav-link[data-nav="new"]');
    if (newLink) { $('#shopTitle'); }
  }
}

function router() {
  const raw = (location.hash || '#/').replace(/^#\/?/, '');
  const [pathPart, queryString] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const params = new URLSearchParams(queryString || '');
  const name = segments[0] || 'home';
  closeSideDrawer();
  closeCart();
  closeModal();
  closeSearch();
  $('#shopFilters').classList.remove('open');

  if (name === 'boutique') {
    state.filters.cat = params.get('cat') || 'tout';
    state.filters.q = params.get('q') || '';
    state.filters.sort = params.get('sort') || 'new';
    showView('shop');
    renderShop();
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
  }

  $$('.nav-link').forEach((link) => link.classList.remove('active'));
  if (name === 'boutique' && state.filters.sort === 'new') {
    const link = $('.nav-link[data-nav="new"]');
    if (link) link.classList.add('active');
  } else if (name === 'boutique' || name === 'produit') {
    const link = $('.nav-link[data-nav="boutique"]');
    if (link) link.classList.add('active');
  } else if (name === 'histoire') {
    const link = $('.nav-link[data-nav="histoire"]');
    if (link) link.classList.add('active');
  } else if (name === 'contact') {
    const link = $('.nav-link[data-nav="contact"]');
    if (link) link.classList.add('active');
  }

  window.scrollTo({ top: 0, behavior: 'auto' });
  observeReveals();
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

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
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

  $('#contactForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    const name = String(data.get('name') || '');
    const phone = String(data.get('phone') || '');
    const email = String(data.get('email') || '');
    const message = String(data.get('message') || '');
    const text = 'Bonjour Diamond Luxury,\n\n' + message + '\n\n— ' + name + '\nTéléphone : ' + phone + (email ? '\nEmail : ' + email : '');
    window.open(instagramDmUrl(), '_blank', 'noopener');
    copyText(text).then((ok) => {
      toast(ok ? 'Message copié. Collez-le dans votre DM Instagram.' : 'Ouvrez Instagram pour nous envoyer votre message.', ok ? 'success' : 'error');
    });
    form.reset();
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
