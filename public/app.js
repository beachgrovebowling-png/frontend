const state = { products: [], category: 'all', query: '', whatsappConfigured: false, cart: loadCart() };
const API_BASE = String(window.__API_BASE__ || '').replace(/\/$/, '');
const productGrid = document.querySelector('#product-grid');
const catalogStatus = document.querySelector('#catalog-status');
const catalogNotice = document.querySelector('#catalog-notice');
const emptyState = document.querySelector('#empty-state');
const productSelect = document.querySelector('#product-select');
const orderForm = document.querySelector('#order-form');
if (orderForm) orderForm.action = apiUrl('/api/orders/whatsapp');
const formFeedback = document.querySelector('#form-feedback');
const dialog = document.querySelector('#product-dialog');
const cartDrawer = document.querySelector('#cart-drawer');
const cartItems = document.querySelector('#cart-items');
const cartToggle = document.querySelector('#cart-toggle');
const cartClose = document.querySelector('#cart-close');
const cartSubmit = document.querySelector('#cart-submit');
const cartCount = document.querySelector('#cart-count');
const cartSubtotal = document.querySelector('#cart-subtotal');
const menuToggle = document.querySelector('#menu-toggle');
const mainMenu = document.querySelector('#main-menu');

const categoryLabels = {
  all: 'All equipment',
  'performance-bowling-balls': 'Performance Bowling Balls',
  'beginner-bowling-balls': 'Beginner Bowling Balls',
  'spare-bowling-balls': 'Spare Bowling Balls',
  'bowling-ball-accessories': 'Bowling Ball Accessories',
  'bowling-ball': 'Bowling ball',
  accessory: 'Accessory',
  bag: 'Bag',
  apparel: 'Apparel',
  other: 'Equipment'
};

