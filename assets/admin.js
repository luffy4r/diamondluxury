'use strict';

/* ==========================================================================
   DIAMOND LUXURY — Dashboard
   ========================================================================== */

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? '' : 'https://dlback.onrender.com';
const API_CREDENTIALS = API_BASE ? 'include' : 'same-origin';

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

const admin = {
  data: null,
  section: 'dashboard',
  productSearch: '',
  productCategory: 'all',
  productStatus: 'all',
  orderFilter: 'all',
  productDraft: null,
  categoryDraft: null,
  orderDraft: null,
  orderDraft: null,
  heroDraft: '',
  saving: false,
  shipping: {
    wilayas: null,
    communes: new Map(),
    stopdesks: new Map(),
    quotes: new Map()
  }
};

const VARIANT_TYPES = {
  taille: {
    label: 'Taille',
    plural: 'Tailles',
    hint: 'S, M, L, XL…',
    placeholder: 'Ex : M',
    matrix: 'Couleur / Taille',
    empty: 'Ajoutez au moins une taille (ou gardez « Taille unique »).'
  },
  format: {
    label: 'Format',
    plural: 'Formats',
    hint: '50 ml, 100 ml, Standard…',
    placeholder: 'Ex : 50 ml',
    matrix: 'Couleur / Format',
    empty: 'Ajoutez au moins un format (ou gardez « Taille unique »).'
  },
  pointure: {
    label: 'Pointure',
    plural: 'Pointures',
    hint: '37, 38, 39, 40…',
    placeholder: 'Ex : 38',
    matrix: 'Couleur / Pointure',
    empty: 'Ajoutez au moins une pointure.'
  }
};

function variantInfo(type) {
  return VARIANT_TYPES[type] || VARIANT_TYPES.taille;
}

const STATUSES = ['nouvelle', 'confirmée', 'expédiée', 'livrée', 'annulée'];

/* ------------------------------ Helpers ------------------------------ */

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function money(value) {
  const currency = admin.data ? admin.data.settings.currency : 'DA';
  return new Intl.NumberFormat('fr-FR').format(Number(value) || 0) + ' ' + currency;
}

function shortDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
}

function dateTime(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return 'il y a ' + minutes + ' min';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return 'il y a ' + hours + ' h';
  const days = Math.floor(hours / 24);
  if (days < 30) return 'il y a ' + days + ' j';
  return shortDate(iso);
}

function toast(message, type = 'success') {
  const stack = $('#adminToasts');
  const node = document.createElement('div');
  node.className = 'admin-toast' + (type === 'error' ? ' error' : '');
  node.innerHTML = '<svg class="icon"><use href="#' + (type === 'error' ? 'a-alert' : 'a-check') + '"></use></svg><span>' + esc(message) + '</span>';
  stack.appendChild(node);
  setTimeout(() => {
    node.classList.add('out');
    setTimeout(() => node.remove(), 300);
  }, 3800);
}

function statusBadge(status) {
  return '<span class="status-badge ' + esc(status) + '">' + esc(status) + '</span>';
}

function stockBadge(stock) {
  if (stock === 0) return '<span class="stock-badge out">En rupture</span>';
  return '';
}

function productStock(product) {
  return (product.variants || []).reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0);
}

function categoryName(id) {
  const category = admin.data.categories.find((entry) => entry.id === id);
  return category ? category.name : '—';
}

/* ------------------------------ Livraison ------------------------------ */

