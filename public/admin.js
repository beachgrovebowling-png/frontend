const app = document.querySelector('#admin-app');
const loginView = document.querySelector('#login-view');
const content = document.querySelector('#admin-content');
const toastRegion = document.querySelector('#toast-region');
const mediaPicker = document.querySelector('#media-picker');
const csrf = { token: '' };
const adminState = { admin: null, view: 'dashboard', page: 1, search: '', status: '', categories: [], brands: [], mediaPage: 1, currentProduct: null, settings: {} };
const API_BASE = String(window.__API_BASE__ || '').replace(/\/$/, '');

function apiUrl(path) {
  const target = String(path || '');
  if (!target) return target;
  if (/^https?:\/\//i.test(target) || target.startsWith('//')) return target;
  const normalized = target.startsWith('/') ? target : `/${target}`;
  return API_BASE ? `${API_BASE}${normalized}` : normalized;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function notify(message, type = 'success') {
  const toast = document.createElement('div'); toast.className = `toast ${type === 'error' ? 'error' : ''}`; toast.textContent = message;
  toastRegion.append(toast); setTimeout(() => toast.remove(), 4300);
}

async function refreshCsrf() {
  const response = await fetch(apiUrl('/api/admin/csrf'), { credentials: API_BASE ? 'include' : 'same-origin' });
  const data = await response.json(); csrf.token = data.csrfToken || '';
}

async function api(url, options = {}) {
  const requestUrl = apiUrl(url);
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  if (method !== 'GET' && method !== 'HEAD') headers.set('X-CSRF-Token', csrf.token);
  if (options.body && !(options.body instanceof FormData) && typeof options.body !== 'string') {
    headers.set('Content-Type', 'application/json'); options.body = JSON.stringify(options.body);
  }
  const requestConfig = {
    ...options,
    method,
    headers,
    credentials: API_BASE ? 'include' : 'same-origin'
  };
  let response = await fetch(requestUrl, requestConfig);
  if (response.status === 403 && method !== 'GET') {
    await refreshCsrf(); headers.set('X-CSRF-Token', csrf.token);
    response = await fetch(requestUrl, { ...requestConfig, headers });
  }
  if (response.status === 204) return null;
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    if (response.status === 401 && adminState.admin) showLogin('Your session expired. Sign in again.');
    throw new Error(payload?.error || 'The request could not be completed.');
  }
  return payload;
}

function showLogin(message = '') {
  app.hidden = true; loginView.hidden = false;
  document.querySelector('#login-message').textContent = message;
}

function showApp(admin) {
  adminState.admin = admin; loginView.hidden = true; app.hidden = false;
  document.querySelector('#admin-user').textContent = admin.name;
  loadView(adminState.view);
}

function setHeading(title) {
  document.querySelector('#current-section').textContent = title.toUpperCase();
  document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === adminState.view));
}

function pageHeader(title, subtitle, action = '') {
  return `<div class="page-heading"><div><p class="admin-eyebrow">STORE CONTROL / ${escapeHtml(adminState.view.toUpperCase())}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div><div class="heading-actions">${action}</div></div>`;
}

function fmtDate(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
}

function statusPill(value) {
  const tone = value === 'published' || value === 'delivered' || value === 'confirmed' ? 'green' : value === 'draft' || value === 'request-recorded' ? 'orange' : value === 'cancelled' || value === 'out-of-stock' ? 'red' : 'purple';
  return `<span class="pill ${tone}">${escapeHtml(String(value || '').replaceAll('-', ' '))}</span>`;
}

async function loadView(view = adminState.view) {
  adminState.view = view; setHeading(view);
  content.innerHTML = '<div class="no-data">Loading workspace…</div>';
  try {
    const renderers = { dashboard: renderDashboard, products: renderProducts, product: renderProductEditor, media: renderMedia, categories: renderCategories, orders: renderOrders, homepage: renderHomepage, settings: renderSettings, account: renderAccounts, password: renderPassword };
    await (renderers[view] || renderDashboard)();
  } catch (error) { content.innerHTML = `<div class="panel"><div class="no-data">${escapeHtml(error.message)}<br><button class="small-button" data-retry>Try again</button></div></div>`; }
}

async function renderDashboard() {
  const data = await api('/api/admin/dashboard');
  const stats = data.stats;
  const storage = data.status.storage;
  document.querySelector('#sidebar-dot').classList.toggle('online', data.status.database === 'connected');
  document.querySelector('#sidebar-status').textContent = data.status.database === 'connected' ? 'Database connected' : 'Database unavailable';
  const pendingBadge = document.querySelector('#pending-badge'); pendingBadge.hidden = !stats.pending; pendingBadge.textContent = stats.pending;
  const cards = [['Total products', stats.products], ['Published', stats.published], ['Drafts', stats.drafts], ['Order requests', stats.orders], ['Pending requests', stats.pending], ['Confirmed', stats.confirmed], ['Delivered', stats.delivered], ['Categories', stats.categories]];
  content.innerHTML = `${pageHeader('Store overview', 'A live view of your catalogue and customer requests.')}
    <div class="status-strip"><span class="status-item"><i class="status-light"></i>Website online</span><span class="status-item"><i class="status-light"></i>MongoDB connected</span><span class="status-item"><i class="status-light ${storage.persistentAcrossDeploys ? '' : 'warning'}"></i>Images: ${escapeHtml(storage.provider)}${storage.persistentAcrossDeploys ? ' / persistent' : ' / deployment-local'}</span><span class="status-item"><i class="status-light ${data.status.whatsappConfigured ? '' : 'warning'}"></i>WhatsApp ${data.status.whatsappConfigured ? 'configured' : 'disabled'}</span></div>
    <div class="stats-grid">${cards.map(([label, value]) => `<article class="stat-card"><span class="stat-label">${label}</span><strong class="stat-value">${Number(value) || 0}</strong><span class="stat-note">live records</span></article>`).join('')}</div>
    <div class="dashboard-columns"><section class="panel"><div class="panel-heading"><h2>Recent requests</h2><button class="small-button" data-go="orders">Manage orders ↗</button></div><div class="table-wrap">${ordersTable(data.recentOrders, true)}</div></section><section class="panel"><div class="panel-heading"><h2>Quick actions</h2></div><div class="panel-body"><div class="quick-grid"><button class="quick-action" data-create-product>Add a product <span>＋</span></button><button class="quick-action" data-go="media">Upload images <span>↗</span></button><button class="quick-action" data-go="homepage">Edit homepage <span>↗</span></button><button class="quick-action" data-go="categories">Manage categories <span>↗</span></button><button class="quick-action" data-go="settings">Website settings <span>↗</span></button><button class="quick-action" data-go="orders">Review requests <span>↗</span></button></div></div><div class="panel-heading"><h2>Recent activity</h2></div><div class="panel-body">${data.activities.length ? data.activities.map(item => `<div class="account-row"><span><b>${escapeHtml(item.summary)}</b><small class="table-sub">${escapeHtml(item.actorEmail)} · ${escapeHtml(item.action)}</small></span><span class="table-sub">${escapeHtml(fmtDate(item.createdAt))}</span></div>`).join('') : '<div class="no-data">No admin activity yet.</div>'}</div></section></div>`;
}