function apiUrl(path) {
  const target = String(path || '');
  if (!target) return target;
  if (/^https?:\/\//i.test(target) || target.startsWith('//')) return target;
  const normalized = target.startsWith('/') ? target : `/${target}`;
  return API_BASE ? `${API_BASE}${normalized}` : normalized;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function loadCart() {
  try {
    const raw = localStorage.getItem('bm-cart');
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function saveCart() {
  localStorage.setItem('bm-cart', JSON.stringify(state.cart));
  renderCart();
}

function cartItemPrice(product, quantity = 1) {
  if (!product) return null;
  if (String(product.slug || '').toLowerCase() === 'storm-ice-spare-ball') {
    return quantity >= 2 ? 170 : 100;
  }
  return Number.isFinite(product.price) ? product.price : null;
}

function cartPriceText(product) {
  if (String(product.slug || '').toLowerCase() === 'storm-ice-spare-ball') {
    return 'One ball: $100 USD / Two balls: $170 USD';
  }
  const price = Number.isFinite(product.price) ? product.price : null;
  return Number.isFinite(price) ? `$${price.toFixed(2)} USD` : 'Contact for price';
}

function priceLabel(product) {
  if (!product) return 'Contact for price';
  if (String(product.slug || '').toLowerCase() === 'storm-ice-spare-ball') {
    return '1 for $100 USD / 2 for $170 USD';
  }
  return Number.isFinite(product.price) ? `$${product.price.toFixed(2)} USD` : 'Contact for price';
}

function productVisual(product, dialogImage = false) {
  if (product.image) {
    return `<img class="${dialogImage ? '' : 'product-image'}" src="${escapeHtml(product.image)}" alt="${escapeHtml(`${product.brand} ${product.name}`)}" loading="lazy">`;
  }
  const initials = escapeHtml((product.brand || 'BM').slice(0, 2).toUpperCase());
  return `<div class="product-placeholder" data-category="${escapeHtml(product.category)}" role="img" aria-label="No product image supplied">${initials}</div>`;
}

function visibleProducts() {
  const search = state.query.toLocaleLowerCase();
  return state.products.filter(product => {
    const matchesCategory = state.category === 'all' || product.category === state.category;
    const matchesSearch = !search || `${product.name} ${product.brand} ${product.description}`.toLocaleLowerCase().includes(search);
    return matchesCategory && matchesSearch;
  });
}

function renderProducts() {
  const products = visibleProducts();
  productGrid.replaceChildren();
  emptyState.hidden = products.length > 0;
  products.forEach((product, index) => {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.style.animationDelay = `${Math.min(index * 60, 240)}ms`;
    card.innerHTML = `
      <div class="product-visual">
        ${productVisual(product)}
        <span class="product-tag ${product.featured ? 'featured' : ''}">${product.featured ? 'Featured' : escapeHtml(categoryLabels[product.category] || 'Equipment')}</span>
      </div>
      <div class="product-info">
        <p class="product-brand">${escapeHtml(product.brand)}</p>
        <div class="product-title-row"><h3 class="product-title">${escapeHtml(product.name)}</h3><p class="product-price">${escapeHtml(priceLabel(product))}</p></div>
        <p class="product-description">${escapeHtml(product.description)}</p>
        <div class="product-actions">
          <button class="product-order" type="button" data-order="${escapeHtml(product.id)}">Enquire <span aria-hidden="true">↗</span></button>
          <button class="product-details" type="button" data-details="${escapeHtml(product.id)}">Details</button>
          <button class="product-cart" type="button" data-cart="${escapeHtml(product.id)}">Add to cart</button>
        </div>
      </div>`;
    const image = card.querySelector('img');
    if (image) image.addEventListener('error', () => image.replaceWith(createMissingImageLabel()), { once: true });
    productGrid.append(card);
  });
  catalogStatus.textContent = `${products.length} ${products.length === 1 ? 'item' : 'items'} shown`;
}

function createMissingImageLabel() {
  const label = document.createElement('div');
  label.className = 'product-placeholder';
  label.setAttribute('role', 'img');
  label.setAttribute('aria-label', 'Product image unavailable');
  label.textContent = 'BM';
  return label;
}

function populateProductSelect() {
  productSelect.replaceChildren(new Option('Select equipment', ''));
  state.products.forEach(product => productSelect.add(new Option(`${product.brand} ${product.name} · ${priceLabel(product)}`, product.id)));
}

function applyPublicSettings(siteData) {
  if (!siteData) return;
  const site = siteData.site || {};
  const homepage = siteData.homepage || {};
  const branding = siteData.branding || {};
  const title = document.querySelector('#hero-title');
  if (title && homepage.headline) {
    const words = homepage.headline.trim().split(/\s+/);
    const firstLineLength = Math.ceil(words.length / 2);
    const firstLine = words.slice(0, firstLineLength).join(' ');
    const secondLine = words.slice(firstLineLength).join(' ');
    title.replaceChildren(document.createTextNode(firstLine));
    if (secondLine) {
      title.append(document.createElement('br'));
      const accent = document.createElement('span');
      accent.textContent = secondLine;
      title.append(accent);
    }
  }
  if (homepage.subtitle) document.querySelector('.hero-description').textContent = homepage.subtitle;
  const contactEmail = String(site.contactEmail || '').trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    const emailShopButton = document.querySelector('#email-shop-button');
    const mailto = `mailto:${contactEmail}`;
    if (emailShopButton) {
      emailShopButton.href = mailto;
      emailShopButton.setAttribute('aria-label', `Email the shop at ${contactEmail}`);
    }
  }
  if (siteData.seo?.title) document.title = siteData.seo.title;
  if (site.name) {
    document.title = `${site.name} | Bowling Equipment`;
    document.querySelectorAll('.brand-name').forEach(brand => { brand.textContent = site.name; });
  }
  if (branding.logo) {
    document.querySelectorAll('.brand-mark').forEach(mark => {
      const logo = document.createElement('img');
      logo.src = safeLocalOrHttpsUrl(branding.logo);
      logo.alt = site.name || 'BowlersMechanic';
      logo.className = 'brand-logo';
      mark.replaceWith(logo);
    });
  }
}

function safeLocalOrHttpsUrl(value) {
  const url = String(value || '');
  return url.startsWith('/') || url.startsWith('#') || /^https:\/\//i.test(url) ? url : '#catalogue';
}

function applyCategoryFilters(categories) {
  if (!Array.isArray(categories) || !categories.length) return;
  const list = document.querySelector('.filter-list');
  if (!list) return;
  list.replaceChildren();
  const allButton = document.createElement('button');
  allButton.type = 'button';
  allButton.className = 'filter-button is-active';
  allButton.dataset.category = 'all';
  allButton.setAttribute('aria-pressed', 'true');
  allButton.textContent = 'All equipment';
  list.append(allButton);
  categories.forEach(category => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter-button';
    button.dataset.category = category.slug;
    button.setAttribute('aria-pressed', 'false');
    button.textContent = category.name;
    list.append(button);
  });
}

async function loadProducts() {
  catalogStatus.textContent = 'Loading catalogue...';
  try {
    const response = await fetch(apiUrl('/api/products'), { headers: { Accept: 'application/json' }, credentials: API_BASE ? 'include' : 'same-origin' });
    if (!response.ok) throw new Error('The catalogue is temporarily unavailable. Please refresh shortly.');
    const data = await response.json();
    state.products = Array.isArray(data.products) ? data.products : [];
    state.whatsappConfigured = Boolean(data.whatsappConfigured);
    applyPublicSettings(data.site);
    applyCategoryFilters(data.categories || []);
    populateProductSelect();
    if (data.catalogMode === 'starter-preview') {
      catalogNotice.hidden = false;
      catalogNotice.textContent = 'Preview catalogue: MongoDB is not connected, so product updates are not persistent. The starter item needs verified details before publishing.';
    }
    if (!state.whatsappConfigured) {
      catalogNotice.hidden = false;
      const nextText = `${catalogNotice.textContent ? `${catalogNotice.textContent} ` : ''}WhatsApp ordering is unavailable until the owner’s complete international number is configured.`;
      catalogNotice.textContent = nextText;
    }
    renderProducts();
  } catch (error) {
    catalogStatus.textContent = error.message;
    productGrid.replaceChildren();
  }
}

function showProductDetails(product) {
  const brandElement = document.querySelector('#dialog-brand');
  brandElement.innerHTML = `${escapeHtml(product.brand)} / ${escapeHtml(categoryLabels[product.category] || 'Equipment')}`;
  document.querySelector('#dialog-title').textContent = product.name;
  document.querySelector('#dialog-price').textContent = priceLabel(product);
  document.querySelector('#dialog-description').textContent = product.description;
  document.querySelector('#dialog-availability').textContent = `Availability: ${product.availability === 'available' ? 'Available' : product.availability === 'out-of-stock' ? 'Currently unavailable' : 'Contact store for confirmation'}`;
  const imageArea = document.querySelector('#dialog-image');
  imageArea.innerHTML = productVisual(product, true);
  const image = imageArea.querySelector('img');
  if (image) image.addEventListener('error', () => image.replaceWith(createMissingImageLabel()), { once: true });

  const weightChoices = Array.isArray(product.weights) && product.weights.length ? `
    <label class="dialog-field">
      <span>Weight</span>
      <select id="dialog-weight-select">
        ${product.weights.map(weight => `<option value="${escapeHtml(weight.value)}" ${weight.available === false ? 'disabled' : ''}>${escapeHtml(weight.label)} ${weight.available === false ? '(unavailable)' : ''}</option>`).join('')}
      </select>
    </label>
  ` : '';

  const dialogContent = document.querySelector('.dialog-copy');
  const existingOffer = dialogContent.querySelector('.dialog-offer');
  if (existingOffer) existingOffer.remove();
  if (product.pricingRule === 'storm-ice-quantity-offer') {
    dialogContent.insertAdjacentHTML('beforeend', '<p class="dialog-offer">Offer: One ball $100 USD or two balls $170 USD.</p>');
  }
  const existingWeightSelector = dialogContent.querySelector('#dialog-weight-select');
  if (existingWeightSelector) existingWeightSelector.remove();
  if (weightChoices) {
    dialogContent.insertAdjacentHTML('beforeend', weightChoices);
  }

  document.querySelector('#dialog-order').dataset.productId = product.id;
  document.querySelector('#dialog-order').innerHTML = `Add to cart <span aria-hidden="true">↗</span>`;
  document.querySelector('#dialog-order').onclick = () => {
    const weightSelect = document.querySelector('#dialog-weight-select');
    const selectedWeight = weightSelect ? weightSelect.value : null;
    addToCart(product.id, selectedWeight ? Number(selectedWeight) : null, 1);
    dialog.close();
  };

  dialog.showModal();
}

function addToCart(productId, weightValue = null, quantity = 1) {
  const product = state.products.find(item => item.id === productId || item.slug === productId);
  if (!product) return;
  const cartKey = `${product.id}-${weightValue ?? 'standard'}`;
  const existing = state.cart.find(item => item.productId === product.id && String(item.weightValue ?? 'standard') === String(weightValue ?? 'standard'));
  if (existing) {
    existing.quantity += quantity;
  } else {
    state.cart.push({ productId: product.id, slug: product.slug, name: product.name, brand: product.brand, price: product.price, weightValue, quantity, cartKey });
  }
  saveCart();
  if (cartDrawer) cartDrawer.classList.add('is-open');
}

function removeCartItem(productId, weightValue = null) {
  state.cart = state.cart.filter(item => !(item.productId === productId && String(item.weightValue ?? 'standard') === String(weightValue ?? 'standard')));
  saveCart();
}

function renderCart() {
  if (!cartItems) return;
  const total = state.cart.reduce((sum, item) => {
    const product = state.products.find(entry => entry.id === item.productId || entry.slug === item.productId) || { slug: item.slug, price: item.price };
    const unitPrice = cartItemPrice(product, item.quantity);
    return sum + (Number.isFinite(unitPrice) ? unitPrice * item.quantity : 0);
  }, 0);
  cartCount.textContent = String(state.cart.reduce((count, item) => count + item.quantity, 0));
  cartSubtotal.textContent = `$${total.toFixed(2)}`;
  cartItems.replaceChildren();
  if (!state.cart.length) {
    cartItems.innerHTML = '<p class="cart-empty">Your cart is empty. Add bowling balls or accessories to get started.</p>';
    return;
  }
  state.cart.forEach(item => {
    const product = state.products.find(entry => entry.id === item.productId || entry.slug === item.productId) || { name: item.name, brand: item.brand, price: item.price, slug: item.slug };
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(product.brand || item.brand || 'Product')}</strong>
        <div>${escapeHtml(product.name || item.name || 'Item')}</div>
        <div class="cart-meta">${item.weightValue ? `Weight: ${escapeHtml(item.weightValue)} lb` : cartPriceText(product)}</div>
      </div>
      <div class="cart-controls">
        <div class="qty-selector">
          <button type="button" data-qty="decrease" data-product="${escapeHtml(item.productId)}" data-weight="${escapeHtml(String(item.weightValue ?? 'standard'))}">−</button>
          <span>${item.quantity}</span>
          <button type="button" data-qty="increase" data-product="${escapeHtml(item.productId)}" data-weight="${escapeHtml(String(item.weightValue ?? 'standard'))}">+</button>
        </div>
        <button class="cart-remove" type="button" data-remove="${escapeHtml(item.productId)}" data-weight="${escapeHtml(String(item.weightValue ?? 'standard'))}">Remove</button>
      </div>
    `;
    cartItems.append(row);
  });
}

function updateCartFromAction(productId, weightValue, delta) {
  const existing = state.cart.find(item => item.productId === productId && String(item.weightValue ?? 'standard') === String(weightValue ?? 'standard'));
  if (!existing) return;
  existing.quantity += delta;
  if (existing.quantity <= 0) removeCartItem(productId, weightValue);
  saveCart();
}

function openCart() {
  if (cartDrawer) cartDrawer.classList.add('is-open');
}

function closeCart() {
  if (cartDrawer) cartDrawer.classList.remove('is-open');
}

function handleSelectCategory(button) {
  state.category = button.dataset.category;
  document.querySelectorAll('.filter-button').forEach(filter => {
    const active = filter === button;
    filter.classList.toggle('is-active', active);
    filter.setAttribute('aria-pressed', String(active));
  });
  renderProducts();
}

document.querySelector('.filter-list').addEventListener('click', event => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  handleSelectCategory(button);
});

document.querySelectorAll('[data-category-link]').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    const targetCategory = link.dataset.categoryLink || 'all';
    document.querySelector('#catalogue').scrollIntoView({ behavior: 'smooth', block: 'start' });
    const button = document.querySelector(`.filter-button[data-category="${targetCategory}"]`);
    if (button) handleSelectCategory(button);
    else {
      state.category = targetCategory;
      renderProducts();
    }
    mainMenu.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
  });
});

menuToggle.addEventListener('click', () => {
  const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!isOpen));
  mainMenu.hidden = isOpen;
});

document.addEventListener('click', event => {
  if (!mainMenu.hidden && !event.target.closest('#main-menu') && !event.target.closest('#menu-toggle')) {
    mainMenu.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !mainMenu.hidden) {
    mainMenu.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.focus();
  }
});

document.querySelector('#product-search').addEventListener('input', event => {
  state.query = event.target.value.trim();
  renderProducts();
});

productGrid.addEventListener('click', event => {
  const orderButton = event.target.closest('[data-order]');
  const detailsButton = event.target.closest('[data-details]');
  const cartButton = event.target.closest('[data-cart]');
  if (cartButton) {
    addToCart(cartButton.dataset.cart, null, 1);
    openCart();
    return;
  }
  if (orderButton) {
    productSelect.value = orderButton.dataset.order;
    document.querySelector('#order').scrollIntoView({ behavior: 'smooth' });
    productSelect.focus({ preventScroll: true });
  } else if (detailsButton) {
    const product = state.products.find(item => item.id === detailsButton.dataset.details);
    if (product) showProductDetails(product);
  }
});

document.querySelector('#dialog-order').addEventListener('click', () => dialog.close());
document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

document.querySelector('#clear-filters').addEventListener('click', () => {
  state.category = 'all';
  state.query = '';
  document.querySelector('#product-search').value = '';
  const button = document.querySelector('.filter-button[data-category="all"]');
  if (button) handleSelectCategory(button);
});

orderForm.addEventListener('submit', event => {
  formFeedback.textContent = '';
  if (!orderForm.reportValidity()) {
    event.preventDefault();
    return;
  }
  const quantity = Number(orderForm.elements.quantity.value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
    event.preventDefault();
    formFeedback.textContent = 'Choose a quantity from 1 to 50.';
    return;
  }
  if (!state.whatsappConfigured) {
    event.preventDefault();
    formFeedback.textContent = 'The store WhatsApp number is not configured yet. Please contact the owner through another channel.';
    return;
  }
  formFeedback.textContent = 'WhatsApp is opening. Review the draft and send it to enquire; this is not an order confirmation.';
});

cartToggle.addEventListener('click', () => {
  if (cartDrawer.classList.contains('is-open')) closeCart();
  else openCart();
});
cartClose.addEventListener('click', closeCart);

cartItems.addEventListener('click', event => {
  const removeButton = event.target.closest('[data-remove]');
  const actionButton = event.target.closest('[data-qty]');
  if (removeButton) {
    removeCartItem(removeButton.dataset.remove, removeButton.dataset.weight === 'standard' ? null : removeButton.dataset.weight);
    return;
  }
  if (actionButton) {
    const weight = actionButton.dataset.weight === 'standard' ? null : actionButton.dataset.weight;
    const delta = actionButton.dataset.qty === 'increase' ? 1 : -1;
    updateCartFromAction(actionButton.dataset.product, weight, delta);
  }
});

cartSubmit.addEventListener('click', () => {
  if (!state.cart.length) {
    formFeedback.textContent = 'Your cart is empty. Add an item before continuing to WhatsApp.';
    closeCart();
    return;
  }
  const firstItem = state.cart[0];
  productSelect.value = firstItem.productId;
  orderForm.elements.quantity.value = firstItem.quantity;
  document.querySelector('#order').scrollIntoView({ behavior: 'smooth' });
  formFeedback.textContent = 'Cart items are ready for enquiry. Review details and continue to WhatsApp.';
  closeCart();
});

loadProducts();
renderCart();