async function shippingWilayas() {
  if (admin.shipping.wilayas) return admin.shipping.wilayas;
  const response = await fetch(API_BASE + '/api/shipping/wilayas', { credentials: API_CREDENTIALS, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Impossible de charger les wilayas.');
  const data = await response.json();
  admin.shipping.wilayas = data.wilayas || [];
  return admin.shipping.wilayas;
}

async function shippingCommunes(wilayaId) {
  const key = String(wilayaId);
  if (admin.shipping.communes.has(key)) return admin.shipping.communes.get(key);
  const response = await fetch(API_BASE + '/api/shipping/communes?wilaya=' + encodeURIComponent(wilayaId), { credentials: API_CREDENTIALS, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Impossible de charger les communes.');
  const data = await response.json();
  admin.shipping.communes.set(key, data.communes || []);
  return data.communes || [];
}

async function shippingStopDesks(communeId) {
  const key = String(communeId);
  if (admin.shipping.stopdesks.has(key)) return admin.shipping.stopdesks.get(key);
  const response = await fetch(API_BASE + '/api/shipping/stopdesks?commune=' + encodeURIComponent(communeId), { credentials: API_CREDENTIALS, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Impossible de charger les bureaux stop-desk.');
  const data = await response.json();
  const payload = { items: data.stopdesks || [], source: data.source, message: data.message || '' };
  admin.shipping.stopdesks.set(key, payload);
  return payload;
}

async function shippingQuote(wilayaId, communeId, mode, subtotal) {
  const key = [wilayaId, communeId, mode, subtotal].join(':');
  if (admin.shipping.quotes.has(key)) return admin.shipping.quotes.get(key);
  const query = new URLSearchParams({ wilaya: wilayaId, commune: communeId, mode, subtotal: subtotal || 0 });
  const response = await fetch(API_BASE + '/api/shipping/quote?' + query.toString(), { credentials: API_CREDENTIALS, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Impossible de calculer les frais de livraison.');
  const data = await response.json();
  admin.shipping.quotes.set(key, data);
  return data;
}

async function copyValue(value) {
  try {
    await navigator.clipboard.writeText(String(value));
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = String(value);
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
}

/* ------------------------------ API ------------------------------ */

async function api(path, options = {}) {
  const settings = {
    credentials: API_CREDENTIALS,
    headers: { Accept: 'application/json' },
    ...options
  };
  if (options.body && !settings.headers['Content-Type']) {
    settings.headers = { ...settings.headers, 'Content-Type': 'application/json' };
  }
  const response = await fetch(API_BASE + path, settings);
  if (response.status === 401) {
    showLogin();
    throw new Error('Session expirée, reconnectez-vous.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Une erreur est survenue.');
  return data;
}

async function loadData() {
  admin.data = await api('/api/admin/bootstrap');
  admin.heroDraft = admin.data.settings.heroImage || '';
  updateSidebar();
  render();
}

async function refresh(message) {
  try {
    await loadData();
    if (message) toast(message);
  } catch (error) {
    toast(error.message, 'error');
  }
}

/* ------------------------------ Auth ------------------------------ */

function showLogin() {
  $('#appView').hidden = true;
  $('#loginView').hidden = false;
  closeModal();
  document.body.style.overflow = '';
}

function showApp() {
  $('#loginView').hidden = true;
  $('#appView').hidden = false;
}

async function boot() {
  $('#loginYear').textContent = new Date().getFullYear();
  try {
    const session = await fetch(API_BASE + '/api/admin/session', { credentials: API_CREDENTIALS }).then((response) => response.json());
    if (session.authenticated) {
      showApp();
      await loadData();
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
}

/* ------------------------------ Overlays ------------------------------ */

function openModal(html, wide = false) {
  $('#adminModalContent').innerHTML = html;
  $('#adminModal').classList.toggle('wide', wide);
  $('#adminModalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  $('#adminModal').scrollTop = 0;
}

function closeModal() {
  $('#adminModalOverlay').classList.remove('open');
  document.body.style.overflow = '';
  $('#adminModal').classList.remove('wide');
  $('#adminModalContent').innerHTML = '';
}

function openSidebar() {
  $('#sidebar').classList.add('open');
  $('#sidebarOverlay').classList.add('open');
}

function closeSidebar() {
  $('#sidebar').classList.remove('open');
  $('#sidebarOverlay').classList.remove('open');
}

/* ------------------------------ Navigation ------------------------------ */

const SECTION_META = {
  dashboard: ['Tableau de bord', 'Vue d’ensemble de votre maison.'],
  products: ['Articles', 'Gérez votre catalogue, les variantes et le stock.'],
  categories: ['Catégories', 'Organisez les univers de la boutique.'],
  orders: ['Commandes', 'Suivez et traitez les commandes reçues.'],
  settings: ['Réglages', 'Identité, livraison et sécurité.']
};

function setSection(section) {
  admin.section = section;
  closeSidebar();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateSidebar() {
  const newOrders = admin.data ? admin.data.stats.newOrders : 0;
  const pill = $('#sideOrdersCount');
  pill.textContent = newOrders;
  pill.hidden = newOrders === 0;
  $$('.side-link[data-section]').forEach((link) => link.classList.toggle('active', link.dataset.section === admin.section));
}

function render() {
  if (!admin.data) return;
  updateSidebar();
  const meta = SECTION_META[admin.section] || SECTION_META.dashboard;
  $('#pageTitle').textContent = meta[0];
  $('#pageSubtitle').textContent = meta[1];

  if (admin.section === 'dashboard') renderDashboard();
  else if (admin.section === 'products') renderProducts();
  else if (admin.section === 'categories') renderCategories();
  else if (admin.section === 'orders') renderOrders();
  else if (admin.section === 'settings') renderSettings();
}

/* ------------------------------ Dashboard ------------------------------ */

function renderDashboard() {
  const data = admin.data;
  const stats = data.stats;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const today = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  const recentOrders = data.orders.slice(0, 6);
  const alerts = data.products
    .filter((product) => product.stock === 0)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 6);

  const categoryStats = data.categories.map((category) => {
    const products = data.products.filter((product) => product.categoryId === category.id);
    return {
      ...category,
      products: products.length,
      stock: products.reduce((sum, product) => sum + product.stock, 0)
    };
  });
  const maxStock = Math.max(1, ...categoryStats.map((category) => category.stock));

  $('#adminContent').innerHTML =
    '<div class="page-greeting">' +
      '<div><h2>' + greeting + ', <em style="font-style:italic;color:var(--gold-deep)">Diamond</em></h2>' +
      '<p>Voici ce qui se passe dans votre maison aujourd’hui.</p></div>' +
      '<div class="date-chip">' + esc(today) + '</div>' +
    '</div>' +

    (stats.newOrders > 0
      ? '<div class="panel" style="margin-bottom:20px;border-color:#e6d5a9;background:#fffdf7"><div class="panel-body" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">' +
          '<svg class="icon" style="color:var(--gold-deep)"><use href="#a-alert"></use></svg>' +
          '<span style="flex:1;font-size:12.5px;color:var(--ink)"><strong style="font-weight:500">' + stats.newOrders + ' nouvelle' + (stats.newOrders > 1 ? 's' : '') + ' commande' + (stats.newOrders > 1 ? 's' : '') + '</strong> à traiter.</span>' +
          '<button class="btn btn-gold btn-sm" data-go-orders>Voir les commandes</button>' +
        '</div></div>'
      : '') +

    '<div class="stat-grid">' +
      '<div class="stat-card"><div class="stat-top"><div><div class="stat-label">Chiffre d’affaires</div><div class="stat-value">' + money(stats.revenue) + '</div></div><div class="stat-icon"><svg class="icon"><use href="#a-tag"></use></svg></div></div><div class="stat-foot">Commandes confirmées et livrées</div></div>' +
      '<div class="stat-card"><div class="stat-top"><div><div class="stat-label">Commandes</div><div class="stat-value">' + stats.orders + '</div></div><div class="stat-icon"><svg class="icon"><use href="#a-receipt"></use></svg></div></div><div class="stat-foot"><strong>' + stats.newOrders + '</strong> nouvelle' + (stats.newOrders > 1 ? 's' : '') + ' · ' + stats.soldItems + ' article' + (stats.soldItems > 1 ? 's' : '') + ' vendu' + (stats.soldItems > 1 ? 's' : '') + '</div></div>' +
      '<div class="stat-card"><div class="stat-top"><div><div class="stat-label">Articles en ligne</div><div class="stat-value">' + stats.activeProducts + '</div></div><div class="stat-icon"><svg class="icon"><use href="#a-box"></use></svg></div></div><div class="stat-foot">' + stats.products + ' article' + (stats.products > 1 ? 's' : '') + ' au total</div></div>' +
      '<div class="stat-card"><div class="stat-top"><div><div class="stat-label">Ruptures</div><div class="stat-value">' + (stats.outOfStock > 0 ? 'En rupture' : 'Aucune') + '</div></div><div class="stat-icon"><svg class="icon"><use href="#a-diamond"></use></svg></div></div><div class="stat-foot">' + (stats.outOfStock > 0 ? 'Articles à réassortir' : 'Tous les articles sont disponibles') + '</div></div>' +
    '</div>' +

    '<div class="dash-grid">' +
      '<div class="dash-stack">' +
        '<div class="panel">' +
          '<div class="panel-head"><div><h3>Dernières commandes</h3><div class="panel-sub">Les commandes les plus récentes</div></div><button class="panel-link" data-go-orders>Tout voir <svg class="icon sm"><use href="#a-chevron"></use></svg></button></div>' +
          '<div class="panel-body flush"><div class="table-wrap">' +
            (recentOrders.length
              ? '<table class="data-table"><thead><tr><th>Référence</th><th>Client</th><th>Date</th><th>Total</th><th>Statut</th><th></th></tr></thead><tbody>' +
                recentOrders.map((order) =>
                  '<tr><td class="table-nowrap"><strong style="font-weight:500;color:var(--ink)">' + esc(order.ref) + '</strong></td>' +
                  '<td class="order-customer"><strong>' + esc(order.customer.name) + '</strong><small>' + esc(order.customer.phone) + '</small></td>' +
                  '<td class="table-muted table-nowrap">' + timeAgo(order.createdAt) + '</td>' +
                  '<td class="num">' + money(order.total) + '</td>' +
                  '<td>' + statusBadge(order.status) + '</td>' +
                  '<td class="num"><button class="row-btn" data-view-order="' + esc(order.id) + '" aria-label="Voir la commande"><svg class="icon"><use href="#a-eye"></use></svg></button></td></tr>'
                ).join('') + '</tbody></table>'
              : '<div class="admin-empty" style="padding:36px"><p style="margin:0">Aucune commande pour le moment.</p></div>') +
          '</div></div>' +
        '</div>' +

        '<div class="panel">' +
          '<div class="panel-head"><div><h3>Stock par univers</h3><div class="panel-sub">Répartition de vos pièces disponibles</div></div></div>' +
          '<div class="panel-body"><div class="category-bars">' +
            categoryStats.map((category) =>
              '<div><div class="category-bar-top"><span>' + esc(category.name) + '</span><span>' + category.products + ' article' + (category.products > 1 ? 's' : '') + '</span></div>' +
              '<div class="category-bar-track"><div class="category-bar-fill" style="width:' + Math.max(3, Math.round((category.stock / maxStock) * 100)) + '%"></div></div></div>'
            ).join('') +
          '</div></div>' +
        '</div>' +
      '</div>' +

      '<div class="dash-stack">' +
        '<div class="panel">' +
          '<div class="panel-head"><div><h3>Articles en rupture</h3><div class="panel-sub">Pièces à réassortir</div></div><button class="panel-link" data-go-products>Tout voir</button></div>' +
          '<div class="panel-body">' +
            (alerts.length
              ? '<div class="alert-list">' + alerts.map((product) =>
                  '<div class="alert-row"><img src="' + esc(assetUrl(product.images[0] || IMG_LOGO_FULL)) + '" alt="">' +
                  '<div class="alert-info"><strong>' + esc(product.name) + '</strong><small>' + stockBadge(product.stock).replace(/<\/?span[^>]*>/g, '') + ' · ' + esc(categoryName(product.categoryId)) + '</small></div>' +
                  '<button class="btn btn-outline" data-edit-product="' + esc(product.id) + '">Gérer</button></div>'
                ).join('') + '</div>'
              : '<div class="admin-empty" style="padding:26px 10px"><svg class="icon"><use href="#a-check"></use></svg><p style="margin:0;font-size:12px">Tous vos articles sont disponibles.</p></div>') +
          '</div>' +
        '</div>' +

        '<div class="panel">' +
          '<div class="panel-head"><div><h3>Actions rapides</h3><div class="panel-sub">Les gestes du quotidien</div></div></div>' +
          '<div class="panel-body"><div class="quick-actions">' +
            '<button class="quick-action" data-quick-add-product><svg class="icon"><use href="#a-plus"></use></svg><strong>Ajouter un article</strong><small>Photos, tailles et stock</small></button>' +
            '<button class="quick-action" data-quick-add-category><svg class="icon"><use href="#a-folder"></use></svg><strong>Nouvelle catégorie</strong><small>Organiser la boutique</small></button>' +
            '<button class="quick-action" data-go-orders><svg class="icon"><use href="#a-receipt"></use></svg><strong>Commandes</strong><small>Suivre les livraisons</small></button>' +
            '<button class="quick-action" data-go-settings><svg class="icon"><use href="#a-settings"></use></svg><strong>Réglages</strong><small>Instagram et livraison</small></button>' +
          '</div></div>' +
        '</div>' +
      '</div>' +
    '</div>';
}

/* ------------------------------ Produits ------------------------------ */

function filteredAdminProducts() {
  let products = admin.data.products;
  if (admin.productSearch) {
    const query = admin.productSearch.toLowerCase();
    products = products.filter((product) => (product.name + ' ' + categoryName(product.categoryId)).toLowerCase().includes(query));
  }
  if (admin.productCategory !== 'all') {
    products = products.filter((product) => product.categoryId === admin.productCategory);
  }
  if (admin.productStatus === 'active') products = products.filter((product) => product.active);
  if (admin.productStatus === 'inactive') products = products.filter((product) => !product.active);
  if (admin.productStatus === 'low') products = products.filter((product) => product.stock > 0 && product.stock <= 3);
  if (admin.productStatus === 'out') products = products.filter((product) => product.stock === 0);
  return products;
}

function renderProducts() {
  const products = filteredAdminProducts();

  $('#adminContent').innerHTML =
    '<div class="admin-toolbar">' +
      '<div class="admin-toolbar-left">' +
        '<div class="search-field"><svg class="icon sm"><use href="#a-search"></use></svg><input id="productSearch" type="search" placeholder="Rechercher un article…" value="' + esc(admin.productSearch) + '"></div>' +
        '<select class="admin-select" id="productCategoryFilter" aria-label="Filtrer par catégorie"><option value="all">Toutes les catégories</option>' +
          admin.data.categories.map((category) => '<option value="' + esc(category.id) + '"' + (admin.productCategory === category.id ? ' selected' : '') + '>' + esc(category.name) + '</option>').join('') +
        '</select>' +
        '<select class="admin-select" id="productStatusFilter" aria-label="Filtrer par statut">' +
          '<option value="all"' + (admin.productStatus === 'all' ? ' selected' : '') + '>Tous les statuts</option>' +
          '<option value="active"' + (admin.productStatus === 'active' ? ' selected' : '') + '>En ligne</option>' +
          '<option value="inactive"' + (admin.productStatus === 'inactive' ? ' selected' : '') + '>Masqués</option>' +
          '<option value="low"' + (admin.productStatus === 'low' ? ' selected' : '') + '>Stock faible</option>' +
          '<option value="out"' + (admin.productStatus === 'out' ? ' selected' : '') + '>En rupture</option>' +
        '</select>' +
      '</div>' +
      '<div class="admin-toolbar-right">' +
        '<span style="font-size:10.5px;color:var(--muted)">' + products.length + ' article' + (products.length > 1 ? 's' : '') + '</span>' +
        '<button class="btn btn-gold btn-sm" data-quick-add-product><svg class="icon sm"><use href="#a-plus"></use></svg> Nouvel article</button>' +
      '</div>' +
    '</div>' +

    '<div class="panel"><div class="table-wrap">' +
      (products.length
        ? '<table class="data-table"><thead><tr><th>Article</th><th>Catégorie</th><th>Prix</th><th>Stock</th><th>Variantes</th><th>En ligne</th><th></th></tr></thead><tbody>' +
          products.map((product) =>
            '<tr>' +
              '<td><div class="table-product"><img src="' + esc(assetUrl(product.images[0] || IMG_LOGO_FULL)) + '" alt=""><div><strong>' + esc(product.name) + '</strong><small>' + (product.comparePrice > product.price ? '<span style="color:var(--red)">Promo</span> · ' : '') + (product.featured ? 'Signature' : 'Réf. ' + esc(product.id.slice(-6))) + '</small></div></div></td>' +
              '<td class="table-muted">' + esc(categoryName(product.categoryId)) + '</td>' +
              '<td class="table-nowrap">' + money(product.price) + (product.comparePrice > product.price ? '<br><small class="table-muted" style="text-decoration:line-through">' + money(product.comparePrice) + '</small>' : '') + '</td>' +
              '<td>' + stockBadge(product.stock) + '</td>' +
              '<td class="table-muted table-nowrap">' + product.colors.length + ' couleur' + (product.colors.length > 1 ? 's' : '') + '<br>' + product.sizes.length + ' ' + variantInfo(product.variantType || 'taille').label.toLowerCase() + (product.sizes.length > 1 ? 's' : '') + '</td>' +
              '<td><label class="switch" title="Afficher ou masquer"><input type="checkbox" data-product-active="' + esc(product.id) + '"' + (product.active ? ' checked' : '') + '><span></span></label></td>' +
              '<td><div class="row-actions">' +
                '<button class="row-btn" data-edit-product="' + esc(product.id) + '" aria-label="Modifier" title="Modifier"><svg class="icon"><use href="#a-edit"></use></svg></button>' +
                '<button class="row-btn" data-duplicate-product="' + esc(product.id) + '" aria-label="Dupliquer" title="Dupliquer"><svg class="icon"><use href="#a-copy"></use></svg></button>' +
                '<button class="row-btn danger" data-delete-product="' + esc(product.id) + '" aria-label="Supprimer" title="Supprimer"><svg class="icon"><use href="#a-trash"></use></svg></button>' +
              '</div></td>' +
            '</tr>'
          ).join('') + '</tbody></table>'
        : '<div class="admin-empty"><svg class="icon"><use href="#a-box"></use></svg><h3>Aucun article</h3><p>Ajoutez votre première pièce ou modifiez vos filtres.</p><button class="btn btn-gold" data-quick-add-product>Ajouter un article</button></div>') +
    '</div></div>';
}

/* ------------------------------ Formulaire produit ------------------------------ */

function productDraftFrom(product) {
  const draft = {
    id: product ? product.id : null,
    images: product ? [...(product.images || [])] : [],
    colors: product && product.colors.length ? product.colors.map((color) => ({ ...color })) : [{ name: 'Unique', hex: '#c9a227' }],
    sizes: product && product.sizes.length ? [...product.sizes] : ['Taille unique'],
    variantType: product ? (product.variantType || 'taille') : 'taille',
    variants: {},
    featured: product ? Boolean(product.featured) : false,
    active: product ? Boolean(product.active) : true
  };
  if (product) {
    product.variants.forEach((variant) => {
      draft.variants[variant.color + '||' + variant.size] = variant.stock;
    });
  }
  return draft;
}

function openProductForm(id) {
  const product = id ? admin.data.products.find((entry) => entry.id === id) : null;
  admin.productDraft = productDraftFrom(product);
  const draft = admin.productDraft;

  openModal(
    '<div class="modal-head"><h2>' + (product ? 'Modifier l’article' : 'Nouvel article') + '</h2>' +
      '<p>' + (product ? esc(product.name) : 'Ajoutez une nouvelle pièce à votre catalogue.') + '</p></div>' +
    '<div class="modal-body">' +

      '<div class="form-section">' +
        '<div class="form-section-head"><h3>Informations</h3></div>' +
        '<div class="form-grid">' +
          '<div class="field full"><label for="pfName">Nom de l’article *</label><input id="pfName" maxlength="120" value="' + esc(product ? product.name : '') + '" placeholder="Ex : Sac Émeraude"></div>' +
          '<div class="field"><label for="pfCategory">Catégorie *</label><select id="pfCategory"><option value="">Choisir…</option>' +
            admin.data.categories.map((category) => '<option value="' + esc(category.id) + '"' + (product && product.categoryId === category.id ? ' selected' : '') + '>' + esc(category.name) + '</option>').join('') +
          '</select></div>' +
          '<div class="field"><label for="pfPrice">Prix (' + esc(admin.data.settings.currency) + ') *</label><input id="pfPrice" type="number" min="0" step="1" value="' + (product ? product.price : '') + '" placeholder="0"></div>' +
          '<div class="field"><label for="pfCompare">Ancien prix (facultatif)</label><input id="pfCompare" type="number" min="0" step="1" value="' + (product && product.comparePrice ? product.comparePrice : '') + '" placeholder="0"><span class="hint">Affiché barré si supérieur au prix.</span></div>' +
          '<div class="field full"><label for="pfDescription">Description</label><textarea id="pfDescription" rows="3" maxlength="4000" placeholder="Matière, allure, occasion…">' + esc(product ? product.description : '') + '</textarea></div>' +
          '<div class="field full"><label for="pfDetails">Détails (une ligne par point)</label><textarea id="pfDetails" rows="4" placeholder="Cuir véritable&#10;Dimensions : 24 × 18 cm">' + esc(product ? (product.details || []).join('\n') : '') + '</textarea></div>' +
        '</div>' +
      '</div>' +

      '<div class="form-section">' +
        '<div class="form-section-head"><h3>Photos</h3><span class="badge-total" id="imageCount">0 / 8</span></div>' +
        '<div class="upload-zone" id="uploadZone"><svg class="icon"><use href="#a-upload"></use></svg><strong>Cliquez ou déposez vos photos</strong><small>JPG, PNG ou WebP — 8 photos max. Elles sont optimisées automatiquement.</small></div>' +
        '<input type="file" id="productImages" accept="image/*" multiple hidden>' +
        '<div class="image-grid" id="imageGrid"></div>' +
      '</div>' +

      '<div class="form-section">' +
        '<div class="form-section-head"><div><h3>Couleurs</h3><p>Ajoutez chaque coloris proposé.</p></div></div>' +
        '<div class="color-list" id="colorList"></div>' +
        '<div class="inline-add">' +
          '<input type="text" id="newColorName" maxlength="40" placeholder="Ex : Noir">' +
          '<input type="color" id="newColorHex" value="#c9a227" aria-label="Couleur">' +
          '<button type="button" class="btn btn-outline btn-sm" id="addColorBtn"><svg class="icon sm"><use href="#a-plus"></use></svg> Ajouter</button>' +
          '<span class="hint">Appuyez sur Entrée pour valider.</span>' +
        '</div>' +
      '</div>' +

      '<div class="form-section">' +
        '<div class="form-section-head"><div><h3 id="sizeSectionTitle">Taille / format / pointure</h3><p id="sizeSectionHint">Choisissez le type d\'attribut puis ajoutez les valeurs.</p></div></div>' +
        '<div class="variant-type-tabs" id="variantTypeTabs">' +
          ['taille','format','pointure'].map((type) => '<button type="button" class="variant-type-tab' + (admin.productDraft.variantType === type ? ' active' : '') + '" data-variant-type="' + type + '">' + variantInfo(type).label + '</button>').join('') +
        '</div>' +
        '<div class="size-list" id="sizeList"></div>' +
        '<div class="inline-add">' +
          '<input type="text" id="newSizeName" maxlength="30" placeholder="Ex : M">' +
          '<button type="button" class="btn btn-outline btn-sm" id="addSizeBtn"><svg class="icon sm"><use href="#a-plus"></use></svg> Ajouter</button>' +
          '<span class="hint">Appuyez sur Entrée pour valider.</span>' +
        '</div>' +
      '</div>' +

      '<div class="form-section">' +
        '<div class="form-section-head"><div><h3>Stock par variante</h3><p>Indiquez le stock exact pour chaque couleur et ' + variantInfo(admin.productDraft.variantType).label.toLowerCase() + '.</p></div><span class="badge-total" id="stockTotal"></span></div>' +
        '<div id="variantWrap"></div>' +
      '</div>' +

      '<div class="form-section">' +
        '<div class="form-section-head"><h3>Publication</h3></div>' +
        '<label class="check-line"><input type="checkbox" id="pfActive"' + (draft.active ? ' checked' : '') + '> Article visible dans la boutique</label>' +
        '<label class="check-line"><input type="checkbox" id="pfFeatured"' + (draft.featured ? ' checked' : '') + '> Mettre en avant sur la page d’accueil</label>' +
      '</div>' +

      '<div class="form-error" id="productError"></div>' +
    '</div>' +
    '<div class="modal-footer">' +
      '<button class="btn btn-outline" id="cancelProduct">Annuler</button>' +
      '<button class="btn btn-gold" id="saveProduct">' + (product ? 'Enregistrer les modifications' : 'Créer l’article') + '</button>' +
    '</div>',
    true
  );

  renderProductImages();
  renderProductColors();
  renderProductSizes();
  renderVariantMatrix();

  /* Photos */
  const uploadZone = $('#uploadZone');
  const fileInput = $('#productImages');
  uploadZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    addProductImages(Array.from(fileInput.files || []));
    fileInput.value = '';
  });
  ['dragenter', 'dragover'].forEach((eventName) => uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadZone.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach((eventName) => uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadZone.classList.remove('dragover');
  }));
  uploadZone.addEventListener('drop', (event) => {
    addProductImages(Array.from(event.dataTransfer.files || []));
  });

  $('#imageGrid').addEventListener('click', (event) => {
    const remove = event.target.closest('[data-image-remove]');
    if (remove) {
      draft.images.splice(Number(remove.dataset.imageRemove), 1);
      renderProductImages();
      return;
    }
    const main = event.target.closest('[data-image-main]');
    if (main) {
      const index = Number(main.dataset.imageMain);
      const [image] = draft.images.splice(index, 1);
      draft.images.unshift(image);
      renderProductImages();
    }
  });

  /* Couleurs */
  const addColor = () => {
    const nameInput = $('#newColorName');
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    if (draft.colors.some((color) => color.name.toLowerCase() === name.toLowerCase())) {
      toast('Cette couleur existe déjà.', 'error');
      return;
    }
    if (draft.colors.length >= 12) {
      toast('12 couleurs maximum.', 'error');
      return;
    }
    collectProductStocks();
    draft.colors.push({ name, hex: $('#newColorHex').value || '#c9a227' });
    nameInput.value = '';
    renderProductColors();
    renderVariantMatrix();
  };
  $('#addColorBtn').addEventListener('click', addColor);
  $('#newColorName').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); addColor(); }
  });
  $('#colorList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-color-remove]');
    if (!button) return;
    collectProductStocks();
    draft.colors.splice(Number(button.dataset.colorRemove), 1);
    if (!draft.colors.length) draft.colors.push({ name: 'Unique', hex: '#c9a227' });
    renderProductColors();
    renderVariantMatrix();
  });

  /* Tailles */
  const addSize = () => {
    const input = $('#newSizeName');
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    if (draft.sizes.some((size) => size.toLowerCase() === name.toLowerCase())) {
      toast('Cette taille existe déjà.', 'error');
      return;
    }
    if (draft.sizes.length >= 15) {
      toast('15 tailles maximum.', 'error');
      return;
    }
    collectProductStocks();
    draft.sizes.push(name);
    input.value = '';
    renderProductSizes();
    renderVariantMatrix();
  };
  $('#addSizeBtn').addEventListener('click', addSize);
  $('#newSizeName').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); addSize(); }
  });
  $('#sizeList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-size-remove]');
    if (!button) return;
    collectProductStocks();
    draft.sizes.splice(Number(button.dataset.sizeRemove), 1);
    if (!draft.sizes.length) draft.sizes.push('Taille unique');
    renderProductSizes();
    renderVariantMatrix();
  });

  /* Type de variante */
  $('#variantTypeTabs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-variant-type]');
    if (!button) return;
    collectProductStocks();
    draft.variantType = button.dataset.variantType;
    $$('#variantTypeTabs [data-variant-type]').forEach((tab) => tab.classList.toggle('active', tab.dataset.variantType === draft.variantType));
    const hint = $('#stockSectionHint');
    if (hint) hint.textContent = 'Indiquez le stock exact pour chaque couleur et ' + variantInfo(draft.variantType).label.toLowerCase() + '.';
    const sizeInput = $('#newSizeName');
    if (sizeInput) sizeInput.placeholder = variantInfo(draft.variantType).placeholder;
    const sizeHint = $('#sizeSectionHint');
    if (sizeHint) sizeHint.textContent = 'Type : ' + variantInfo(draft.variantType).label + ' — ' + variantInfo(draft.variantType).hint + '.';
    renderProductSizes();
    renderVariantMatrix();
  });

  /* Stock */
  $('#variantWrap').addEventListener('input', (event) => {
    const input = event.target.closest('[data-variant]');
    if (!input) return;
    const key = input.dataset.color + '||' + input.dataset.size;
    draft.variants[key] = Math.max(0, Math.min(99999, Math.round(Number(input.value) || 0)));
    input.classList.toggle('zero', draft.variants[key] === 0);
    input.classList.toggle('low', draft.variants[key] > 0 && draft.variants[key] <= 3);
    updateProductStockTotal();
  });

  $('#cancelProduct').addEventListener('click', closeModal);
  $('#saveProduct').addEventListener('click', () => saveProduct(product));
}