function ordersTable(orders = [], compact = false) {
  if (!orders.length) return '<div class="no-data">No order requests have been recorded.</div>';
  return `<table><thead><tr><th>Reference</th><th>Customer / Product</th><th>Status</th><th>Received</th>${compact ? '' : '<th></th>'}</tr></thead><tbody>${orders.map(order => `<tr><td><span class="table-title">${escapeHtml(order.reference)}</span></td><td><span class="table-title">${escapeHtml(order.customer?.name)}</span><span class="table-sub">${escapeHtml(order.product?.name)} × ${Number(order.product?.quantity) || 0}</span></td><td>${statusPill(order.status)}</td><td>${escapeHtml(fmtDate(order.createdAt))}</td>${compact ? '' : `<td><div class="row-actions"><button class="small-button" data-order="${escapeHtml(order._id)}">Open</button><button class="small-button" data-order-delete="${escapeHtml(order._id)}" data-order-reference="${escapeHtml(order.reference)}">Delete</button></div></td>`}</tr>`).join('')}</tbody></table>`;
}

async function renderProducts() {
  const params = new URLSearchParams({ page: adminState.page, limit: 20, search: adminState.search, status: adminState.status });
  const data = await api(`/api/admin/products?${params}`);
  const categories = await api('/api/admin/categories'); adminState.categories = categories.categories;
  content.innerHTML = `${pageHeader('Products', `${data.total} catalogue records. Drafts stay private until published.`, '<button class="admin-button primary" data-create-product>＋ Add product</button>')}
    <div class="panel"><div class="panel-body"><div class="toolbar"><input class="admin-input" id="product-search" value="${escapeHtml(adminState.search)}" placeholder="Search name, brand, SKU" aria-label="Search products"><select class="admin-select" id="product-status"><option value="">All statuses</option><option value="published" ${adminState.status === 'published' ? 'selected' : ''}>Published</option><option value="draft" ${adminState.status === 'draft' ? 'selected' : ''}>Draft</option></select><button class="small-button" data-refresh>Search</button><span class="toolbar-spacer"></span><select class="admin-select" id="bulk-action"><option value="">Bulk action…</option><option value="publish">Publish</option><option value="draft">Set draft</option><option value="delete">Delete</option></select><button class="small-button" data-bulk>Apply</button></div><div class="table-wrap"><table><thead><tr><th><input type="checkbox" id="select-all" aria-label="Select all"></th><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Modified</th><th>Actions</th></tr></thead><tbody>${data.products.length ? data.products.map(product => `<tr><td><input type="checkbox" class="product-check" value="${escapeHtml(product._id)}" aria-label="Select ${escapeHtml(product.name)}"></td><td><span class="table-title">${escapeHtml(product.name)}</span><span class="table-sub">${escapeHtml(product.brand)}${product.sku ? ` · ${escapeHtml(product.sku)}` : ''}</span></td><td>${escapeHtml(product.category)}</td><td>${Number.isFinite(product.price) && product.priceConfirmed ? `$${product.price.toFixed(2)}` : 'Contact'}</td><td>${product.stockQuantity == null ? 'Unconfirmed' : Number(product.stockQuantity)}</td><td>${statusPill(product.status || 'published')}</td><td>${escapeHtml(fmtDate(product.updatedAt))}</td><td><div class="row-actions"><button data-edit-product="${escapeHtml(product._id)}">Edit</button><button data-duplicate-product="${escapeHtml(product._id)}">Copy</button><button data-delete-product="${escapeHtml(product._id)}">Delete</button></div></td></tr>`).join('') : '<tr><td class="empty-row" colspan="8">No products match. Add verified inventory or change your filters.</td></tr>'}</tbody></table></div><div class="pagination"><span>${data.total} products · page ${data.page} of ${Math.max(1, data.pages)}</span><div class="pagination-actions"><button class="small-button" data-page="${data.page - 1}" ${data.page <= 1 ? 'disabled' : ''}>Previous</button><button class="small-button" data-page="${data.page + 1}" ${data.page >= data.pages ? 'disabled' : ''}>Next</button></div></div></div></div>`;
}

async function openProductEditor(productId = null) {
  const [categoryData, productData] = await Promise.all([
    api('/api/admin/categories'),
    productId ? api(`/api/admin/products/${encodeURIComponent(productId)}`) : Promise.resolve({ product: {} })
  ]);
  adminState.categories = categoryData.categories;
  productForm(productData.product);
}

