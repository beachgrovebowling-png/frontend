const state = { products: [], category: 'all', query: '', whatsappConfigured: false, whatsappNumber: '', contactEmail: '', submittedOrder: null, cart: loadCart() };
const API_BASE = String(window.__API_BASE__ || '').replace(/\/$/, '');
const productGrid = document.querySelector('#product-grid');
const catalogStatus = document.querySelector('#catalog-status');
const catalogNotice = document.querySelector('#catalog-notice');
const retryCatalogue = document.querySelector('#retry-catalogue');
const emptyState = document.querySelector('#empty-state');
const productSelect = document.querySelector('#product-select');
const orderForm = document.querySelector('#order-form');
if (orderForm) orderForm.action = apiUrl('/api/orders');
const formFeedback = document.querySelector('#form-feedback');
const orderMenus = document.querySelectorAll('.order-menu');
const orderNowButtons = document.querySelectorAll('.order-now-button');
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

function cartItemPrice(product) {
  if (!product) return null;
  if (Number.isFinite(product.salePrice)) return product.salePrice;
  return Number.isFinite(product.price) ? product.price : null;
}

function priceLabel(product) {
  if (!product) return 'Contact for price';
  const price = cartItemPrice(product);
  if (!Number.isFinite(price)) return 'Contact for price';
  return Number.isFinite(product.salePrice) && Number.isFinite(product.price)
    ? `$${price.toFixed(2)} USD (was $${product.price.toFixed(2)} USD)`
    : `$${price.toFixed(2)} USD`;
}

function productImages(product) {
  const source = Array.isArray(product.images) && product.images.length
    ? product.images
    : [...(product.image ? [{ url: product.image, alt: product.imageAlt || '' }] : []), ...(Array.isArray(product.gallery) ? product.gallery : [])];
  const images = source.filter((image, index, list) => image?.url && list.findIndex(item => item?.url === image.url) === index);
  const coverIndex = images.findIndex(image => image.url === product.image);
  if (coverIndex > 0) images.unshift(...images.splice(coverIndex, 1));
  return images;
}