function renderProductImages() {
  const grid = $('#imageGrid');
  if (!grid) return;
  const draft = admin.productDraft;
  $('#imageCount').textContent = draft.images.length + ' / 8';
  grid.innerHTML = draft.images.map((image, index) =>
    '<div class="image-tile">' +
      '<img src="' + esc(assetUrl(image)) + '" alt="Photo ' + (index + 1) + '">' +
      (index === 0 ? '<span class="main-tag">Principale</span>' : '') +
      '<div class="tile-actions">' +
        (index !== 0 ? '<button type="button" data-image-main="' + index + '" title="Mettre en principale"><svg class="icon"><use href="#a-star"></use></svg></button>' : '') +
        '<button type="button" data-image-remove="' + index + '" title="Supprimer"><svg class="icon"><use href="#a-trash"></use></svg></button>' +
      '</div>' +
    '</div>'
  ).join('');
}

async function addProductImages(files) {
  const draft = admin.productDraft;
  const remaining = 8 - draft.images.length;
  if (remaining <= 0) {
    toast('8 photos maximum.', 'error');
    return;
  }
  const accepted = files.filter((file) => file.type.startsWith('image/')).slice(0, remaining);
  if (!accepted.length) return;
  try {
    const images = await Promise.all(accepted.map((file) => compressImage(file, 1300, 0.82)));
    draft.images.push(...images);
    renderProductImages();
    toast(images.length + ' photo' + (images.length > 1 ? 's' : '') + ' ajoutée' + (images.length > 1 ? 's' : '') + '.');
  } catch {
    toast('Impossible de lire cette image.', 'error');
  }
}