function productForm(product = {}) {
  adminState.currentProduct = product._id || null;
  const isEdit = Boolean(product._id);
  content.innerHTML = `${pageHeader(isEdit ? 'Edit product' : 'Add product', 'Only publish verified product details, prices, and inventory.', '<button class="admin-button secondary" data-go="products">← Product list</button>')}
  <form id="product-form"><div class="editor-layout"><section class="panel"><div class="panel-body">
    <div class="form-section"><h3>Product details</h3><div class="admin-form-grid">
      ${field('name', 'Product name', product.name, true)}${field('brand', 'Brand', product.brand, true)}${field('slug', 'URL slug', product.slug)}${field('sku', 'SKU / internal code', product.sku)}
      <label class="setting-field">Category<select class="admin-select" name="category" required>${[...new Map([ ...['bowling-ball','accessory','bag','apparel','other'].map(c => [c, { slug: c, name: c.replaceAll('-', ' ') }]), ...adminState.categories.map(c => [c.slug, c]) ]).values()].map(c => `<option value="${escapeHtml(c.slug)}" ${(product.category || 'bowling-ball') === c.slug ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select></label>
      <label class="setting-field">Condition<select name="condition" class="admin-select">${['unspecified','new','used','refurbished'].map(c => `<option value="${c}" ${(product.condition || 'unspecified') === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      ${field('shortDescription', 'Short description', product.shortDescription || product.description, false, 'text', 'A concise public card description')}
      <label class="setting-field full">Full description<textarea class="admin-textarea" name="fullDescription" maxlength="8000">${escapeHtml(product.fullDescription || product.description || '')}</textarea></label>
      <label class="setting-field full">Specifications <span class="hint">One per line, format: Property: Value</span><textarea class="admin-textarea" name="specifications" placeholder="Core: verified value">${escapeHtml((product.specifications || []).map(item => `${item.name}: ${item.value}`).join('\n'))}</textarea></label>
      ${field('tags', 'Tags', (product.tags || []).join(', '), false, 'text', 'Comma-separated tags')}
    </div></div>
    <div class="form-section"><h3>Price and availability</h3><div class="admin-form-grid">
      ${field('price', 'Regular price (USD)', product.price ?? '', false, 'number', 'Leave blank to show Contact for price')}${field('salePrice', 'Sale price (USD)', product.salePrice ?? '', false, 'number', 'Optional; must not exceed the regular price')}
      <label class="check-row"><input name="priceConfirmed" type="checkbox" ${product.priceConfirmed ? 'checked' : ''}> Confirm this price before publishing it</label>
      ${field('stockQuantity', 'Stock quantity', product.stockQuantity ?? '', false, 'number', 'Leave blank if unverified')}${field('lowStockThreshold', 'Low-stock warning threshold', product.lowStockThreshold ?? '', false, 'number', 'Optional')}
      <label class="setting-field">Availability<select name="availability" class="admin-select">${[['contact','Contact for availability'],['available','In stock (verified)'],['out-of-stock','Out of stock']].map(([v,l]) => `<option value="${v}" ${(product.availability || 'contact') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      ${field('seoTitle', 'SEO title', product.seoTitle)}${field('seoDescription', 'SEO description', product.seoDescription)}
    </div></div><div class="form-actions"><button class="admin-button secondary" type="button" data-go="products">Cancel</button><button class="admin-button secondary" type="submit" name="status" value="draft">Save draft</button><button class="admin-button primary" type="submit" name="status" value="published">${isEdit ? 'Save changes' : 'Publish product'}</button></div></div></section>
    <aside class="editor-side"><section class="panel"><div class="panel-heading"><h2>Publication</h2></div><div class="panel-body"><label class="check-row"><input name="featured" type="checkbox" ${product.featured ? 'checked' : ''}> Featured product</label><p class="table-sub">Current status: ${escapeHtml(product.status || 'published')}</p></div></section><section class="panel"><div class="panel-heading"><h2>Equipment photo</h2></div><div class="panel-body"><input type="hidden" name="image" value="${escapeHtml(product.image || '')}"><label class="setting-field">Image alt text<input class="admin-input" name="imageAlt" maxlength="240" value="${escapeHtml(product.imageAlt || '')}"></label><div class="image-slot" id="product-image-preview">${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.imageAlt || '')}">` : '<span class="image-empty">No image selected</span>'}</div><label class="small-button upload-button">Upload equipment photo<input id="product-image-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden></label><button class="small-button" type="button" data-pick-image="image">Choose from media</button></div></section><section class="panel"><div class="panel-heading"><h2>Gallery</h2></div><div class="panel-body"><input type="hidden" name="gallery" value="${escapeHtml(JSON.stringify(product.gallery || []))}"><div id="gallery-preview" class="media-meta">${(product.gallery || []).map((item, index) => `<span class="gallery-preview-item"><img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.alt)}"><button type="button" class="small-button" data-remove-gallery="${index}" aria-label="Remove gallery photo ${index + 1}">Remove</button></span>`).join('')}</div><label class="small-button upload-button">Upload gallery photos<input id="product-gallery-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden></label><button class="small-button" type="button" data-pick-image="gallery">Add from media library</button><p class="table-sub">Select multiple photos at once. Up to 12 gallery photos per product.</p></div></section></aside></div></form>`;
}

function field(name, label, value = '', required = false, type = 'text', hint = '') {
  return `<label class="setting-field">${label}${hint ? `<span class="hint">${escapeHtml(hint)}</span>` : ''}<input class="admin-input" name="${name}" type="${type}" ${type === 'number' ? 'min="0" step="0.01"' : ''} ${required ? 'required' : ''} value="${escapeHtml(value)}"></label>`;
}

async function renderProductEditor() {
  await openProductEditor(typeof adminState.currentProduct === 'string' ? adminState.currentProduct : null);
}

async function renderMedia() {
  const params = new URLSearchParams({ page: adminState.mediaPage, limit: 24, search: adminState.search });
  const data = await api(`/api/admin/media?${params}`);
  content.innerHTML = `${pageHeader('Media library', `Uploaded images are stored on ${escapeHtml(data.storage.provider)}. ${data.storage.persistentAcrossDeploys ? 'Files persist across deployments.' : 'Local uploads need persistent deployment storage or R2.'}`, '<label class="admin-button primary upload-button">＋ Upload images<input id="media-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden></label>')}
    <section class="panel"><div class="panel-body"><div class="toolbar"><input class="admin-input" id="media-search" value="${escapeHtml(adminState.search)}" placeholder="Search filenames or titles"><button class="small-button" data-media-search>Search</button><span class="toolbar-spacer"></span><span class="table-sub">Max file size ${Math.round((Number(window.MAX_IMAGE_BYTES) || 8388608) / 1048576)} MB · JPEG, PNG, WebP, AVIF</span></div><label class="drop-zone" id="drop-zone">Drop images here or click to choose<input id="media-drop-input" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden></label><div class="upload-progress" id="upload-progress" hidden><span></span></div><div id="upload-message" class="table-sub"></div><div class="media-grid" style="margin-top:14px">${data.media.map(item => mediaCard(item)).join('') || '<div class="no-data">No images yet. Upload the client-provided assets here.</div>'}</div><div class="pagination"><span>${data.total} images · page ${data.page} of ${Math.max(1, data.pages)}</span><div class="pagination-actions"><button class="small-button" data-media-page="${data.page - 1}" ${data.page <= 1 ? 'disabled' : ''}>Previous</button><button class="small-button" data-media-page="${data.page + 1}" ${data.page >= data.pages ? 'disabled' : ''}>Next</button></div></div></div></section>`;
}

function mediaCard(media) {
  return `<article class="media-card"><div class="media-thumb"><img src="${escapeHtml(media.url)}" alt="${escapeHtml(media.alt || media.filename)}" loading="lazy"></div><div class="media-info"><b>${escapeHtml(media.filename)}</b><small>${Number(media.width)}×${Number(media.height)} · ${(Number(media.size) / 1024).toFixed(0)} KB</small><small>${escapeHtml(media.alt || 'No alt text')}</small><div class="row-actions" style="margin-top:7px"><button data-media-url="${escapeHtml(media.url)}">Copy URL</button><button data-media-edit="${escapeHtml(media._id)}">Edit alt</button><label class="small-button">Replace<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" data-media-replace="${escapeHtml(media._id)}" hidden></label><button data-media-delete="${escapeHtml(media._id)}">Delete</button></div></div></article>`;
}

async function renderCategories() {
  const data = await api('/api/admin/categories'); adminState.categories = data.categories; adminState.brands = data.brands;
  content.innerHTML = `${pageHeader('Categories & brands', 'Organize verified inventory and public catalogue filters.')}
  <div class="dashboard-columns"><section class="panel"><div class="panel-heading"><h2>Product categories</h2></div><div class="panel-body"><form id="category-form" class="toolbar"><input class="admin-input" name="name" required placeholder="New category name"><input class="admin-input" name="description" placeholder="Description"><button class="admin-button primary">Add category</button></form><div class="table-wrap"><table><thead><tr><th>Category</th><th>Slug</th><th>Visibility</th><th>Products</th><th></th></tr></thead><tbody>${data.categories.map(category => `<tr><td><span class="table-title">${escapeHtml(category.name)}</span><span class="table-sub">${escapeHtml(category.description || '')}</span></td><td>${escapeHtml(category.slug)}</td><td>${statusPill(category.published ? 'published' : 'draft')}</td><td class="category-usage" data-category="${escapeHtml(category.slug)}">—</td><td><div class="row-actions"><button data-category-edit="${escapeHtml(category._id)}">Edit</button><button data-category-visibility="${escapeHtml(category._id)}" data-published="${!category.published}">${category.published ? 'Hide' : 'Publish'}</button><button data-category-delete="${escapeHtml(category._id)}">Delete</button></div></td></tr>`).join('') || '<tr><td colspan="5" class="empty-row">No categories added.</td></tr>'}</tbody></table></div></div></section>
  <section class="panel"><div class="panel-heading"><h2>Brands</h2></div><div class="panel-body"><form id="brand-form" class="toolbar"><input class="admin-input" name="name" required placeholder="Brand name"><button class="admin-button primary">Add brand</button></form>${data.brands.map(brand => `<div class="account-row"><span><b>${escapeHtml(brand.name)}</b><small class="table-sub">${escapeHtml(brand.slug)}</small></span>${statusPill(brand.published ? 'published' : 'draft')}<div class="row-actions"><button data-brand-edit="${escapeHtml(brand._id)}">Edit</button><button data-brand-delete="${escapeHtml(brand._id)}">Delete</button></div></div>`).join('') || '<div class="no-data">No managed brands yet.</div>'}</div></section></div>`;
  const products = await api('/api/admin/products?limit=100');
  document.querySelectorAll('.category-usage').forEach(node => node.textContent = products.products.filter(product => product.category === node.dataset.category).length);
}

async function renderOrders() {
  const params = new URLSearchParams({ page: adminState.page, limit: 20, search: adminState.search, status: adminState.status });
  const data = await api(`/api/admin/orders?${params}`);
  content.innerHTML = `${pageHeader('Order requests', 'A recorded request does not prove the WhatsApp message was sent.', '<button class="admin-button secondary" data-export-orders>Export CSV ↓</button>')}
    <div class="panel"><div class="panel-body"><div class="toolbar"><input class="admin-input" id="orders-search" value="${escapeHtml(adminState.search)}" placeholder="Reference, customer, product"><select class="admin-select" id="orders-status"><option value="">All statuses</option>${['request-recorded','confirmed','processing','shipped','delivered','cancelled'].map(status => `<option value="${status}" ${adminState.status === status ? 'selected' : ''}>${status.replaceAll('-', ' ')}</option>`).join('')}</select><button class="small-button" data-order-search>Search</button></div><div class="table-wrap">${ordersTable(data.orders)}</div><div class="pagination"><span>${data.total} requests · page ${data.page} of ${Math.max(1, data.pages)}</span><div class="pagination-actions"><button class="small-button" data-page="${data.page - 1}" ${data.page <= 1 ? 'disabled' : ''}>Previous</button><button class="small-button" data-page="${data.page + 1}" ${data.page >= data.pages ? 'disabled' : ''}>Next</button></div></div></div></div><dialog class="admin-dialog" id="order-dialog"><div class="dialog-heading"><div><p class="admin-eyebrow">CUSTOMER REQUEST / PRIVATE</p><h2 id="order-dialog-title"></h2></div><button class="icon-button" data-close-dialog aria-label="Close">×</button></div><form id="order-edit-form"><input type="hidden" name="id"><div class="admin-form-grid"><label class="setting-field">Status<select name="status" class="admin-select">${['request-recorded','confirmed','processing','shipped','delivered','cancelled'].map(status => `<option value="${status}">${status.replaceAll('-', ' ')}</option>`).join('')}</select></label>${field('confirmedPrice', 'Confirmed price (USD)', '', false, 'number', 'Only enter once provided by owner')}<label class="setting-field full">Private notes<textarea class="admin-textarea" name="adminNotes" maxlength="3000"></textarea></label><label class="setting-field full">Shipping or delivery information<textarea class="admin-textarea" name="shippingInfo" maxlength="1000"></textarea></label><label class="setting-field full">Cancellation reason<textarea class="admin-textarea" name="cancelReason" maxlength="500"></textarea></label></div><div id="order-private-details" class="form-section"></div><div class="form-actions"><button class="admin-button secondary" type="button" data-close-dialog>Cancel</button><button class="admin-button primary">Save order</button></div></form></dialog>`;
}

async function renderHomepage() {
  const data = await api('/api/admin/settings'); adminState.settings = data.settings || {};
  const home = adminState.settings.homepage || {};
  content.innerHTML = `${pageHeader('Homepage editor', 'Change copy and image choices without editing page files.')}
  <form id="homepage-form" class="dashboard-columns"><section class="panel"><div class="panel-heading"><h2>Hero content</h2></div><div class="panel-body"><div class="admin-form-grid">${field('headline', 'Headline', home.headline || 'Find your next strike.', true)}<label class="setting-field full">Subtitle<textarea class="admin-textarea" name="subtitle" maxlength="500">${escapeHtml(home.subtitle || '')}</textarea></label>${field('primaryButtonText', 'Primary button label', home.primaryButtonText || 'Explore equipment')} ${field('primaryButtonUrl', 'Primary button destination', home.primaryButtonUrl || '#catalogue')}<label class="setting-field full">Hero image URL<input class="admin-input" name="heroImage" value="${escapeHtml(home.heroImage || '')}"><button class="small-button" type="button" data-pick-image="homepage">Choose image from media</button></label><div class="image-slot" id="homepage-image-preview">${home.heroImage ? `<img src="${escapeHtml(home.heroImage)}" alt="Homepage preview">` : '<span class="image-empty">Current CSS artwork stays in place until a client image is selected.</span>'}</div>${field('footerText', 'Homepage supporting note', home.footerText || '')}</div><div class="form-actions"><button class="admin-button secondary" type="button" data-preview-home>Preview public page ↗</button><button class="admin-button primary">Save homepage</button></div></div></section><aside class="panel"><div class="panel-heading"><h2>Published preview</h2></div><div class="panel-body"><p id="homepage-preview-title" class="stat-value">${escapeHtml(home.headline || 'Find your next strike.')}</p><p id="homepage-preview-subtitle" class="table-sub">${escapeHtml(home.subtitle || 'The current public homepage uses the existing store design.')}</p><p class="table-sub">Changes take effect on the public website after save. No custom script content is accepted.</p></div></aside></form>`;
}

async function renderSettings() {
  const data = await api('/api/admin/settings'); adminState.settings = data.settings || {};
  const s = adminState.settings; const site = s.site || {}; const branding = s.branding || {}; const seo = s.seo || {}; const wa = s.whatsapp || {};
  content.innerHTML = `${pageHeader('Website settings', 'Control store identity, announcement, metadata and enquiry routing.')}
  <form id="settings-form"><section class="panel"><div class="panel-body">
    <div class="form-section"><h3>Store identity</h3><div class="admin-form-grid">${field('siteName','Website name',site.name || 'BowlersMechanic',true)}${field('contactEmail','Contact email',site.contactEmail || '')}${field('contactPhone','Contact phone',site.contactPhone || '')}<label class="setting-field full">Announcement bar<input class="admin-input" name="announcement" value="${escapeHtml(site.announcement || '')}" maxlength="240"></label><label class="check-row"><input type="checkbox" name="announcementVisible" ${site.announcementVisible ? 'checked' : ''}> Show announcement</label></div></div>
    <div class="form-section"><h3>Branding and SEO</h3><div class="admin-form-grid">${field('colorInk','Ink color',branding.colors?.ink || '#171717')}${field('colorOrange','Accent color',branding.colors?.orange || '#f15b2a')}${field('colorPurple','Subtle accent',branding.colors?.purple || '#8e71ad')}${field('seoTitle','SEO page title',seo.title || 'BowlersMechanic | Bowling Equipment')}${field('seoDescription','SEO description',seo.description || '')}${field('footer','Footer copy',(s.footer || {}).text || 'Good gear. Better frames.')}</div></div>
    <div class="form-section"><h3>WhatsApp ordering</h3><div class="status-strip"><span class="status-item"><i class="status-light ${data.whatsappConfigured ? '' : 'warning'}"></i>${data.whatsappConfigured ? 'A usable number is configured' : 'No usable complete number configured'}</span><span class="table-sub">The destination is always read and validated on the server.</span></div><div class="admin-form-grid">${field('whatsappNumber','WhatsApp number to receive orders',wa.number || '',false,'tel','Include country code; digits only. Save these settings to change the storefront destination.')}${field('orderReferencePrefix','Order reference prefix',wa.referencePrefix || 'BM')}<label class="setting-field full">Greeting message<textarea class="admin-textarea" name="whatsappGreeting">${escapeHtml(wa.greeting || '')}</textarea></label><label class="setting-field full">Default order message<textarea class="admin-textarea" name="whatsappMessage">${escapeHtml(wa.defaultMessage || '')}</textarea></label><label class="check-row"><input type="checkbox" name="whatsappEnabled" ${wa.enabled ? 'checked' : ''}> Enable WhatsApp enquiries</label></div></div>
    <div class="form-actions"><button class="admin-button primary">Save website and WhatsApp settings</button></div>
  </div></section></form>`;
}

async function renderAccounts() {
  if (adminState.admin.role !== 'owner') { content.innerHTML = `${pageHeader('Admin accounts', 'Account creation is restricted to the store owner.')}<section class="panel"><div class="no-data">Only the owner account can create or deactivate administrators.</div></section>`; return; }
  const data = await api('/api/admin/admins');
  content.innerHTML = `${pageHeader('Admin accounts', 'Create named admin access for trusted store operators.')}
  <div class="dashboard-columns"><section class="panel"><div class="panel-heading"><h2>Accounts</h2></div><div class="panel-body">${data.admins.map(admin => `<div class="account-row"><span><b>${escapeHtml(admin.name)}</b><small class="table-sub">${escapeHtml(admin.email)} · ${escapeHtml(admin.role)} · last login ${escapeHtml(fmtDate(admin.lastLoginAt))}</small></span>${statusPill(admin.active ? 'published' : 'draft')}<button class="small-button" data-toggle-admin="${escapeHtml(admin._id)}" data-active="${!admin.active}">${admin.active ? 'Deactivate' : 'Activate'}</button></div>`).join('')}</div></section><section class="panel"><div class="panel-heading"><h2>Add admin</h2></div><div class="panel-body"><form id="admin-create-form" class="admin-form-grid">${field('name','Name','',true)}${field('email','Email','',true,'email')}${field('password','Temporary password','',true,'password','At least 12 characters') }<div class="setting-field full"><button class="admin-button primary">Create account</button></div></form><p class="table-sub">The new admin should change this password after first sign in.</p></div></section></div>`;
}

function renderPassword() {
  content.innerHTML = `${pageHeader('Change password', 'Choose a unique password. Sessions remain stored server-side.')}
  <section class="panel"><div class="panel-body"><form id="password-form" class="admin-form-grid" style="max-width:620px">${field('currentPassword','Current password','',true,'password')}${field('newPassword','New password','',true,'password','12–128 characters')}${field('confirmPassword','Confirm new password','',true,'password')}<div class="setting-field full"><button class="admin-button primary">Update password</button></div></form></div></section>`;
}

function updateSelectedImage(url, media, target) {
  if (target === 'image') {
    const form = document.querySelector('#product-form'); form.elements.image.value = url; form.elements.imageAlt.value = media.alt || media.title || media.filename;
    document.querySelector('#product-image-preview').innerHTML = `<img src="${escapeHtml(url)}" alt="${escapeHtml(media.alt || media.filename)}">`;
  } else if (target === 'homepage') {
    const input = document.querySelector('#homepage-form').elements.heroImage; input.value = url;
    document.querySelector('#homepage-image-preview').innerHTML = `<img src="${escapeHtml(url)}" alt="Homepage preview">`;
  } else if (target === 'siteLogo' || target === 'favicon') {
    const form = document.querySelector('#settings-form');
    const fieldName = target === 'siteLogo' ? 'logoUrl' : 'faviconUrl';
    form.elements[fieldName].value = url;
    const preview = document.querySelector(`#${target}-preview`);
    if (preview) preview.innerHTML = `<img src="${escapeHtml(url)}" alt="${target === 'siteLogo' ? 'Logo preview' : 'Favicon preview'}">`;
  } else if (target === 'gallery') {
    const form = document.querySelector('#product-form');
    const gallery = readProductGallery(form);
    if (gallery.length >= 12) {
      notify('A product can have up to 12 gallery photos.', 'error');
    } else if (!gallery.some(item => item.url === url)) {
      gallery.push({ url, alt: media.alt || media.filename });
      saveProductGallery(form, gallery);
    }
  }
  mediaPicker.close();
}

function readProductGallery(form = document.querySelector('#product-form')) {
  try { return JSON.parse(form.elements.gallery.value || '[]'); } catch { return []; }
}

function saveProductGallery(form, gallery) {
  form.elements.gallery.value = JSON.stringify(gallery);
  document.querySelector('#gallery-preview').innerHTML = gallery.map((item, index) => `<span class="gallery-preview-item" style="display:inline-flex;flex-direction:column;gap:4px;vertical-align:top;margin:0 8px 8px 0"><img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.alt)}" style="width:66px;height:60px;object-fit:cover"><button type="button" class="small-button" data-remove-gallery="${index}" aria-label="Remove gallery photo ${index + 1}">Remove</button></span>`).join('');
}

function addProductGalleryMedia(mediaItems) {
  const form = document.querySelector('#product-form');
  if (!form) return;
  const gallery = readProductGallery(form);
  const newItems = mediaItems.filter(media => media?.url && !gallery.some(item => item.url === media.url));
  const availableSlots = Math.max(0, 12 - gallery.length);
  gallery.push(...newItems.slice(0, availableSlots).map(media => ({ url: media.url, alt: media.alt || media.title || media.filename })));
  saveProductGallery(form, gallery);
  if (newItems.length > availableSlots) notify('Only the first photos that fit within the 12-photo gallery limit were attached.', 'error');
  else notify(`${Math.min(newItems.length, availableSlots)} photo${Math.min(newItems.length, availableSlots) === 1 ? '' : 's'} attached to this product. Save the product to keep the changes.`);
}

async function openMediaPicker(target) {
  const data = await api('/api/admin/media?limit=60');
  document.querySelector('#picker-grid').innerHTML = data.media.map(media => `<button class="picker-item" type="button" data-choose-media="${escapeHtml(media._id)}"><img src="${escapeHtml(media.url)}" alt="${escapeHtml(media.alt || media.filename)}"><small>${escapeHtml(media.filename)}</small></button>`).join('') || '<div class="no-data">Upload an image before selecting it.</div>';
  document.querySelectorAll('[data-choose-media]').forEach(button => button.addEventListener('click', () => {
    const media = data.media.find(item => item._id === button.dataset.chooseMedia);
    if (media) updateSelectedImage(media.url, media, target);
  }));
  mediaPicker.showModal();
}

async function editOrder(id) {
  const data = await api(`/api/admin/orders/${encodeURIComponent(id)}`);
  const order = data.order;
  if (!order) return notify('Order request not found.', 'error');
  const form = document.querySelector('#order-edit-form');
  form.elements.id.value = order._id;
  form.elements.status.value = order.status;
  form.elements.confirmedPrice.value = order.confirmedPrice ?? '';
  form.elements.adminNotes.value = order.adminNotes || '';
  form.elements.shippingInfo.value = order.shippingInfo || '';
  form.elements.cancelReason.value = order.cancelReason || '';
  document.querySelector('#order-dialog-title').textContent = order.reference;
  document.querySelector('#order-private-details').innerHTML = `<p><b>${escapeHtml(order.customer.name)}</b> · ${escapeHtml(order.customer.phone)} ${order.customer.email ? `· ${escapeHtml(order.customer.email)}` : ''}</p><p>${escapeHtml(order.product.brand)} ${escapeHtml(order.product.name)} × ${Number(order.product.quantity)} · ${Number.isFinite(order.product.unitPrice) ? `$${order.product.unitPrice.toFixed(2)} USD` : 'Contact for price'}</p><p class="table-sub">Submitted ${escapeHtml(fmtDate(order.createdAt))}. This records the website request only, not WhatsApp delivery.</p><h3>History</h3>${(order.history || []).map(item => `<div class="account-row">${statusPill(item.status)}<span class="table-sub">${escapeHtml(fmtDate(item.changedAt))} ${escapeHtml(item.note || '')}</span></div>`).join('')}`;
  document.querySelector('#order-dialog').showModal();
}

function collectProduct(form, status) {
  const data = new FormData(form);
  let specifications = [];
  for (const line of String(data.get('specifications') || '').split('\n')) { const pos = line.indexOf(':'); if (pos > 0) specifications.push({ name: line.slice(0, pos).trim(), value: line.slice(pos + 1).trim() }); }
  let gallery = []; try { gallery = JSON.parse(data.get('gallery') || '[]'); } catch {}
  return {
    name: data.get('name'), brand: data.get('brand'), slug: data.get('slug'), sku: data.get('sku'), category: data.get('category'),
    shortDescription: data.get('shortDescription'), fullDescription: data.get('fullDescription'), description: data.get('shortDescription'),
    image: data.get('image') || null, imageAlt: data.get('imageAlt'), gallery, price: data.get('price') || null, salePrice: data.get('salePrice') || null,
    priceConfirmed: data.has('priceConfirmed'), stockQuantity: data.get('stockQuantity') || null, lowStockThreshold: data.get('lowStockThreshold') || null,
    availability: data.get('availability'), condition: data.get('condition'), specifications, tags: String(data.get('tags') || '').split(',').map(tag => tag.trim()).filter(Boolean),
    featured: data.has('featured'), status
  };
}

async function uploadFiles(files, target = null) {
  if (!files?.length) return;
  const form = new FormData(); for (const file of files) form.append('images', file);
  const progress = document.querySelector('#upload-progress'); const bar = progress?.querySelector('span'); const message = document.querySelector('#upload-message');
  if (progress) progress.hidden = false;
  if (message) message.textContent = `Uploading ${files.length} image${files.length > 1 ? 's' : ''}…`;
  const sendUpload = async retried => {
    const xhr = new XMLHttpRequest(); xhr.open('POST', apiUrl('/api/admin/media')); xhr.withCredentials = true; xhr.setRequestHeader('X-CSRF-Token', csrf.token);
    xhr.upload.onprogress = event => { if (event.lengthComputable && bar) bar.style.width = `${Math.round(event.loaded / event.total * 100)}%`; };
    xhr.onload = async () => {
      try {
        const data = JSON.parse(xhr.responseText || '{}');
        if (xhr.status === 403 && !retried) {
          await refreshCsrf();
          if (!csrf.token) throw new Error('Your security token expired. Sign in again and retry the upload.');
          await sendUpload(true);
          return;
        }
        if (xhr.status < 200 || xhr.status >= 300) throw new Error(data.error || 'Upload failed.');
        if (target === 'gallery') {
          addProductGalleryMedia(data.media);
        } else if (target === 'image') {
          const media = data.media[0];
          updateSelectedImage(media.url, media, 'image');
          notify('Equipment photo uploaded and attached to this product. Save the product to keep the change.');
        } else {
          notify(`${data.media.length} image${data.media.length === 1 ? '' : 's'} uploaded.`);
          await renderMedia();
        }
      } catch (error) { notify(error.message, 'error'); if (message) message.textContent = error.message; }
    };
    xhr.onerror = () => notify('Upload failed because the network connection was interrupted.', 'error');
    xhr.send(form);
  };
  await sendUpload(false);
}

function askConfirm(copy, action) {
  const dialog = document.querySelector('#confirm-dialog');
  document.querySelector('#confirm-copy').textContent = copy;
  const button = document.querySelector('#confirm-action');
  button.onclick = async () => { dialog.close(); await action(); };
  dialog.showModal();
}

async function saveSettings(form, homepageOnly = false) {
  const data = new FormData(form);
  const current = adminState.settings || {};
  if (homepageOnly) {
    current.homepage = { ...(current.homepage || {}), headline: data.get('headline'), subtitle: data.get('subtitle'), primaryButtonText: data.get('primaryButtonText'), primaryButtonUrl: data.get('primaryButtonUrl'), secondaryButtonText: data.get('secondaryButtonText'), secondaryButtonUrl: data.get('secondaryButtonUrl'), heroImage: data.get('heroImage') || null, footerText: data.get('footerText') };
  } else {
    current.site = { ...(current.site || {}), name: data.get('siteName'), contactEmail: data.get('contactEmail'), contactPhone: data.get('contactPhone'), currency: 'USD', announcement: data.get('announcement'), announcementVisible: data.has('announcementVisible') };
    current.branding = { ...(current.branding || {}), colors: { ink: data.get('colorInk'), orange: data.get('colorOrange'), purple: data.get('colorPurple') } };
    current.seo = { title: data.get('seoTitle'), description: data.get('seoDescription') };
    current.footer = { text: data.get('footer') };
    current.whatsapp = { ...(current.whatsapp || {}), number: data.get('whatsappNumber'), referencePrefix: data.get('orderReferencePrefix') || 'BM', greeting: data.get('whatsappGreeting'), defaultMessage: data.get('whatsappMessage'), enabled: data.has('whatsappEnabled') };
  }
  const result = await api('/api/admin/settings', { method: 'PUT', body: { settings: current } }); adminState.settings = result.settings;
}

async function handleSubmit(event) {
  const form = event.target;
  if (form.id === 'login-form') {
    event.preventDefault(); const button = form.querySelector('button'); button.disabled = true;
    try {
      const data = new FormData(form); const result = await api('/api/admin/login', { method: 'POST', body: { email: data.get('email'), password: data.get('password') } });
      csrf.token = result.csrfToken; form.reset(); showApp(result.admin);
    } catch (error) { document.querySelector('#login-message').textContent = error.message; }
    finally { button.disabled = false; }
  } else if (form.id === 'product-form') {
    event.preventDefault();
    const status = event.submitter?.value === 'draft' ? 'draft' : 'published';
    try {
      const body = collectProduct(form, status); const url = adminState.currentProduct ? `/api/admin/products/${adminState.currentProduct}` : '/api/admin/products';
      await api(url, { method: adminState.currentProduct ? 'PUT' : 'POST', body }); notify(status === 'draft' ? 'Draft saved.' : 'Product published.'); adminState.currentProduct = null; loadView('products');
    } catch (error) { notify(error.message, 'error'); }
  } else if (form.id === 'category-form') {
    event.preventDefault(); const data = new FormData(form);
    try { await api('/api/admin/categories', { method: 'POST', body: { name: data.get('name'), description: data.get('description') } }); notify('Category added.'); loadView('categories'); } catch (error) { notify(error.message, 'error'); }
  } else if (form.id === 'brand-form') {
    event.preventDefault(); const data = new FormData(form);
    try { await api('/api/admin/brands', { method: 'POST', body: { name: data.get('name') } }); notify('Brand added.'); loadView('categories'); } catch (error) { notify(error.message, 'error'); }
  } else if (form.id === 'homepage-form') {
    event.preventDefault(); try { await saveSettings(form, true); notify('Homepage content saved.'); } catch (error) { notify(error.message, 'error'); }
  } else if (form.id === 'settings-form') {
    event.preventDefault(); try { await saveSettings(form); notify('Website settings saved.'); } catch (error) { notify(error.message, 'error'); }
  } else if (form.id === 'order-edit-form') {
    event.preventDefault(); const data = new FormData(form); const body = Object.fromEntries(data.entries()); delete body.id;
    try { await api(`/api/admin/orders/${data.get('id')}`, { method: 'PUT', body }); document.querySelector('#order-dialog').close(); notify('Order request updated.'); loadView('orders'); } catch (error) { notify(error.message, 'error'); }
  } else if (form.id === 'password-form') {
    event.preventDefault(); const data = new FormData(form); if (data.get('newPassword') !== data.get('confirmPassword')) return notify('New password confirmation does not match.', 'error');
    try { await api('/api/admin/password', { method: 'PUT', body: { currentPassword: data.get('currentPassword'), newPassword: data.get('newPassword') } }); form.reset(); notify('Password updated.'); } catch (error) { notify(error.message, 'error'); }
  } else if (form.id === 'admin-create-form') {
    event.preventDefault(); const data = new FormData(form);
    try { await api('/api/admin/admins', { method: 'POST', body: Object.fromEntries(data.entries()) }); notify('Admin account created.'); loadView('account'); } catch (error) { notify(error.message, 'error'); }
  }
}

async function handleClick(event) {
  const target = event.target.closest('button,a,label'); if (!target) return;
  if (target.dataset.view) { if (target.dataset.view === 'product') adminState.currentProduct = null; loadView(target.dataset.view); document.querySelector('#sidebar').classList.remove('open'); }
  if (target.dataset.go) loadView(target.dataset.go);
  if (target.hasAttribute('data-create-product')) { adminState.currentProduct = null; await openProductEditor(); }
  if (target.hasAttribute('data-refresh')) { adminState.search = document.querySelector('#product-search').value; adminState.status = document.querySelector('#product-status').value; adminState.page = 1; loadView('products'); }
  if (target.dataset.page) { adminState.page = Math.max(1, Number(target.dataset.page)); loadView(adminState.view); }
  if (target.hasAttribute('data-retry')) loadView();
  if (target.dataset.editProduct) { try { await openProductEditor(target.dataset.editProduct); } catch (error) { notify(error.message, 'error'); } }
  if (target.dataset.duplicateProduct) { try { await api(`/api/admin/products/${target.dataset.duplicateProduct}/duplicate`, { method: 'POST', body: {} }); notify('Draft copy created.'); loadView('products'); } catch (error) { notify(error.message, 'error'); } }
  if (target.dataset.deleteProduct) askConfirm('Delete this product permanently? Existing order records will remain.', async () => { try { await api(`/api/admin/products/${target.dataset.deleteProduct}`, { method: 'DELETE' }); notify('Product deleted.'); loadView('products'); } catch (error) { notify(error.message, 'error'); } });
  if (target.hasAttribute('data-bulk')) {
    const ids = [...document.querySelectorAll('.product-check:checked')].map(input => input.value); const action = document.querySelector('#bulk-action').value;
    if (!action || !ids.length) return notify('Select products and a bulk action.', 'error');
    askConfirm(`${action} ${ids.length} selected product${ids.length === 1 ? '' : 's'}?`, async () => { try { const result = await api('/api/admin/products/bulk', { method: 'POST', body: { ids, action } }); notify(`${result.changed} products updated.`); loadView('products'); } catch (error) { notify(error.message, 'error'); } });
  }
  if (target.dataset.pickImage) { try { await openMediaPicker(target.dataset.pickImage); } catch (error) { notify(error.message, 'error'); } }
  if (target.dataset.chooseMedia) {}
  if (target.dataset.mediaUrl) { try { await navigator.clipboard.writeText(target.dataset.mediaUrl); notify('Image URL copied.'); } catch { notify(target.dataset.mediaUrl); } }
  if (target.dataset.mediaDelete) askConfirm('Delete this uploaded image? Images referenced by a product or site content are protected.', async () => { try { await api(`/api/admin/media/${target.dataset.mediaDelete}`, { method: 'DELETE' }); notify('Image deleted.'); loadView('media'); } catch (error) { notify(error.message, 'error'); } });
  if (target.dataset.mediaEdit) { const mediaId = target.dataset.mediaEdit; const alt = prompt('Alternative text for this image:'); if (alt !== null) { const title = prompt('Media title:') || ''; try { await api(`/api/admin/media/${mediaId}`, { method: 'PUT', body: { alt, title } }); notify('Image details updated.'); loadView('media'); } catch (error) { notify(error.message, 'error'); } } }
  if (target.dataset.mediaSearch) { adminState.search = document.querySelector('#media-search').value; adminState.mediaPage = 1; loadView('media'); }
  if (target.dataset.mediaPage) { adminState.mediaPage = Math.max(1, Number(target.dataset.mediaPage)); loadView('media'); }
  if (target.dataset.order) editOrder(target.dataset.order);
  if (target.dataset.orderDelete) askConfirm(`Permanently delete order ${target.dataset.orderReference || ''}? This cannot be undone.`, async () => { try { await api(`/api/admin/orders/${target.dataset.orderDelete}`, { method: 'DELETE' }); notify('Order deleted.'); loadView('orders'); } catch (error) { notify(error.message, 'error'); } });
  if (target.hasAttribute('data-order-search')) { adminState.search = document.querySelector('#orders-search').value; adminState.status = document.querySelector('#orders-status').value; adminState.page = 1; loadView('orders'); }
  if (target.hasAttribute('data-export-orders')) { window.location.assign(apiUrl('/api/admin/orders.csv')); }
  if (target.hasAttribute('data-preview-home')) window.open('/', '_blank', 'noopener');
  if (target.dataset.categoryEdit) {
    const category = adminState.categories.find(item => item._id === target.dataset.categoryEdit);
    if (category) {
      const name = prompt('Category name:', category.name); if (name === null) return;
      const description = prompt('Category description:', category.description || ''); if (description === null) return;
      const slug = prompt('URL slug:', category.slug); if (slug === null) return;
      try { await api(`/api/admin/categories/${category._id}`, { method: 'PUT', body: { ...category, name, description, slug } }); notify('Category updated.'); loadView('categories'); } catch (error) { notify(error.message, 'error'); }
    }
  }
  if (target.dataset.categoryVisibility) {
    const category = adminState.categories.find(item => item._id === target.dataset.categoryVisibility);
    if (category) { try { await api(`/api/admin/categories/${category._id}`, { method: 'PUT', body: { ...category, published: target.dataset.published === 'true' } }); notify('Category visibility updated.'); loadView('categories'); } catch (error) { notify(error.message, 'error'); } }
  }
  if (target.dataset.brandEdit) {
    const brand = adminState.brands.find(item => item._id === target.dataset.brandEdit);
    if (brand) { const name = prompt('Brand name:', brand.name); if (name !== null) { try { await api(`/api/admin/brands/${brand._id}`, { method: 'PUT', body: { ...brand, name } }); notify('Brand updated.'); loadView('categories'); } catch (error) { notify(error.message, 'error'); } } }
  }
  if (target.dataset.brandDelete) askConfirm('Delete this brand? Brands assigned to products are protected.', async () => { try { await api(`/api/admin/brands/${target.dataset.brandDelete}`, { method: 'DELETE' }); notify('Brand deleted.'); loadView('categories'); } catch (error) { notify(error.message, 'error'); } });
  if (target.dataset.categoryDelete) askConfirm('Delete this category? If products use it, the server will prevent deletion until you reassign them.', async () => { try { await api(`/api/admin/categories/${target.dataset.categoryDelete}`, { method: 'DELETE', body: {} }); notify('Category deleted.'); loadView('categories'); } catch (error) { notify(error.message, 'error'); } });
  if (target.dataset.toggleAdmin) { const active = target.dataset.active === 'true'; askConfirm(`${active ? 'Activate' : 'Deactivate'} this administrator?`, async () => { try { await api(`/api/admin/admins/${target.dataset.toggleAdmin}`, { method: 'PUT', body: { active } }); notify('Admin account updated.'); loadView('account'); } catch (error) { notify(error.message, 'error'); } }); }
  if (target.hasAttribute('data-close-dialog')) target.closest('dialog')?.close();
}

document.addEventListener('submit', handleSubmit);
document.addEventListener('click', event => { handleClick(event).catch(error => notify(error.message, 'error')); });
document.addEventListener('click', event => {
  const removeButton = event.target.closest('[data-remove-gallery]');
  if (!removeButton) return;
  const form = document.querySelector('#product-form');
  const gallery = readProductGallery(form);
  gallery.splice(Number(removeButton.dataset.removeGallery), 1);
  saveProductGallery(form, gallery);
});
document.addEventListener('change', event => {
  if (event.target.id === 'media-file-input' || event.target.id === 'media-drop-input') uploadFiles(event.target.files);
  if (event.target.id === 'product-image-file-input') uploadFiles(event.target.files, 'image');
  if (event.target.id === 'product-gallery-file-input') uploadFiles(event.target.files, 'gallery');
  if (event.target.id === 'select-all') document.querySelectorAll('.product-check').forEach(input => { input.checked = event.target.checked; });
  if (event.target.matches('[data-media-replace]') && event.target.files?.[0]) {
    const form = new FormData(); form.append('image', event.target.files[0]);
    api(`/api/admin/media/${event.target.dataset.mediaReplace}/file`, { method: 'PUT', body: form }).then(() => { notify('Image replaced.'); loadView('media'); }).catch(error => notify(error.message, 'error'));
  }
});
document.addEventListener('input', event => {
  if (event.target.matches('[name="headline"]')) document.querySelector('#homepage-preview-title').textContent = event.target.value;
  if (event.target.matches('[name="subtitle"]')) document.querySelector('#homepage-preview-subtitle').textContent = event.target.value;
});
document.addEventListener('submit', event => { if (event.target.id !== 'login-form' && event.target.id !== 'product-form' && event.target.id !== 'category-form' && event.target.id !== 'brand-form' && event.target.id !== 'homepage-form' && event.target.id !== 'settings-form' && event.target.id !== 'order-edit-form' && event.target.id !== 'password-form' && event.target.id !== 'admin-create-form') event.preventDefault(); });

document.querySelector('#drop-zone')?.addEventListener('dragover', event => { event.preventDefault(); event.currentTarget.classList.add('dragover'); });
document.addEventListener('dragover', event => { if (event.target.closest('#drop-zone')) event.preventDefault(); });
document.addEventListener('dragleave', event => event.target.closest('#drop-zone')?.classList.remove('dragover'));
document.addEventListener('drop', event => { const zone = event.target.closest('#drop-zone'); if (!zone) return; event.preventDefault(); zone.classList.remove('dragover'); uploadFiles(event.dataTransfer.files); });
document.querySelector('#mobile-menu').addEventListener('click', () => document.querySelector('#sidebar').classList.toggle('open'));
document.querySelector('#logout-button').addEventListener('click', async () => { try { await api('/api/admin/logout', { method: 'POST', body: {} }); } catch {} csrf.token = ''; showLogin('You have signed out.'); });

(async function start() {
  try {
    await refreshCsrf();
    const result = await api('/api/admin/me');
    if (result.admin) showApp(result.admin); else showLogin(result.databaseConnected ? '' : 'The database is unavailable. Admin sign-in is temporarily disabled.');
  } catch { showLogin('The admin service is unavailable. Check the database connection and retry.'); }
})();