function productVisual(product, dialogImage = false) {
  const image = productImages(product)[0];
  if (image) {
    const alt = image.alt || product.imageAlt || `${product.brand} ${product.name}`;
    return `<img class="${dialogImage ? '' : 'product-image'}" src="${escapeHtml(image.url)}" alt="${escapeHtml(alt)}" loading="lazy">`;
  }
  return '<div class="product-placeholder" role="img" aria-label="Product image unavailable">Image unavailable</div>';
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
  const noPublishedProducts = state.products.length === 0;
  document.querySelector('#empty-state-title').textContent = noPublishedProducts ? 'No published products' : 'No matching equipment';
  document.querySelector('#empty-state-message').textContent = noPublishedProducts
    ? 'There are no published products available right now.'
    : 'Try another category or clear your search.';
  document.querySelector('#clear-filters').hidden = noPublishedProducts;
  products.forEach((product, index) => {
    const images = productImages(product);
    const card = document.createElement('article');
    card.className = 'product-card';
    card.style.animationDelay = `${Math.min(index * 60, 240)}ms`;
    card.innerHTML = `
      <div class="product-visual">
        ${images.length ? `<img class="product-image" src="${escapeHtml(images[0].url)}" alt="${escapeHtml(images[0].alt || product.imageAlt || `${product.brand} ${product.name}`)}" loading="lazy">` : productVisual(product)}
        ${images.length > 1 ? `<button class="card-image-arrow previous" type="button" data-image-step="-1" aria-label="Previous ${escapeHtml(product.name)} photo">‹</button><button class="card-image-arrow next" type="button" data-image-step="1" aria-label="Next ${escapeHtml(product.name)} photo">›</button><span class="card-image-count" aria-live="polite">1 / ${images.length}</span>` : ''}
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
    if (images.length > 1) {
      let imageIndex = 0;
      const showImage = nextIndex => {
        imageIndex = (nextIndex + images.length) % images.length;
        const selected = images[imageIndex];
        image.src = selected.url;
        image.alt = selected.alt || product.imageAlt || `${product.brand} ${product.name}`;
        card.querySelector('.card-image-count').textContent = `${imageIndex + 1} / ${images.length}`;
      };
      card.querySelectorAll('[data-image-step]').forEach(button => button.addEventListener('click', event => {
        event.stopPropagation();
        showImage(imageIndex + Number(button.dataset.imageStep));
      }));
      let touchStartX = null;
      const visual = card.querySelector('.product-visual');
      visual.addEventListener('touchstart', event => { touchStartX = event.changedTouches[0]?.clientX ?? null; }, { passive: true });
      visual.addEventListener('touchend', event => {
        const touchEndX = event.changedTouches[0]?.clientX;
        if (touchStartX == null || touchEndX == null || Math.abs(touchEndX - touchStartX) < 35) return;
        showImage(imageIndex + (touchEndX < touchStartX ? 1 : -1));
        touchStartX = null;
      }, { passive: true });
    }
    productGrid.append(card);
  });
  catalogStatus.textContent = noPublishedProducts
    ? 'No published products are available right now.'
    : `${products.length} ${products.length === 1 ? 'item' : 'items'} shown`;
}

function createMissingImageLabel() {
  const label = document.createElement('div');
  label.className = 'product-placeholder';
  label.setAttribute('role', 'img');
  label.setAttribute('aria-label', 'Product image unavailable');
  label.textContent = 'Image unavailable';
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
  state.whatsappNumber = String(site.whatsappNumber || site.contactPhone || '').trim();
  state.contactEmail = String(site.contactEmail || '').trim();
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
  const hero = document.querySelector('.hero');
  const currentHeroImage = hero?.querySelector('.homepage-hero-image');
  const heroImageUrl = safeLocalOrHttpsUrl(homepage.heroImage);
  if (hero && homepage.heroImage && heroImageUrl !== '#catalogue') {
    const heroImage = document.createElement('img');
    heroImage.className = 'homepage-hero-image';
    heroImage.alt = '';
    heroImage.setAttribute('aria-hidden', 'true');
    heroImage.addEventListener('error', () => heroImage.remove(), { once: true });
    heroImage.src = heroImageUrl;
    currentHeroImage?.remove();
    hero.prepend(heroImage);
  } else {
    currentHeroImage?.remove();
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.contactEmail)) {
    const emailShopButton = document.querySelector('#email-shop-button');
    const mailto = `mailto:${state.contactEmail}`;
    if (emailShopButton) {
      emailShopButton.href = mailto;
      emailShopButton.setAttribute('aria-label', `Email the shop at ${state.contactEmail}`);
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
  retryCatalogue.hidden = true;
  catalogNotice.hidden = true;
  emptyState.hidden = true;
  catalogStatus.textContent = 'Loading catalogue...';
  try {
    const response = await fetch(apiUrl('/api/products'), { cache: 'no-store', headers: { Accept: 'application/json' }, credentials: API_BASE ? 'include' : 'same-origin' });
    if (!response.ok) throw new Error(`Catalogue request failed with status ${response.status}.`);
    const data = await response.json();
    if (data.databaseConnected !== true || !Array.isArray(data.products)) throw new Error('Catalogue response is invalid or the database is disconnected.');
    state.products = data.products.filter(product => product && product.status !== 'draft' && product.isStarter !== true);
    state.whatsappConfigured = Boolean(data.whatsappConfigured);
    applyPublicSettings(data.site);
    applyCategoryFilters(data.categories || []);
    populateProductSelect();
    if (!state.whatsappConfigured) {
      catalogNotice.hidden = false;
      const nextText = `${catalogNotice.textContent ? `${catalogNotice.textContent} ` : ''}WhatsApp ordering is unavailable until the owner’s complete international number is configured.`;
      catalogNotice.textContent = nextText;
    }
    renderProducts();
    renderCart();
  } catch (error) {
    state.products = [];
    populateProductSelect();
    catalogStatus.textContent = 'Unable to load products. Please try again.';
    productGrid.replaceChildren();
    emptyState.hidden = true;
    retryCatalogue.hidden = false;
  }
}

retryCatalogue.addEventListener('click', loadProducts);

function showProductDetails(product) {
  const brandElement = document.querySelector('#dialog-brand');
  brandElement.innerHTML = `${escapeHtml(product.brand)} / ${escapeHtml(categoryLabels[product.category] || 'Equipment')}`;
  document.querySelector('#dialog-title').textContent = product.name;
  document.querySelector('#dialog-price').textContent = priceLabel(product);
  document.querySelector('#dialog-description').textContent = product.description;
  document.querySelector('#dialog-availability').textContent = `Availability: ${product.availability === 'available' ? 'Available' : product.availability === 'out-of-stock' ? 'Currently unavailable' : 'Contact store for confirmation'}`;
  const imageArea = document.querySelector('#dialog-image');
  const galleryArea = document.querySelector('#dialog-gallery');
  const galleryImages = productImages(product);
  const renderDialogImage = imageData => {
    const image = document.createElement('img');
    image.alt = imageData.alt || `${product.brand} ${product.name}`;
    image.loading = 'eager';
    image.addEventListener('error', () => image.replaceWith(createMissingImageLabel()), { once: true });
    imageArea.replaceChildren(image);
    image.src = imageData.url;
  };
  if (galleryImages.length) renderDialogImage(galleryImages[0]);
  else imageArea.innerHTML = productVisual(product, true);
  galleryArea.innerHTML = galleryImages.length > 1 ? galleryImages.map((image, index) => `<button class="dialog-gallery-button${index === 0 ? ' is-active' : ''}" type="button" data-gallery-index="${index}" aria-label="Show product image ${index + 1}" aria-pressed="${index === 0}"><img src="${escapeHtml(image.url)}" alt="" loading="lazy"></button>`).join('') : '';
  galleryArea.querySelectorAll('[data-gallery-index]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.galleryIndex);
    renderDialogImage(galleryImages[index]);
    galleryArea.querySelectorAll('[data-gallery-index]').forEach(item => {
      const active = item === button;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
  }));

  const weightChoices = Array.isArray(product.weights) && product.weights.length ? `
    <label class="dialog-field">
      <span>Weight</span>
      <select id="dialog-weight-select">
        ${product.weights.map(weight => `<option value="${escapeHtml(weight.value)}" ${weight.available === false ? 'disabled' : ''}>${escapeHtml(weight.label)} ${weight.available === false ? '(unavailable)' : ''}</option>`).join('')}
      </select>
    </label>
  ` : '';

  const dialogContent = document.querySelector('.dialog-copy');
  dialogContent.querySelector('.dialog-offer')?.remove();
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
        <div class="cart-meta">${item.weightValue ? `Weight: ${escapeHtml(item.weightValue)} lb` : escapeHtml(priceLabel(product))}</div>
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

function closeOrderMenus() {
  orderMenus.forEach(menu => menu.hidden = true);
}

function openOrderMenu(button) {
  const menu = button?.closest('.order-now-wrap')?.querySelector('.order-menu');
  if (!menu) return;
  const shouldOpen = menu.hidden;
  closeOrderMenus();
  menu.hidden = !shouldOpen;
}

async function handleDirectOrderAction(type, contactOnly = false) {
  closeOrderMenus();
  if (contactOnly) {
    if (type === 'whatsapp') {
      if (!state.whatsappNumber) return;
      window.open(`https://wa.me/${state.whatsappNumber}?text=${encodeURIComponent('Hi BowlersMechanic, I have a question about your bowling equipment.')}`, '_blank', 'noopener');
    } else if (state.contactEmail) {
      window.location.href = `mailto:${state.contactEmail}?subject=${encodeURIComponent('BowlersMechanic enquiry')}`;
    }
    return;
  }
  if (type === 'whatsapp' && !state.whatsappNumber) {
    formFeedback.textContent = 'WhatsApp ordering is not available right now. Please choose email instead.';
    return;
  }
  if (type === 'email' && !state.contactEmail) {
    formFeedback.textContent = 'The shop email is not available right now. Please choose WhatsApp instead.';
    return;
  }
  if (!state.submittedOrder && !orderForm.reportValidity()) return;
  let whatsappWindow = null;
  if (!state.submittedOrder) {
    const quantity = Number(orderForm.elements.quantity.value);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      formFeedback.textContent = 'Choose a quantity from 1 to 50.';
      return;
    }
    formFeedback.textContent = 'Recording your enquiry…';
    const formData = new FormData(orderForm);
    whatsappWindow = type === 'whatsapp' ? window.open('about:blank', '_blank') : null;
    if (whatsappWindow) whatsappWindow.opener = null;
    let data;
    try {
      const response = await fetch(apiUrl('/api/orders'), {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new URLSearchParams(formData)
      });
      data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Your order could not be submitted right now.');
    } catch (error) {
      whatsappWindow?.close();
      throw error;
    }
    state.whatsappConfigured = Boolean(data.whatsappNumber);
    if (data.whatsappNumber) state.whatsappNumber = String(data.whatsappNumber).trim();
    if (data.contactEmail) state.contactEmail = String(data.contactEmail).trim();
    const selectedProduct = state.products.find(item => item.id === formData.get('productId') || item.slug === formData.get('productId'));
    state.submittedOrder = {
      reference: String(data.order?.reference || data.reference || 'Pending'),
      customerName: String(formData.get('customerName') || '').trim(),
      customerPhone: String(formData.get('customerPhone') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      productId: selectedProduct?.id || String(formData.get('productId') || ''),
      quantity: String(formData.get('quantity') || '1'),
      paymentMethod: String(formData.get('paymentMethod') || ''),
      requirements: String(formData.get('requirements') || '').trim()
    };
    orderForm.querySelectorAll('input, select, textarea').forEach(field => { field.disabled = true; });
  }
  const order = state.submittedOrder;
  const product = state.products.find(item => item.id === order.productId || item.slug === order.productId);
  if (!product) {
    formFeedback.textContent = 'The selected product is no longer available. Refresh the catalogue and try again.';
    return;
  }
  const price = priceLabel(product);
  const lines = [
    'BowlersMechanic order enquiry',
    '',
    `Order reference: ${order.reference}`,
    `Customer: ${order.customerName}`,
    `Phone: ${order.customerPhone}`,
    ...(order.email ? [`Email: ${order.email}`] : []),
    `Product: ${product.brand} ${product.name}`,
    `Price: ${price}`,
    `Quantity: ${order.quantity}`,
    `Preferred payment method: ${order.paymentMethod}`,
    ...(order.requirements ? [`Additional requirements: ${order.requirements}`] : []),
    ''
  ];
  const message = lines.join('\n');

  if (type === 'whatsapp') {
    const whatsappUrl = `https://wa.me/${state.whatsappNumber}?text=${encodeURIComponent(message)}`;
    const destinationWindow = whatsappWindow || window.open('', '_blank');
    if (destinationWindow) {
      destinationWindow.opener = null;
      destinationWindow.location.href = whatsappUrl;
    } else {
      window.location.href = whatsappUrl;
    }
    formFeedback.textContent = 'Your order details are ready in WhatsApp. Review the message and send it to the shop.';
    return;
  }
  const subject = encodeURIComponent(`Order enquiry ${order.reference}`);
  const body = encodeURIComponent(message);
  window.location.href = `mailto:${state.contactEmail}?subject=${subject}&body=${body}`;
  formFeedback.textContent = 'Your order details are ready in an email draft to the shop.';
}

orderNowButtons.forEach(button => {
  button.addEventListener('click', event => {
    event.stopPropagation();
    openOrderMenu(button);
  });
});

document.querySelectorAll('[data-order-action]').forEach(button => {
  button.addEventListener('click', () => handleDirectOrderAction(button.dataset.orderAction, Boolean(button.closest('#contact-order-menu'))).catch(error => {
    formFeedback.textContent = error.message || 'Your order could not be submitted right now.';
  }));
});

document.addEventListener('click', event => {
  if (!event.target.closest('.order-now-wrap') && !event.target.closest('.order-menu-option')) {
    closeOrderMenus();
  }
});

orderForm.addEventListener('submit', event => event.preventDefault());

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