function renderProductColors() {
  const list = $('#colorList');
  if (!list) return;
  const draft = admin.productDraft;
  list.innerHTML = draft.colors.map((color, index) =>
    '<span class="color-chip"><span class="dot" style="background:' + esc(color.hex) + '"></span>' + esc(color.name) +
    '<button type="button" data-color-remove="' + index + '" aria-label="Supprimer ' + esc(color.name) + '">×</button></span>'
  ).join('') || '<span class="hint">Ajoutez au moins une couleur (ou gardez « Unique »).</span>';
}

function renderProductSizes() {
  const list = $('#sizeList');
  if (!list) return;
  const draft = admin.productDraft;
  list.innerHTML = draft.sizes.map((size, index) =>
    '<span class="size-chip">' + esc(size) +
    '<button type="button" data-size-remove="' + index + '" aria-label="Supprimer ' + esc(size) + '">×</button></span>'
  ).join('') || '<span class="hint">Ajoutez au moins une taille (ou gardez « Taille unique »).</span>';
}

function renderVariantMatrix() {
  const wrap = $('#variantWrap');
  if (!wrap) return;
  const draft = admin.productDraft;
  if (!draft.colors.length || !draft.sizes.length) {
    wrap.innerHTML = '<div class="admin-empty" style="padding:26px"><p style="margin:0;font-size:12px">Ajoutez une couleur et une taille pour saisir le stock.</p></div>';
    updateProductStockTotal();
    return;
  }

  wrap.innerHTML =
    '<div class="variant-scroll"><table class="variant-table"><thead><tr><th>Couleur / ' + variantInfo(draft.variantType).label + '</th>' +
      draft.sizes.map((size) => '<th>' + esc(size) + '</th>').join('') +
    '</tr></thead><tbody>' +
      draft.colors.map((color) =>
        '<tr><td><span class="cell-color"><span class="dot" style="background:' + esc(color.hex) + '"></span>' + esc(color.name) + '</span></td>' +
          draft.sizes.map((size) => {
            const key = color.name + '||' + size;
            const stock = Number(draft.variants[key]) || 0;
            return '<td><input type="number" min="0" max="99999" data-variant data-color="' + esc(color.name) + '" data-size="' + esc(size) + '" value="' + stock + '" class="' + (stock === 0 ? 'zero' : stock <= 3 ? 'low' : '') + '" aria-label="Stock ' + esc(color.name) + ' ' + esc(size) + '"></td>';
          }).join('') +
        '</tr>'
      ).join('') +
    '</tbody></table></div>';
  updateProductStockTotal();
}

function collectProductStocks() {
  const draft = admin.productDraft;
  if (!draft) return;
  $$('#variantWrap [data-variant]').forEach((input) => {
    const key = input.dataset.color + '||' + input.dataset.size;
    draft.variants[key] = Math.max(0, Math.min(99999, Math.round(Number(input.value) || 0)));
  });
}

function updateProductStockTotal() {
  const badge = $('#stockTotal');
  if (!badge) return;
  const draft = admin.productDraft;
  let total = 0;
  if ($('#variantWrap [data-variant]')) {
    $$('#variantWrap [data-variant]').forEach((input) => { total += Math.max(0, Number(input.value) || 0); });
  } else {
    draft.colors.forEach((color) => draft.sizes.forEach((size) => { total += Number(draft.variants[color.name + '||' + size]) || 0; }));
  }
  badge.textContent = total === 0 ? 'En rupture' : '';
}

async function saveProduct(existing) {
  if (admin.saving) return;
  const draft = admin.productDraft;
  const errorBox = $('#productError');
  const name = $('#pfName').value.trim();
  const categoryId = $('#pfCategory').value;
  const price = Number($('#pfPrice').value);
  const comparePrice = Number($('#pfCompare').value) || 0;

  const fail = (message) => {
    errorBox.textContent = message;
    errorBox.classList.add('show');
    errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (!name) return fail('Le nom de l’article est obligatoire.');
  if (!categoryId) return fail('Choisissez une catégorie.');
  if (!price || price <= 0) return fail('Indiquez un prix supérieur à 0.');
  if (!draft.colors.length || !draft.sizes.length) return fail('Ajoutez au moins une couleur et une taille.');

  collectProductStocks();
  const variants = [];
  draft.colors.forEach((color) => {
    draft.sizes.forEach((size) => {
      variants.push({ color: color.name, size, stock: Number(draft.variants[color.name + '||' + size]) || 0 });
    });
  });

  const payload = {
    name,
    categoryId,
    price,
    comparePrice,
    description: $('#pfDescription').value.trim(),
    details: $('#pfDetails').value.split('\n').map((line) => line.trim()).filter(Boolean),
    images: draft.images,
    colors: draft.colors,
    sizes: draft.sizes,
    variantType: draft.variantType,
    variants,
    active: $('#pfActive').checked,
    featured: $('#pfFeatured').checked
  };

  const button = $('#saveProduct');
  admin.saving = true;
  button.disabled = true;
  button.textContent = 'Enregistrement…';
  errorBox.classList.remove('show');

  try {
    if (existing) await api('/api/admin/products/' + encodeURIComponent(existing.id), { method: 'PUT', body: JSON.stringify(payload) });
    else await api('/api/admin/products', { method: 'POST', body: JSON.stringify(payload) });
    closeModal();
    admin.section = 'products';
    await refresh(existing ? 'Article mis à jour.' : 'Article créé et ajouté à la boutique.');
  } catch (error) {
    fail(error.message);
    button.disabled = false;
    button.textContent = existing ? 'Enregistrer les modifications' : 'Créer l’article';
  } finally {
    admin.saving = false;
  }
}

async function duplicateProduct(id) {
  const product = admin.data.products.find((entry) => entry.id === id);
  if (!product) return;
  try {
    await api('/api/admin/products/' + encodeURIComponent(id) + '/duplicate', { method: 'POST' });
    await refresh('Article dupliqué. Pensez à mettre à jour les photos et le stock.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function deleteProduct(id) {
  const product = admin.data.products.find((entry) => entry.id === id);
  if (!product) return;
  if (!confirm('Supprimer « ' + product.name + ' » ?\n\nCette action est définitive.')) return;
  try {
    await api('/api/admin/products/' + encodeURIComponent(id), { method: 'DELETE' });
    await refresh('Article supprimé.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function toggleProductActive(id, active) {
  try {
    await api('/api/admin/products/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify({ active }) });
    await refresh(active ? 'Article remis en ligne.' : 'Article masqué de la boutique.');
  } catch (error) {
    toast(error.message, 'error');
    await refresh();
  }
}

/* ------------------------------ Catégories ------------------------------ */

function renderCategories() {
  const categories = admin.data.categories;
  $('#adminContent').innerHTML =
    '<div class="admin-toolbar">' +
      '<div class="admin-toolbar-left"><span style="font-size:11.5px;color:var(--muted)">' + categories.length + ' univers · ' + admin.data.products.length + ' articles</span></div>' +
      '<div class="admin-toolbar-right"><button class="btn btn-gold btn-sm" data-quick-add-category><svg class="icon sm"><use href="#a-plus"></use></svg> Nouvelle catégorie</button></div>' +
    '</div>' +
    (categories.length
      ? '<div class="category-admin-grid">' + categories.map((category) => {
          const count = admin.data.products.filter((product) => product.categoryId === category.id).length;
          return '<div class="admin-category-card">' +
            '<div class="admin-category-media"><img src="' + esc(assetUrl(category.image || IMG_LOGO_FULL)) + '" alt="' + esc(category.name) + '"><span class="cat-order">N° ' + category.order + '</span></div>' +
            '<div class="admin-category-body">' +
              '<h3>' + esc(category.name) + '</h3>' +
              '<p>' + esc(category.description || 'Aucune description.') + '</p>' +
              '<div class="admin-category-meta"><span>' + count + ' article' + (count > 1 ? 's' : '') + '</span>' +
                '<div class="admin-category-actions">' +
                  '<button class="row-btn" data-edit-category="' + esc(category.id) + '" aria-label="Modifier"><svg class="icon"><use href="#a-edit"></use></svg></button>' +
                  '<button class="row-btn danger" data-delete-category="' + esc(category.id) + '" aria-label="Supprimer"><svg class="icon"><use href="#a-trash"></use></svg></button>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>';
        }).join('') + '</div>'
      : '<div class="admin-empty"><svg class="icon"><use href="#a-folder"></use></svg><h3>Aucune catégorie</h3><p>Créez vos univers pour organiser la boutique.</p><button class="btn btn-gold" data-quick-add-category>Créer une catégorie</button></div>');
}

function openCategoryForm(id) {
  const category = id ? admin.data.categories.find((entry) => entry.id === id) : null;
  admin.categoryDraft = { id: category ? category.id : null, image: category ? category.image : '' };

  openModal(
    '<div class="modal-head"><h2>' + (category ? 'Modifier la catégorie' : 'Nouvelle catégorie') + '</h2><p>Un univers clair aide vos clientes à trouver leur pièce.</p></div>' +
    '<div class="modal-body">' +
      '<div class="form-grid">' +
        '<div class="field"><label for="cfName">Nom *</label><input id="cfName" maxlength="60" value="' + esc(category ? category.name : '') + '" placeholder="Ex : Sacs"></div>' +
        '<div class="field"><label for="cfOrder">Ordre d’affichage</label><input id="cfOrder" type="number" min="1" max="999" value="' + (category ? category.order : admin.data.categories.length + 1) + '"></div>' +
        '<div class="field full"><label for="cfDescription">Description</label><textarea id="cfDescription" rows="3" maxlength="500" placeholder="Quelques mots sur cet univers…">' + esc(category ? category.description : '') + '</textarea></div>' +
      '</div>' +
      '<div class="form-section">' +
        '<div class="form-section-head"><h3>Visuel de la catégorie</h3></div>' +
        '<div class="upload-zone" id="categoryUpload"><svg class="icon"><use href="#a-image"></use></svg><strong>Cliquez pour choisir une image</strong><small>Format paysage conseillé.</small></div>' +
        '<input type="file" id="categoryImageInput" accept="image/*" hidden>' +
        '<div class="hero-preview" id="categoryPreview"' + (category && category.image ? '' : ' hidden') + '><img src="' + esc(assetUrl(category && category.image ? category.image : IMG_LOGO_FULL)) + '" alt="Visuel"></div>' +
      '</div>' +
      '<div class="form-error" id="categoryError"></div>' +
    '</div>' +
    '<div class="modal-footer"><button class="btn btn-outline" id="cancelCategory">Annuler</button><button class="btn btn-gold" id="saveCategory">' + (category ? 'Enregistrer' : 'Créer la catégorie') + '</button></div>'
  );

  $('#categoryUpload').addEventListener('click', () => $('#categoryImageInput').click());
  $('#categoryImageInput').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 1400, 0.82);
      admin.categoryDraft.image = compressed;
      const preview = $('#categoryPreview');
      preview.hidden = false;
      preview.querySelector('img').src = compressed;
    } catch {
      toast('Impossible de lire cette image.', 'error');
    }
  });
  $('#cancelCategory').addEventListener('click', closeModal);
  $('#saveCategory').addEventListener('click', () => saveCategory(category));
}

async function saveCategory(existing) {
  const errorBox = $('#categoryError');
  const name = $('#cfName').value.trim();
  if (!name) {
    errorBox.textContent = 'Le nom est obligatoire.';
    errorBox.classList.add('show');
    return;
  }
  const payload = {
    name,
    description: $('#cfDescription').value.trim(),
    order: Number($('#cfOrder').value) || admin.data.categories.length + 1,
    image: admin.categoryDraft.image
  };
  const button = $('#saveCategory');
  button.disabled = true;
  button.textContent = 'Enregistrement…';
  try {
    if (existing) await api('/api/admin/categories/' + encodeURIComponent(existing.id), { method: 'PUT', body: JSON.stringify(payload) });
    else await api('/api/admin/categories', { method: 'POST', body: JSON.stringify(payload) });
    closeModal();
    await refresh(existing ? 'Catégorie mise à jour.' : 'Catégorie créée.');
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.classList.add('show');
    button.disabled = false;
    button.textContent = existing ? 'Enregistrer' : 'Créer la catégorie';
  }
}

async function deleteCategory(id) {
  const category = admin.data.categories.find((entry) => entry.id === id);
  if (!category) return;
  if (!confirm('Supprimer la catégorie « ' + category.name + ' » ?')) return;
  try {
    await api('/api/admin/categories/' + encodeURIComponent(id), { method: 'DELETE' });
    await refresh('Catégorie supprimée.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

/* ------------------------------ Commandes ------------------------------ */

function renderOrders() {
  const orders = admin.data.orders;
  const filtered = admin.orderFilter === 'all' ? orders : orders.filter((order) => order.status === admin.orderFilter);
  const counts = { all: orders.length };
  STATUSES.forEach((status) => { counts[status] = orders.filter((order) => order.status === status).length; });

  $('#adminContent').innerHTML =
    '<div class="admin-toolbar">' +
      '<div class="filter-tabs">' +
        '<button class="filter-tab' + (admin.orderFilter === 'all' ? ' active' : '') + '" data-order-filter="all">Toutes (' + counts.all + ')</button>' +
        STATUSES.map((status) => '<button class="filter-tab' + (admin.orderFilter === status ? ' active' : '') + '" data-order-filter="' + status + '">' + status.charAt(0).toUpperCase() + status.slice(1) + ' (' + counts[status] + ')</button>').join('') +
      '</div>' +
      '<div class="admin-toolbar-right"><span style="font-size:10.5px;color:var(--muted)">' + filtered.length + ' commande' + (filtered.length > 1 ? 's' : '') + '</span></div>' +
    '</div>' +
    '<div class="panel"><div class="table-wrap">' +
      (filtered.length
        ? '<table class="data-table"><thead><tr><th>Référence</th><th>Client</th><th>Articles</th><th>Total</th><th>Date</th><th>Statut</th><th></th></tr></thead><tbody>' +
          filtered.map((order) =>
            '<tr>' +
              '<td class="table-nowrap"><strong style="font-weight:500;color:var(--ink)">' + esc(order.ref) + '</strong><br><small class="table-muted">' + esc(order.customer.city) + '</small></td>' +
              '<td class="order-customer"><strong>' + esc(order.customer.name) + '</strong><small>' + esc(order.customer.phone) + '</small></td>' +
              '<td class="table-muted">' + order.items.reduce((sum, item) => sum + item.qty, 0) + ' pièce' + (order.items.reduce((sum, item) => sum + item.qty, 0) > 1 ? 's' : '') + '</td>' +
              '<td class="num">' + money(order.total) + '</td>' +
              '<td class="table-muted table-nowrap">' + shortDate(order.createdAt) + '</td>' +
              '<td><select class="status-select" data-order-status="' + esc(order.id) + '">' + STATUSES.map((status) => '<option value="' + status + '"' + (order.status === status ? ' selected' : '') + '>' + status.charAt(0).toUpperCase() + status.slice(1) + '</option>').join('') + '</select></td>' +
              '<td class="num"><button class="row-btn" data-view-order="' + esc(order.id) + '" aria-label="Voir la commande"><svg class="icon"><use href="#a-eye"></use></svg></button></td>' +
            '</tr>'
          ).join('') + '</tbody></table>'
        : '<div class="admin-empty"><svg class="icon"><use href="#a-receipt"></use></svg><h3>Aucune commande</h3><p>Les commandes passées depuis la boutique apparaîtront ici.</p></div>') +
    '</div></div>';
}

function openOrderDetail(id) {
  const order = admin.data.orders.find((entry) => entry.id === id);
  if (!order) return;
  const phone = order.customer.phone ? 'tel:' + (digits(order.customer.phone).startsWith('0') ? '+213' + digits(order.customer.phone).slice(1) : '+' + digits(order.customer.phone)) : '';
  openModal(
    '<div class="modal-head"><h2>Commande ' + esc(order.ref) + '</h2><p>' + dateTime(order.createdAt) + ' · ' + order.items.reduce((sum, item) => sum + item.qty, 0) + ' article' + (order.items.length > 1 ? 's' : '') + '</p></div>' +
    '<div class="modal-body">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:20px">' +
        statusBadge(order.status) +
        '<select class="status-select" id="detailStatus" data-order-status="' + esc(order.id) + '">' + STATUSES.map((status) => '<option value="' + status + '"' + (order.status === status ? ' selected' : '') + '>' + status.charAt(0).toUpperCase() + status.slice(1) + '</option>').join('') + '</select>' +
      '</div>' +
      '<div class="order-detail-grid">' +
        '<div>' +
          '<div class="detail-label">Articles commandés</div>' +
          order.items.map((item) =>
            '<div class="order-item"><img src="' + esc(assetUrl(item.image || IMG_LOGO_FULL)) + '" alt="">' +
              '<div class="order-item-info"><strong>' + esc(item.name) + '</strong><small>' + esc(item.color) + ' · ' + esc(item.size) + ' · Qté ' + item.qty + '</small></div>' +
              '<div class="order-item-price">' + money(item.price * item.qty) + '</div>' +
            '</div>'
          ).join('') +
          '<div class="order-totals">' +
            '<div class="order-total-row"><span>Sous-total</span><span>' + money(order.subtotal) + '</span></div>' +
            '<div class="order-total-row"><span>Livraison</span><span>' + (order.delivery === 0 ? 'Offerte' : money(order.delivery)) + '</span></div>' +
            '<div class="order-total-row grand"><span>Total</span><span>' + money(order.total) + '</span></div>' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<div class="detail-label">Client</div>' +
          '<div class="customer-box"><strong>' + esc(order.customer.name) + '</strong>' +
            '<span>' + esc(order.customer.phone) + '</span>' +
            '<span>' + esc(order.customer.wilayaName || order.customer.city) + (order.customer.communeName ? ' — ' + esc(order.customer.communeName) : '') + '</span>' +
            '<span>Mode : ' + esc(order.customer.deliveryMode === 'stopdesk' ? 'Stop-desk' : 'Domicile') + '</span>' +
            (order.customer.address ? '<span>' + esc(order.customer.address) + '</span>' : '') +
            (order.customer.stopdesk ? '<span>Stop-desk : ' + esc(order.customer.stopdesk.name) + '</span>' : '') +
            (order.customer.notes ? '<span style="margin-top:6px;font-style:italic">« ' + esc(order.customer.notes) + ' »</span>' : '') +
            (phone ? '<a class="btn btn-outline btn-sm" href="' + phone + '"><svg class="icon sm"><use href="#a-phone"></use></svg> Appeler</a>' : '') +
            (order.customer.phone ? '<button type="button" class="btn btn-outline btn-sm" data-copy-phone="' + esc(order.customer.phone) + '"><svg class="icon sm"><use href="#a-copy"></use></svg> Copier le numéro</button>' : '') +
          '</div>' +
          '<div class="detail-label" style="margin-top:20px">Zimou Express</div>' +
          '<div class="customer-box" style="margin-bottom:12px">' +
            '<span>Statut : ' + esc((order.zimou && order.zimou.status) || 'non envoyé') + '</span>' +
            (order.zimou && order.zimou.tracking ? '<span>Suivi : ' + esc(order.zimou.tracking) + '</span>' : '') +
            (order.zimou && order.zimou.message ? '<span style="font-style:italic">' + esc(order.zimou.message) + '</span>' : '') +
            (order.zimou && order.zimou.error ? '<span style="color:var(--red)">' + esc(order.zimou.error) + '</span>' : '') +
            (order.zimou && order.zimou.status !== 'created' ? '<button type="button" class="btn btn-outline btn-sm" data-zimou-retry="' + esc(order.id) + '" style="margin-top:8px">Créer le colis Zimou</button>' : '') +
          '</div>' +
          '<div class="detail-label" style="margin-top:20px">Gestion</div>' +
          '<button class="btn btn-gold btn-sm btn-block" data-edit-order="' + esc(order.id) + '" style="margin-bottom:8px"><svg class="icon sm"><use href="#a-edit"></use></svg> Modifier la commande</button>' +
          '<button class="btn btn-danger btn-sm btn-block" data-delete-order="' + esc(order.id) + '"><svg class="icon sm"><use href="#a-trash"></use></svg> Supprimer la commande</button>' +
          '<p style="font-size:10px;color:var(--muted);margin-top:10px">La suppression d’une commande active remet automatiquement les articles en stock.</p>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="modal-footer"><button class="btn btn-outline" data-close-admin-modal>Fermer</button></div>'
  );
}

async function openOrderEdit(id) {
  const order = admin.data.orders.find((entry) => entry.id === id);
  if (!order) return;
  admin.orderDraft = JSON.parse(JSON.stringify(order));
  const draft = admin.orderDraft;

  if (!admin.shipping.wilayas) {
    try { admin.shipping.wilayas = await shippingWilayas(); } catch (error) { toast(error.message, 'error'); admin.shipping.wilayas = []; }
  }

  const wilayaOptions = (admin.shipping.wilayas || []).map((wilaya) =>
    '<option value="' + wilaya.id + '"' + (Number(wilaya.id) === Number(draft.customer.wilayaId) ? ' selected' : '') + '>' + esc(wilaya.label) + '</option>').join('');

  const renderItems = () => {
    const products = admin.data.products;
    return draft.items.map((item, index) => {
      const product = products.find((p) => p.id === item.productId) || {};
      const colors = product.colors || [{ name: item.color, hex: '#c9a227' }];
      const sizes = product.sizes || [item.size];
      const meta = variantInfo(product.variantType || item.variantType || 'taille');
      return '<div class="order-edit-item" data-order-item="' + index + '">' +
        '<div class="order-edit-item-head">' +
          '<strong>' + esc(item.name || product.name || item.productId) + '</strong>' +
          '<button type="button" class="row-btn danger" data-remove-order-item="' + index + '" title="Retirer"><svg class="icon sm"><use href="#a-trash"></use></svg></button>' +
        '</div>' +
        '<div class="form-grid" style="margin-top:8px">' +
          '<div class="field"><label>Couleur</label><select data-item-color="' + index + '">' +
            colors.map((color) => '<option value="' + esc(color.name) + '"' + (color.name === item.color ? ' selected' : '') + '>' + esc(color.name) + '</option>').join('') +
          '</select></div>' +
          '<div class="field"><label>' + esc(meta.label) + '</label><select data-item-size="' + index + '">' +
            sizes.map((size) => '<option value="' + esc(size) + '"' + (size === item.size ? ' selected' : '') + '>' + esc(size) + '</option>').join('') +
          '</select></div>' +
          '<div class="field"><label>Quantité</label><input type="number" min="1" max="99" data-item-qty="' + index + '" value="' + item.qty + '"></div>' +
          '<div class="field"><label>Prix unitaire</label><input type="number" min="0" step="1" data-item-price="' + index + '" value="' + item.price + '"></div>' +
        '</div>' +
      '</div>';
    }).join('') || '<p class="hint">Aucun article. Ajoutez-en un depuis le catalogue.</p>';
  };

  const build = async () => {
    const communes = await shippingCommunes(draft.customer.wilayaId).catch(() => []);
    const communeOptions = communes.map((commune) =>
      '<option value="' + commune.id + '"' + (Number(commune.id) === Number(draft.customer.communeId) ? ' selected' : '') + '>' + esc(commune.name) + '</option>').join('');

    let stopdeskSelect = '';
    if (draft.customer.deliveryMode === 'stopdesk') {
      const result = await shippingStopDesks(draft.customer.communeId).catch(() => ({ items: [] }));
      const items = result.items || [];
      draft.stopdesks = items;
      stopdeskSelect = '<div class="field full"><label>Bureau stop-desk</label><select id="oeStopdesk">' +
        '<option value="">Choisir un bureau…</option>' +
        items.map((office) => '<option value="' + (office.id == null ? '' : office.id) + '"' + ((draft.customer.stopdesk && String(draft.customer.stopdesk.id) === String(office.id)) ? ' selected' : '') + '>' + esc(office.name) + ' — ' + esc(office.address) + '</option>').join('') +
        '</select></div>';
    }

    openModal(
      '<div class="modal-head"><h2>Modifier la commande ' + esc(order.ref) + '</h2><p>' + dateTime(order.createdAt) + '</p></div>' +
      '<div class="modal-body">' +
        '<div class="form-section">' +
          '<div class="form-section-head"><h3>Client</h3></div>' +
          '<div class="form-grid">' +
            '<div class="field"><label>Nom complet</label><input id="oeName" value="' + esc(draft.customer.name) + '"></div>' +
            '<div class="field"><label>Téléphone</label><input id="oePhone" value="' + esc(draft.customer.phone) + '" inputmode="numeric"></div>' +
            '<div class="field"><label>Wilaya</label><select id="oeWilaya">' + wilayaOptions + '</select></div>' +
            '<div class="field"><label>Commune</label><select id="oeCommune">' + communeOptions + '</select></div>' +
            '<div class="field full"><label>Mode de livraison</label>' +
              '<div class="delivery-modes">' +
                '<button type="button" class="delivery-mode' + (draft.customer.deliveryMode === 'domicile' ? ' active' : '') + '" data-oe-mode="domicile">Livraison à domicile</button>' +
                '<button type="button" class="delivery-mode' + (draft.customer.deliveryMode === 'stopdesk' ? ' active' : '') + '" data-oe-mode="stopdesk">Retrait en stop-desk</button>' +
              '</div>' +
            '</div>' +
            '<div class="field full" id="oeAddressField"' + (draft.customer.deliveryMode === 'stopdesk' ? ' hidden' : '') + '><label>Adresse</label><input id="oeAddress" value="' + esc(draft.customer.address || '') + '"></div>' +
            stopdeskSelect +
            '<div class="field full"><label>Note</label><textarea id="oeNotes" rows="2">' + esc(draft.customer.notes || '') + '</textarea></div>' +
          '</div>' +
        '</div>' +
        '<div class="form-section">' +
          '<div class="form-section-head"><div><h3>Articles</h3></div><button type="button" class="btn btn-outline btn-sm" id="oeAddItem">+ Ajouter un article</button></div>' +
          '<div id="oeItems">' + renderItems() + '</div>' +
        '</div>' +
        '<div class="form-section">' +
          '<div class="form-section-head"><h3>Totaux</h3></div>' +
          '<div class="form-grid">' +
            '<div class="field"><label>Frais de livraison (DA)</label><input id="oeDelivery" type="number" min="0" step="1" value="' + (draft.delivery || 0) + '"></div>' +
            '<div class="field"><label>Sous-total</label><input id="oeSubtotal" readonly value="' + (draft.subtotal || 0) + '"></div>' +
            '<div class="field"><label>Total</label><input id="oeTotal" readonly value="' + (draft.total || 0) + '"></div>' +
          '</div>' +
        '</div>' +
        '<div class="form-error" id="oeError"></div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-outline" id="oeCancel">Annuler</button>' +
        '<button class="btn btn-gold" id="oeSave">Enregistrer les modifications</button>' +
      '</div>',
      true
    );

    const recalc = () => {
      let subtotal = 0;
      draft.items.forEach((item) => { subtotal += Number(item.price || 0) * Number(item.qty || 0); });
      draft.subtotal = subtotal;
      const delivery = Number($('#oeDelivery').value) || 0;
      draft.delivery = delivery;
      draft.total = subtotal + delivery;
      $('#oeSubtotal').value = subtotal;
      $('#oeTotal').value = draft.total;
    };

    const refreshItems = () => {
      $('#oeItems').innerHTML = renderItems();
    };

    // wilaya change
    $('#oeWilaya').addEventListener('change', async () => {
      draft.customer.wilayaId = Number($('#oeWilaya').value);
      const wilaya = (admin.shipping.wilayas || []).find((w) => Number(w.id) === draft.customer.wilayaId);
      if (wilaya) draft.customer.wilayaName = wilaya.name;
      const communes = await shippingCommunes(draft.customer.wilayaId).catch(() => []);
      $('#oeCommune').innerHTML = communes.map((c) => '<option value="' + c.id + '">' + esc(c.name) + '</option>').join('');
      draft.customer.communeId = communes[0] ? communes[0].id : null;
      draft.customer.communeName = communes[0] ? communes[0].name : '';
    });

    $('#oeCommune').addEventListener('change', () => {
      draft.customer.communeId = Number($('#oeCommune').value);
      const opt = $('#oeCommune').selectedOptions[0];
      if (opt) draft.customer.communeName = opt.textContent;
    });

    // mode
    document.querySelectorAll('[data-oe-mode]').forEach((button) => {
      button.addEventListener('click', async () => {
        draft.customer.deliveryMode = button.dataset.oeMode;
        document.querySelectorAll('[data-oe-mode]').forEach((b) => b.classList.toggle('active', b === button));
        const isStop = draft.customer.deliveryMode === 'stopdesk';
        $('#oeAddressField').hidden = isStop;
        // rebuild stopdesk select
        const existing = $('#oeStopdesk');
        if (isStop) {
          if (!existing) {
            const result = await shippingStopDesks(draft.customer.communeId).catch(() => ({ items: [] }));
            draft.stopdesks = result.items || [];
            const container = $('#oeAddressField').parentNode;
            const div = document.createElement('div');
            div.className = 'field full';
            div.innerHTML = '<label>Bureau stop-desk</label><select id="oeStopdesk"><option value="">Choisir un bureau…</option>' +
              (draft.stopdesks || []).map((office) => '<option value="' + (office.id == null ? '' : office.id) + '">' + esc(office.name) + ' — ' + esc(office.address) + '</option>').join('') +
              '</select>';
            container.insertBefore(div, $('#oeNotes').closest('.field'));
          }
        } else {
          if (existing) existing.closest('.field').remove();
        }
      });
    });

    // items events delegation
    $('#oeItems').addEventListener('change', (event) => {
      const colorSel = event.target.closest('[data-item-color]');
      if (colorSel) {
        const idx = Number(colorSel.dataset.itemColor);
        draft.items[idx].color = colorSel.value;
        return;
      }
      const sizeSel = event.target.closest('[data-item-size]');
      if (sizeSel) {
        const idx = Number(sizeSel.dataset.itemSize);
        draft.items[idx].size = sizeSel.value;
        return;
      }
      const qtyInput = event.target.closest('[data-item-qty]');
      if (qtyInput) {
        const idx = Number(qtyInput.dataset.itemQty);
        draft.items[idx].qty = Math.max(1, Math.min(99, Number(qtyInput.value) || 1));
        qtyInput.value = draft.items[idx].qty;
        recalc();
        return;
      }
      const priceInput = event.target.closest('[data-item-price]');
      if (priceInput) {
        const idx = Number(priceInput.dataset.itemPrice);
        draft.items[idx].price = Math.max(0, Number(priceInput.value) || 0);
        recalc();
        return;
      }
    });

    $('#oeItems').addEventListener('click', (event) => {
      const remove = event.target.closest('[data-remove-order-item]');
      if (remove) {
        const idx = Number(remove.dataset.removeOrderItem);
        draft.items.splice(idx, 1);
        refreshItems();
        recalc();
      }
    });

    $('#oeAddItem').addEventListener('click', () => {
      const products = admin.data.products.filter((p) => p.active);
      const options = products.map((p) => '<option value="' + esc(p.id) + '">' + esc(p.name) + ' — ' + money(p.price) + '</option>').join('');
      const choice = prompt('Collez l’ID du produit à ajouter (ou annulez) :\n' + products.map((p) => p.id + ' — ' + p.name).join('\n'));
      if (!choice) return;
      const product = products.find((p) => p.id === choice.trim());
      if (!product) { toast('Produit introuvable.', 'error'); return; }
      const color = (product.colors && product.colors[0] && product.colors[0].name) || 'Unique';
      const size = (product.sizes && product.sizes[0]) || 'Taille unique';
      draft.items.push({
        productId: product.id,
        name: product.name,
        slug: product.slug,
        image: (product.images && product.images[0]) || '',
        categoryId: product.categoryId,
        variantType: product.variantType || 'taille',
        color,
        size,
        price: product.price,
        qty: 1
      });
      refreshItems();
      recalc();
    });

    $('#oeDelivery').addEventListener('input', recalc);

    $('#oeCancel').addEventListener('click', () => openOrderDetail(id));

    $('#oeSave').addEventListener('click', async () => {
      const errorBox = $('#oeError');
      errorBox.classList.remove('show');
      draft.customer.name = $('#oeName').value.trim();
      draft.customer.phone = $('#oePhone').value.trim();
      draft.customer.address = $('#oeAddress') ? $('#oeAddress').value.trim() : (draft.customer.address || '');
      draft.customer.notes = $('#oeNotes').value.trim();
      const stopSel = $('#oeStopdesk');
      if (stopSel) {
        const office = (draft.stopdesks || []).find((o) => String(o.id) === String(stopSel.value));
        if (office) draft.customer.stopdesk = office;
        else if ((draft.stopdesks || []).length) draft.customer.stopdesk = draft.stopdesks[0];
      }
      if (draft.customer.deliveryMode === 'stopdesk' && !draft.customer.stopdesk) {
        errorBox.textContent = 'Choisissez un bureau stop-desk.';
        errorBox.classList.add('show');
        return;
      }
      const button = $('#oeSave');
      button.disabled = true;
      button.textContent = 'Enregistrement…';
      try {
        await api('/api/admin/orders/' + encodeURIComponent(id), {
          method: 'PUT',
          body: JSON.stringify({
            customer: {
              name: draft.customer.name,
              phone: draft.customer.phone,
              wilayaId: draft.customer.wilayaId,
              communeId: draft.customer.communeId,
              deliveryMode: draft.customer.deliveryMode,
              address: draft.customer.address,
              notes: draft.customer.notes,
              stopdesk: draft.customer.stopdesk
            },
            shipping: { stopdeskId: draft.customer.stopdesk ? draft.customer.stopdesk.id : null },
            items: draft.items.map((item) => ({ productId: item.productId, color: item.color, size: item.size, qty: item.qty, price: item.price })),
            delivery: draft.delivery
          })
        });
        closeModal();
        await refresh('Commande modifiée.');
      } catch (error) {
        errorBox.textContent = error.message;
        errorBox.classList.add('show');
        button.disabled = false;
        button.textContent = 'Enregistrer les modifications';
      }
    });

    recalc();
  };

  build();
}

async function updateOrderStatus(id, status) {
  try {
    await api('/api/admin/orders/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify({ status }) });
    closeModal();
    await refresh('Statut de la commande mis à jour.');
  } catch (error) {
    toast(error.message, 'error');
    await refresh();
  }
}

async function deleteOrder(id) {
  if (!confirm('Supprimer cette commande ?\n\nLe stock des articles sera restauré.')) return;
  try {
    await api('/api/admin/orders/' + encodeURIComponent(id), { method: 'DELETE' });
    closeModal();
    await refresh('Commande supprimée, stock restauré.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

/* ------------------------------ Réglages ------------------------------ */

function renderSettings() {
  const settings = admin.data.settings;
  $('#adminContent').innerHTML =
    '<div class="settings-grid">' +
      '<form class="form-card" id="settingsForm">' +
        '<h3>Identité de la maison</h3>' +
        '<p>Ces informations apparaissent sur la boutique, le footer et dans les messages Instagram.</p>' +
        '<div class="form-grid">' +
          '<div class="field"><label for="setBrand">Nom de la marque</label><input id="setBrand" value="' + esc(settings.brandName) + '" maxlength="60"></div>' +
          '<div class="field"><label for="setInstagram">Compte Instagram</label><input id="setInstagram" value="' + esc(settings.instagram) + '" maxlength="80" placeholder="diamond__luxury_"></div>' +
          '<div class="field"><label for="setPhone">Téléphone</label><input id="setPhone" value="' + esc(settings.phone) + '" maxlength="30" placeholder="+213 555 00 00 00"></div>' +
          '<div class="field"><label for="setEmail">Email</label><input id="setEmail" type="email" value="' + esc(settings.email) + '" maxlength="120"></div>' +
          '<div class="field full"><label for="setAddress">Adresse / ville</label><input id="setAddress" value="' + esc(settings.address) + '" maxlength="200"></div>' +
        '</div>' +
        '<div class="form-section">' +
          '<div class="form-section-head"><h3>Boutique</h3></div>' +
          '<div class="form-grid">' +
            '<div class="field"><label for="setCurrency">Devise</label><input id="setCurrency" value="' + esc(settings.currency) + '" maxlength="8" placeholder="DA"></div>' +
            '<div class="field"><label for="setDelivery">Frais de livraison</label><input id="setDelivery" type="number" min="0" step="1" value="' + settings.deliveryFee + '"></div>' +
            '<div class="field"><label for="setFreeShipping">Livraison offerte dès</label><input id="setFreeShipping" type="number" min="0" step="1" value="' + settings.freeShippingFrom + '"><span class="hint">0 pour désactiver.</span></div>' +
            '<div class="field full"><label for="setAnnouncement">Bandeau d’annonce</label><input id="setAnnouncement" value="' + esc(settings.announcement) + '" maxlength="180"></div>' +
          '</div>' +
        '</div>' +
        '<div class="form-section">' +
          '<div class="form-section-head"><h3>Page d’accueil</h3></div>' +
          '<div class="upload-zone" id="heroUpload"><svg class="icon"><use href="#a-image"></use></svg><strong>Remplacer le visuel principal</strong><small>Photo verticale conseillée (4:5).</small></div>' +
          '<input type="file" id="heroInput" accept="image/*" hidden>' +
          '<div class="hero-preview"><img id="heroPreview" src="' + esc(assetUrl(settings.heroImage || IMG_LOGO_FULL)) + '" alt="Visuel d’accueil"></div>' +
        '</div>' +
        '<div class="form-section">' +
          '<div class="form-section-head"><h3>Texte « La Maison »</h3></div>' +
          '<div class="field"><textarea id="setAbout" rows="6" maxlength="3000">' + esc(settings.about) + '</textarea></div>' +
        '</div>' +
        '<div class="form-error" id="settingsError"></div>' +
        '<button type="submit" class="btn btn-gold" id="saveSettings">Enregistrer les réglages</button>' +
      '</form>' +

      '<div class="settings-side">' +
        '<div class="form-card">' +
          '<h3>Sécurité</h3><p>Changez régulièrement votre mot de passe.</p>' +
          '<form id="passwordForm">' +
            '<div class="field" style="margin-bottom:12px"><label for="pwCurrent">Mot de passe actuel</label><input id="pwCurrent" type="password" autocomplete="current-password" required></div>' +
            '<div class="field" style="margin-bottom:12px"><label for="pwNext">Nouveau mot de passe</label><input id="pwNext" type="password" autocomplete="new-password" minlength="6" required></div>' +
            '<div class="field"><label for="pwConfirm">Confirmer</label><input id="pwConfirm" type="password" autocomplete="new-password" minlength="6" required></div>' +
            '<div class="form-error" id="passwordError"></div>' +
            '<button type="submit" class="btn btn-dark btn-block" id="savePassword" style="margin-top:16px"><svg class="icon sm"><use href="#a-key"></use></svg> Mettre à jour</button>' +
          '</form>' +
        '</div>' +
        '<div class="form-card">' +
          '<h3>Sauvegarde</h3><p>Vos articles, stocks et commandes sont enregistrés dans un fichier local.</p>' +
          '<div class="backup-row"><div><strong>Exporter les données</strong><span>Fichier JSON complet</span></div><a class="btn btn-outline btn-sm" href="' + API_BASE + '/api/admin/backup" download><svg class="icon sm"><use href="#a-download"></use></svg> Télécharger</a></div>' +
          '<div class="danger-note" style="margin-top:14px">Pensez à télécharger une sauvegarde avant chaque grosse modification. Les photos ajoutées sont incluses dans cette sauvegarde.</div>' +
        '</div>' +
        '<div class="form-card">' +
          '<h3>Accès boutique</h3><p>Votre vitrine est visible à l’adresse du site. Le dashboard reste protégé par mot de passe.</p>' +
          '<a class="btn btn-outline btn-block" href="./" target="_blank" rel="noopener"><svg class="icon sm"><use href="#a-external"></use></svg> Ouvrir la boutique</a>' +
        '</div>' +
      '</div>' +
    '</div>';

  $('#heroUpload').addEventListener('click', () => $('#heroInput').click());
  $('#heroInput').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const image = await compressImage(file, 1600, 0.82);
      admin.heroDraft = image;
      $('#heroPreview').src = image;
      toast('Visuel chargé. Enregistrez pour appliquer.');
    } catch {
      toast('Impossible de lire cette image.', 'error');
    }
  });

  $('#settingsForm').addEventListener('submit', saveSettings);
  $('#passwordForm').addEventListener('submit', savePassword);
}

async function saveSettings(event) {
  event.preventDefault();
  const errorBox = $('#settingsError');
  const button = $('#saveSettings');
  button.disabled = true;
  button.textContent = 'Enregistrement…';
  errorBox.classList.remove('show');
  try {
    await api('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        brandName: $('#setBrand').value,
        instagram: $('#setInstagram').value,
        phone: $('#setPhone').value,
        email: $('#setEmail').value,
        address: $('#setAddress').value,
        currency: $('#setCurrency').value,
        deliveryFee: Number($('#setDelivery').value) || 0,
        freeShippingFrom: Number($('#setFreeShipping').value) || 0,
        announcement: $('#setAnnouncement').value,
        about: $('#setAbout').value,
        heroImage: admin.heroDraft
      })
    });
    await refresh('Réglages enregistrés.');
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.classList.add('show');
    button.disabled = false;
    button.textContent = 'Enregistrer les réglages';
  }
}

async function savePassword(event) {
  event.preventDefault();
  const errorBox = $('#passwordError');
  const current = $('#pwCurrent').value;
  const next = $('#pwNext').value;
  const confirm = $('#pwConfirm').value;
  errorBox.classList.remove('show');
  if (next.length < 6) {
    errorBox.textContent = 'Le nouveau mot de passe doit contenir au moins 6 caractères.';
    errorBox.classList.add('show');
    return;
  }
  if (next !== confirm) {
    errorBox.textContent = 'Les deux nouveaux mots de passe ne correspondent pas.';
    errorBox.classList.add('show');
    return;
  }
  const button = $('#savePassword');
  button.disabled = true;
  button.textContent = 'Mise à jour…';
  try {
    await api('/api/admin/password', { method: 'POST', body: JSON.stringify({ current, next }) });
    $('#passwordForm').reset();
    toast('Mot de passe mis à jour.');
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.classList.add('show');
  } finally {
    button.disabled = false;
    button.innerHTML = '<svg class="icon sm"><use href="#a-key"></use></svg> Mettre à jour';
  }
}

/* ------------------------------ Images ------------------------------ */

function compressImage(file, maxDimension = 1300, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('decode'));
      image.onload = () => {
        let { width, height } = image;
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ------------------------------ Événements ------------------------------ */

function bindEvents() {
  /* Connexion */
  $('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('#loginSubmit');
    const errorBox = $('#loginError');
    errorBox.classList.remove('show');
    button.disabled = true;
    button.textContent = 'Connexion…';
    try {
      const response = await fetch(API_BASE + '/api/admin/login', {
        method: 'POST',
        credentials: API_CREDENTIALS,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: $('#loginPassword').value })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Connexion impossible.');
      $('#loginPassword').value = '';
      showApp();
      await loadData();
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.classList.add('show');
    } finally {
      button.disabled = false;
      button.textContent = 'Se connecter';
    }
  });

  $('#togglePassword').addEventListener('click', () => {
    const input = $('#loginPassword');
    input.type = input.type === 'password' ? 'text' : 'password';
    input.focus();
  });

  /* Sidebar */
  $$('.side-link[data-section]').forEach((link) => link.addEventListener('click', () => setSection(link.dataset.section)));
  $('#openSidebar').addEventListener('click', openSidebar);
  $('#sidebarOverlay').addEventListener('click', closeSidebar);
  $('#closeSidebar').addEventListener('click', closeSidebar);
  $$('#sidebar a.side-link').forEach((link) => link.addEventListener('click', closeSidebar));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSidebar();
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1024) closeSidebar();
  });
  $('#logoutBtn').addEventListener('click', async () => {
    await fetch(API_BASE + '/api/admin/logout', { method: 'POST', credentials: API_CREDENTIALS }).catch(() => {});
    location.reload();
  });

  /* Topbar */
  $('#quickAddProduct').addEventListener('click', () => {
    if (!admin.data) return;
    setSection('products');
    openProductForm();
  });
  $('#globalSearch').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    admin.productSearch = event.target.value.trim();
    admin.section = 'products';
    render();
    event.target.value = '';
  });

  /* Modale */
  $('#adminModalClose').addEventListener('click', closeModal);
  $('#adminModalOverlay').addEventListener('click', (event) => {
    if (event.target === $('#adminModalOverlay')) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && $('#adminModalOverlay').classList.contains('open')) closeModal();
  });

  /* Délégation contenu */
  $('#adminContent').addEventListener('click', (event) => {
    const quickAdd = event.target.closest('[data-quick-add-product]');
    if (quickAdd) {
      if (admin.section !== 'products') setSection('products');
      openProductForm();
      return;
    }
    const quickCategory = event.target.closest('[data-quick-add-category]');
    if (quickCategory) {
      if (admin.section !== 'categories') setSection('categories');
      openCategoryForm();
      return;
    }
    if (event.target.closest('[data-go-orders]')) { setSection('orders'); return; }
    if (event.target.closest('[data-go-settings]')) { setSection('settings'); return; }
    if (event.target.closest('[data-go-products]')) { setSection('products'); return; }

    const editProduct = event.target.closest('[data-edit-product]');
    if (editProduct) { openProductForm(editProduct.dataset.editProduct); return; }
    const duplicate = event.target.closest('[data-duplicate-product]');
    if (duplicate) { duplicateProduct(duplicate.dataset.duplicateProduct); return; }
    const removeProduct = event.target.closest('[data-delete-product]');
    if (removeProduct) { deleteProduct(removeProduct.dataset.deleteProduct); return; }

    const editCategory = event.target.closest('[data-edit-category]');
    if (editCategory) { openCategoryForm(editCategory.dataset.editCategory); return; }
    const removeCategory = event.target.closest('[data-delete-category]');
    if (removeCategory) { deleteCategory(removeCategory.dataset.deleteCategory); return; }

    const orderFilter = event.target.closest('[data-order-filter]');
    if (orderFilter) { admin.orderFilter = orderFilter.dataset.orderFilter; renderOrders(); return; }

    const viewOrder = event.target.closest('[data-view-order]');
    if (viewOrder) { openOrderDetail(viewOrder.dataset.viewOrder); return; }
  });

  /* Recherche & filtres produits */
  $('#adminContent').addEventListener('input', (event) => {
    if (event.target.id !== 'productSearch') return;
    const value = event.target.value;
    admin.productSearch = value;
    renderProducts();
    const input = $('#productSearch');
    if (input) {
      input.focus();
      input.setSelectionRange(value.length, value.length);
    }
  });

  $('#adminContent').addEventListener('change', (event) => {
    if (event.target.id === 'productCategoryFilter') {
      admin.productCategory = event.target.value;
      renderProducts();
      return;
    }
    if (event.target.id === 'productStatusFilter') {
      admin.productStatus = event.target.value;
      renderProducts();
      return;
    }
    const toggle = event.target.closest('[data-product-active]');
    if (toggle) {
      toggleProductActive(toggle.dataset.productActive, toggle.checked);
      return;
    }
    const statusSelect = event.target.closest('[data-order-status]');
    if (statusSelect) {
      updateOrderStatus(statusSelect.dataset.orderStatus, statusSelect.value);
    }
  });

  /* Actions dans la modale */
  document.addEventListener('click', (event) => {
    const close = event.target.closest('[data-close-admin-modal]');
    if (close) { closeModal(); return; }
    const removeOrder = event.target.closest('[data-delete-order]');
    if (removeOrder) { deleteOrder(removeOrder.dataset.deleteOrder); return; }
    const editOrder = event.target.closest('[data-edit-order]');
    if (editOrder) { openOrderEdit(editOrder.dataset.editOrder); return; }
    const copyPhone = event.target.closest('[data-copy-phone]');
    if (copyPhone) { copyValue(copyPhone.dataset.copyPhone).then((ok) => toast(ok ? 'Numéro copié.' : 'Copie impossible.', ok ? 'success' : 'error')); return; }
    const zimouRetry = event.target.closest('[data-zimou-retry]');
    if (zimouRetry) {
      api('/api/admin/orders/' + encodeURIComponent(zimouRetry.dataset.zimouRetry) + '/zimou', { method: 'POST' })
        .then(() => { toast('Colis Zimou créé.'); openOrderDetail(zimouRetry.dataset.zimouRetry); })
        .catch((error) => toast(error.message || 'Échec Zimou.', 'error'));
    }
  });
}

/* ------------------------------ Démarrage ------------------------------ */

bindEvents();
boot();
