/* exported apiRequest, GhaliShop */
(function () {
  'use strict';

  var CONFIG = window.GhaliShopConfig || {};
  var API_BASE = CONFIG.apiBase || (window.location.origin || '').replace(/\/+$/, '');
  var PRODUCTS_CACHE_KEY = 'ghalishop-products';
  var CART_KEY = 'ghalishop-cart';
  var FAVORITES_KEY = 'ghalishop-favorites';
  var ORDERS_KEY = 'ghalishop-orders';
  var TOKEN_KEY = 'ghalishop-api-token';
  var WHATSAPP_NUMBER = '212782824718';

  var catalog = [];
  var cart = readArray(CART_KEY) || [];
  var favorites = readArray(FAVORITES_KEY) || [];
  var activeCategory = 'All';

  /* ---------------- small helpers ---------------- */

  function readArray(key) {
    try {
      var value = JSON.parse(localStorage.getItem(key) || 'null');
      return Array.isArray(value) ? value : null;
    } catch (error) {
      return null;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      /* storage unavailable - ignore */
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function money(value) {
    return Number(value || 0).toLocaleString('en-US') + ' MAD';
  }

  function getProduct(id) {
    var index = catalog.findIndex(function (product) { return product.id === id; });
    return index >= 0 ? catalog[index] : null;
  }

  function cleanCart() {
    var valid = cart.filter(function (item) {
      return getProduct(item.id) && Number.isInteger(item.quantity) && item.quantity > 0;
    });
    if (valid.length !== cart.length) {
      cart = valid;
      writeStore(CART_KEY, cart);
    }
  }

  function imageUrl(id, width) {
    var value = String(id || '').trim();
    if (!value) return '';
    if (value.indexOf('data:') === 0 || value.indexOf('blob:') === 0 || /^https?:\/\//i.test(value)) {
      return value;
    }
    return 'https://images.unsplash.com/' + value + '?auto=format&fit=crop&w=' + width + '&q=84';
  }

  function showToast(message) {
    var toast = document.querySelector('.toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(window._ghalishopToast);
    window._ghalishopToast = setTimeout(function () { toast.classList.remove('show'); }, 2400);
  }

  /* ---------------- api ---------------- */

  function apiRequest(path, options) {
    options = options || {};
    var token = sessionStorage.getItem(TOKEN_KEY);
    var headers = { 'Content-Type': 'application/json' };
    var key;
    for (key in options.headers) {
      if (Object.prototype.hasOwnProperty.call(options.headers, key)) headers[key] = options.headers[key];
    }
    if (token) headers.Authorization = 'Bearer ' + token;

    return fetch(API_BASE + path, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body
    }).then(function (response) {
      if (!response.ok) {
        var error = new Error('API request failed: ' + response.status);
        error.status = response.status;
        throw error;
      }
      return response.json();
    });
  }

  /* ---------------- catalog ---------------- */

  function loadCatalog() {
    return apiRequest('/api/products')
      .then(function (value) {
        if (!Array.isArray(value)) throw new Error('Invalid products response');
        catalog = value;
        writeStore(PRODUCTS_CACHE_KEY, catalog);
        return catalog;
      })
      .catch(function () {
        return fetch('catalog.json', { cache: 'no-cache' })
          .then(function (response) {
            if (!response.ok) throw new Error('No snapshot');
            return response.json();
          })
          .then(function (value) {
            if (!Array.isArray(value) || !value.length) throw new Error('Empty snapshot');
            catalog = value;
            return catalog;
          })
          .catch(function () {
            var cached = readArray(PRODUCTS_CACHE_KEY);
            catalog = cached && cached.length ? cached : [];
            return catalog;
          });
      });
  }

  var ready = loadCatalog();

  /* ---------------- rendering ---------------- */

  function productCard(product) {
    var favorite = favorites.indexOf(product.id) >= 0;
    return (
      '<article class="product-card">' +
        '<a class="product-image-wrap" href="product.html?id=' + encodeURIComponent(product.id) + '">' +
          '<img class="product-image" src="' + imageUrl(product.images && product.images[0], 700) + '" alt="' + escapeHtml(product.name) + '" loading="lazy">' +
          (product.discount ? '<span class="sale-badge">-' + product.discount + '%</span>' : '') +
        '</a>' +
        '<button class="favorite-button ' + (favorite ? 'active' : '') + '" data-favorite="' + escapeHtml(product.id) + '" aria-label="' + (favorite ? 'Remove from' : 'Add to') + ' favorites">' + (favorite ? '&#9829;' : '&#9825;') + '</button>' +
        '<div class="product-meta">' +
          '<div>' +
            '<a class="product-name" href="product.html?id=' + encodeURIComponent(product.id) + '">' + escapeHtml(product.name) + '</a>' +
            '<div class="product-category">' + escapeHtml(product.category) + '</div>' +
            '<div class="rating">&#9733;&#9733;&#9733;&#9733;&#9733; <span>' + product.rating + '</span></div>' +
          '</div>' +
          '<div class="product-price">' +
            (product.oldPrice ? '<span class="old-price">' + money(product.oldPrice) + '</span>' : '') +
            money(product.price) +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function filteredProducts() {
    var input = document.querySelector('#search-input');
    var query = (input ? input.value : '').trim().toLowerCase();
    var result = catalog.filter(function (product) {
      var inCategory = activeCategory === 'All' || product.category === activeCategory;
      var inSale = activeCategory !== 'Sale' || Boolean(product.discount);
      if (!inCategory || !inSale) return false;
      if (!query) return true;
      return (product.name + ' ' + product.category + ' ' + (product.description || '')).toLowerCase().indexOf(query) >= 0;
    });

    var sortSelect = document.querySelector('#sort-select');
    var sort = sortSelect ? sortSelect.value : 'default';
    if (sort === 'price-low') result = result.slice().sort(function (a, b) { return a.price - b.price; });
    else if (sort === 'price-high') result = result.slice().sort(function (a, b) { return b.price - a.price; });
    else if (sort === 'name-az') result = result.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    else if (sort === 'name-za') result = result.slice().sort(function (a, b) { return b.name.localeCompare(a.name); });
    return result;
  }

  function renderProducts() {
    var grid = document.querySelector('#product-grid');
    if (!grid) return;
    var result = filteredProducts();
    grid.innerHTML = result.map(productCard).join('');
    var count = document.querySelector('.product-count');
    if (count) count.textContent = result.length + ' ' + (result.length === 1 ? 'piece' : 'pieces');
    var empty = document.querySelector('#empty-state');
    if (empty) empty.classList.toggle('hidden', result.length > 0);
  }

  /* ---------------- cart + favorites ---------------- */

  function cartQuantity() {
    return cart.reduce(function (sum, item) { return sum + item.quantity; }, 0);
  }

  function cartSubtotal() {
    return cart.reduce(function (sum, item) {
      var product = getProduct(item.id);
      return sum + product.price * item.quantity;
    }, 0);
  }

  function renderCounts() {
    cleanCart();
    var count = cartQuantity();
    document.querySelectorAll('.cart-count').forEach(function (el) { el.textContent = String(count); });
    document.querySelectorAll('.cart-subtotal').forEach(function (el) { el.textContent = money(cartSubtotal()); });
  }

  function renderCart() {
    var container = document.querySelector('#cart-items');
    if (!container) return;
    cleanCart();
    if (!cart.length) {
      container.innerHTML = '<div class="empty-cart"><p>Your bag is waiting for something good.</p><a class="text-link" href="index.html#shop" data-close-cart>Explore the collection</a></div>';
    } else {
      container.innerHTML = cart.map(function (item) {
        var product = getProduct(item.id);
        return (
          '<div class="cart-row">' +
            '<img src="' + imageUrl(product.images && product.images[0], 180) + '" alt="' + escapeHtml(product.name) + '">' +
            '<div>' +
              '<h3>' + escapeHtml(product.name) + '</h3>' +
              '<p>' + money(product.price) + '</p>' +
              '<div class="quantity-control">' +
                '<button data-cart-action="decrease" data-id="' + escapeHtml(item.id) + '" aria-label="Decrease quantity">' + '\u2212' + '</button>' +
                '<span>' + item.quantity + '</span>' +
                '<button data-cart-action="increase" data-id="' + escapeHtml(item.id) + '" aria-label="Increase quantity">+</button>' +
                '<button class="remove-button" data-cart-action="remove" data-id="' + escapeHtml(item.id) + '">Remove</button>' +
              '</div>' +
            '</div>' +
            '<span class="cart-row-total">' + money(product.price * item.quantity) + '</span>' +
          '</div>'
        );
      }).join('');
    }
    renderCounts();
  }

  function openCart() {
    var drawer = document.querySelector('#cart-drawer');
    if (!drawer) return;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    renderCart();
  }

  function closeCart() {
    var drawer = document.querySelector('#cart-drawer');
    if (!drawer) return;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  }

  function saveState() {
    writeStore(CART_KEY, cart);
    writeStore(FAVORITES_KEY, favorites);
  }

  function addToCart(id, quantity) {
    quantity = Math.max(1, Number(quantity) || 1);
    var existing = cart.find(function (item) { return item.id === id; });
    if (existing) existing.quantity += quantity;
    else cart.push({ id: id, quantity: quantity });
    saveState();
    renderCart();
    showToast('Added to your bag');
  }

  function toggleFavorite(id) {
    var index = favorites.indexOf(id);
    if (index >= 0) favorites.splice(index, 1);
    else favorites.push(id);
    saveState();
    renderProducts();
    renderDetail(getProduct(id));
    showToast(favorites.indexOf(id) >= 0 ? 'Saved to favorites' : 'Removed from favorites');
  }

  /* ---------------- product detail ---------------- */

  function renderDetail(product) {
    var target = document.querySelector('#product-detail');
    if (!target || !product) return;
    document.title = product.name + ' | GhaliShop';
    var breadcrumb = document.querySelector('.breadcrumb-name');
    if (breadcrumb) breadcrumb.textContent = product.name;
    var favorite = favorites.indexOf(product.id) >= 0;
    target.innerHTML =
      '<div class="detail-layout">' +
        '<div class="detail-gallery">' +
          '<div class="thumbs">' +
            product.images.map(function (image, index) {
              return '<button class="thumb ' + (index === 0 ? 'active' : '') + '" data-image="' + escapeHtml(image) + '" aria-label="View image ' + (index + 1) + '">' +
                '<img src="' + imageUrl(image, 180) + '" alt="' + escapeHtml(product.name) + ' view ' + (index + 1) + '">' +
              '</button>';
            }).join('') +
          '</div>' +
          '<img class="main-product-image" src="' + imageUrl(product.images[0], 1000) + '" alt="' + escapeHtml(product.name) + '">' +
        '</div>' +
        '<div class="detail-info">' +
          '<p class="eyebrow">' + escapeHtml(product.category) + (product.discount ? ' / ' + product.discount + '% off' : '') + '</p>' +
          '<h1>' + escapeHtml(product.name) + '</h1>' +
          '<div class="detail-price">' + (product.oldPrice ? '<span class="old-price">' + money(product.oldPrice) + '</span>' : '') + money(product.price) + '</div>' +
          '<div class="rating">&#9733;&#9733;&#9733;&#9733;&#9733; <span>' + product.rating + ' / 5</span></div>' +
          '<p class="detail-copy">' + escapeHtml(product.description) + '</p>' +
          '<div class="detail-specs">' +
            '<div class="spec"><strong>Material</strong><span>' + escapeHtml(product.material) + '</span></div>' +
            '<div class="spec"><strong>Dimensions</strong><span>' + escapeHtml(product.dimensions) + '</span></div>' +
            '<div class="spec"><strong>Availability</strong><span>' + escapeHtml(product.stock) + '</span></div>' +
            '<div class="spec"><strong>Delivery</strong><span>2-4 working days</span></div>' +
          '</div>' +
          '<div class="options-label">Color</div>' +
          '<div class="swatches">' +
            product.colors.map(function (color, index) {
              return '<button class="swatch ' + (index === 0 ? 'selected' : '') + '" style="background:' + color + '" aria-label="Color option ' + (index + 1) + '"></button>';
            }).join('') +
          '</div>' +
          '<div class="options-label">Size</div>' +
          '<div class="size-list">' +
            product.sizes.map(function (size) {
              return '<button class="size-button selected">' + escapeHtml(size) + '</button>';
            }).join('') +
          '</div>' +
          '<div class="detail-actions">' +
            '<div class="quantity-picker">' +
              '<button data-detail-quantity="decrease" aria-label="Decrease quantity">' + '\u2212' + '</button>' +
              '<span id="detail-quantity">1</span>' +
              '<button data-detail-quantity="increase" aria-label="Increase quantity">+</button>' +
            '</div>' +
            '<button class="button button-dark" data-add-detail="' + escapeHtml(product.id) + '">Add to bag <span>&#8599;</span></button>' +
            '<button class="favorite-large ' + (favorite ? 'active' : '') + '" data-favorite="' + escapeHtml(product.id) + '" aria-label="Add to favorites">' + (favorite ? '&#9829;' : '&#9825;') + '</button>' +
          '</div>' +
          '<button class="text-button" data-buy-now="' + escapeHtml(product.id) + '">Buy / order now</button>' +
        '</div>' +
      '</div>';
  }

  function renderRelated(current) {
    var grid = document.querySelector('#related-grid');
    if (!grid) return;
    var related = catalog
      .filter(function (product) {
        return product.id !== current.id && (product.category === current.category || product.category === 'Handbags');
      })
      .slice(0, 4);
    grid.innerHTML = related.map(productCard).join('');
  }

  /* ---------------- checkout modal ---------------- */

  function setupCheckout() {
    var modal = document.querySelector('#checkout-modal');
    if (!modal) return;

    var openButton = document.querySelector('[data-checkout]');
    if (openButton) {
      openButton.addEventListener('click', function () {
        if (!cart.length) {
          showToast('Your bag is empty');
          return;
        }
        modal.classList.remove('hidden');
        var total = document.querySelector('.checkout-total');
        if (total) total.textContent = money(cartSubtotal());
      });
    }

    var closeButton = document.querySelector('[data-close-checkout]');
    if (closeButton) closeButton.addEventListener('click', function () { modal.classList.add('hidden'); });

    var form = document.querySelector('#checkout-form');
    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }
        submitOrder(form, modal);
      });
    }
  }

  function submitOrder(form, modal) {
    var data = new FormData(form);
    var order = {
      id: 'GS-' + Date.now().toString(36).toUpperCase(),
      createdAt: new Date().toISOString(),
      status: 'New',
      customer: {
        name: data.get('name').trim(),
        phone: (data.get('countryCode') ? data.get('countryCode') + ' ' : '') + data.get('phone').trim(),
        address: data.get('address').trim(),
        city: data.get('city').trim(),
        notes: data.get('notes').trim()
      },
      items: cart.map(function (item) {
        var product = getProduct(item.id);
        return { id: product.id, name: product.name, price: product.price, quantity: item.quantity };
      }),
      total: cartSubtotal()
    };

    saveOrder(order).finally(function () {
      cart = [];
      saveState();
      renderCart();
      modal.classList.add('hidden');
      form.reset();
      closeCart();
      showToast('Order confirmed. We will contact you shortly.');
    });
  }

  function saveOrder(order) {
    var orders = readArray(ORDERS_KEY) || [];
    orders.unshift(order);
    writeStore(ORDERS_KEY, orders);
    return apiRequest('/api/orders', { method: 'POST', body: JSON.stringify(order) }).catch(function () {
      return order;
    });
  }

  /* ---------------- checkout field enhancements ---------------- */

  var MOROCCAN_CITIES = ['Agadir', 'Al Hoceima', 'Azemmour', 'Beni Mellal', 'Berrechid', 'Casablanca', 'Chefchaouen', 'Dakhla', 'El Jadida', 'Errachidia', 'Essaouira', 'Fes', 'Guelmim', 'Ifrane', 'Kenitra', 'Khemisset', 'Khouribga', 'Laayoune', 'Larache', 'Marrakesh', 'Meknes', 'Mohammedia', 'Nador', 'Ouarzazate', 'Oujda', 'Rabat', 'Safi', 'Sale', 'Settat', 'Sidi Ifni', 'Tangier', 'Tarfaya', 'Taroudant', 'Tetouan', 'Tinghir', 'Tiznit', 'Youssoufia', 'Zagora'];

  function enhanceCheckoutFields() {
    document.querySelectorAll('#checkout-form').forEach(function (form) {
      var phone = form.elements.phone;
      var city = form.elements.city;
      if (!phone || phone.dataset.enhanced) return;

      var phoneGroup = document.createElement('div');
      phoneGroup.className = 'phone-input-group';

      var code = document.createElement('select');
      code.name = 'countryCode';
      code.setAttribute('aria-label', 'International calling code');
      ['+212 Morocco', '+33 France', '+34 Spain', '+44 United Kingdom', '+1 United States / Canada', '+971 United Arab Emirates'].forEach(function (label) {
        var option = document.createElement('option');
        option.value = label.split(' ')[0];
        option.textContent = label;
        code.appendChild(option);
      });

      phone.parentElement.insertBefore(phoneGroup, phone);
      phoneGroup.append(code, phone);

      phone.type = 'tel';
      phone.inputMode = 'numeric';
      phone.pattern = '[0-9]{9,10}';
      phone.maxLength = 10;
      phone.placeholder = '612345678';
      phone.dataset.enhanced = 'true';
      phone.addEventListener('input', function () {
        phone.value = phone.value.replace(/\D/g, '').slice(0, 10);
      });

      var citySelect = document.createElement('select');
      citySelect.name = 'city';
      citySelect.required = true;
      citySelect.autocomplete = 'address-level2';
      citySelect.innerHTML = '<option value="">Choose a Moroccan city</option>' +
        MOROCCAN_CITIES.map(function (item) { return '<option value="' + item + '">' + item + '</option>'; }).join('');
      city.replaceWith(citySelect);
    });
  }

  /* ---------------- event wiring ---------------- */

  function setCategory(name) {
    activeCategory = name;
    document.querySelectorAll('.category-button').forEach(function (button) {
      button.classList.toggle('active', button.dataset.category === name);
    });
    renderProducts();
  }

  function handleImageChange(event) {
    var image = event.target.closest('[data-image]');
    if (!image) return;
    var main = document.querySelector('.main-product-image');
    if (main) main.src = imageUrl(image.dataset.image, 1000);
    document.querySelectorAll('.thumb').forEach(function (button) {
      button.classList.toggle('active', button === image);
    });
  }

  function handleDetailQuantity(event) {
    var trigger = event.target.closest('[data-detail-quantity]');
    if (!trigger) return;
    var quantity = document.querySelector('#detail-quantity');
    if (!quantity) return;
    var value = Number(quantity.textContent) + (trigger.dataset.detailQuantity === 'increase' ? 1 : -1);
    quantity.textContent = Math.max(1, value);
  }

  function handleCartAction(event) {
    var trigger = event.target.closest('[data-cart-action]');
    if (!trigger) return;
    var id = trigger.dataset.id;
    var item = cart.find(function (entry) { return entry.id === id; });
    var action = trigger.dataset.cartAction;

    if (action === 'remove') cart = cart.filter(function (entry) { return entry.id !== id; });
    else if (action === 'increase' && item) item.quantity += 1;
    else if (action === 'decrease' && item) {
      item.quantity -= 1;
      if (item.quantity < 1) cart = cart.filter(function (entry) { return entry.id !== id; });
    }
    saveState();
    renderCart();
  }

  function handleDocumentClick(event) {
    var category = event.target.closest('[data-category]');
    if (category) {
      setCategory(category.dataset.category);
      var mobileNav = document.querySelector('.mobile-nav');
      if (mobileNav) mobileNav.classList.remove('open');
      return;
    }

    var footerCategory = event.target.closest('[data-footer-category]');
    if (footerCategory) {
      setCategory(footerCategory.dataset.footerCategory);
      return;
    }

    var favorite = event.target.closest('[data-favorite]');
    if (favorite) {
      event.preventDefault();
      toggleFavorite(favorite.dataset.favorite);
      return;
    }

    var cartAction = event.target.closest('[data-cart-action]');
    if (cartAction) {
      handleCartAction(event);
      return;
    }

    if (event.target.closest('[data-open-cart]')) {
      openCart();
      return;
    }
    if (event.target.closest('[data-close-cart]')) {
      closeCart();
      return;
    }

    var detailImage = event.target.closest('[data-image]');
    if (detailImage) {
      handleImageChange(event);
      return;
    }

    handleDetailQuantity(event);

    var detailAdd = event.target.closest('[data-add-detail]');
    if (detailAdd) {
      var quantityEl = document.querySelector('#detail-quantity');
      addToCart(detailAdd.dataset.addDetail, quantityEl ? Number(quantityEl.textContent) : 1);
      return;
    }

    var buy = event.target.closest('[data-buy-now]');
    if (buy) {
      var qty = document.querySelector('#detail-quantity');
      addToCart(buy.dataset.buyNow, qty ? Number(qty.textContent) : 1);
      openCart();
      return;
    }

    var reset = event.target.closest('[data-reset-filters]');
    if (reset) {
      activeCategory = 'All';
      var search = document.querySelector('#search-input');
      if (search) search.value = '';
      document.querySelectorAll('.category-button').forEach(function (button) {
        button.classList.toggle('active', button.dataset.category === 'All');
      });
      var sortSelect = document.querySelector('#sort-select');
      if (sortSelect) sortSelect.value = 'default';
      renderProducts();
    }
  }

  function bindControls() {
    var search = document.querySelector('#search-input');
    if (search) search.addEventListener('input', renderProducts);

    var sort = document.querySelector('#sort-select');
    if (sort) sort.addEventListener('change', renderProducts);

    document.querySelectorAll('[data-whatsapp]').forEach(function (button) {
      button.addEventListener('click', function () {
        window.open('https://wa.me/' + WHATSAPP_NUMBER, '_blank', 'noopener');
      });
    });

    var menuButton = document.querySelector('.mobile-menu-button');
    if (menuButton) {
      menuButton.addEventListener('click', function () {
        var nav = document.querySelector('.mobile-nav');
        if (!nav) return;
        var open = !nav.classList.contains('open');
        nav.classList.toggle('open', open);
        nav.setAttribute('aria-hidden', String(!open));
        menuButton.setAttribute('aria-expanded', String(open));
      });
    }

    var backTop = document.querySelector('.back-top');
    if (backTop) {
      backTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
      window.addEventListener('scroll', function () {
        backTop.classList.toggle('visible', window.scrollY > 500);
      });
    }
  }

  function init() {
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('click', function (event) {
      var swatch = event.target.closest('.swatch');
      if (swatch) {
        document.querySelectorAll('.swatch').forEach(function (button) {
          button.classList.toggle('selected', button === swatch);
        });
      }
      var size = event.target.closest('.size-button');
      if (size) {
        document.querySelectorAll('.size-button').forEach(function (button) {
          button.classList.toggle('selected', button === size);
        });
      }
    });

    document.addEventListener('submit', function (event) {
      var form = event.target.closest('#checkout-form');
      if (!form) return;
      var required = Array.prototype.slice.call(form.querySelectorAll('[required]'));
      required.forEach(function (field) {
        field.setCustomValidity(field.value && field.value.trim() ? '' : 'Please complete this field.');
      });
      var phone = form.elements.phone;
      if (phone) {
        phone.setCustomValidity('');
        if (phone.value && !/^\d{9,10}$/.test(phone.value)) {
          phone.setCustomValidity('Enter 9 or 10 numbers only.');
        }
      }
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        form.reportValidity();
      }
    }, true);

    bindControls();
    setupCheckout();
    enhanceCheckoutFields();

    renderProducts();
    renderCart();

    ready.then(function () {
      renderProducts();
      var params = new URLSearchParams(window.location.search);
      var current = params.get('id') ? getProduct(params.get('id')) : null;
      if (current) {
        renderDetail(current);
        renderRelated(current);
      }
      renderCart();
    });
  }

  /* ---------------- public api ---------------- */

  window.GhaliShop = {
    ready: ready,
    isApiEnabled: true,
    getProducts: function () { return catalog.slice(); },
    login: function (password) {
      return apiRequest('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: password }) });
    },
    saveProducts: function (updatedProducts) {
      return apiRequest('/api/products', { method: 'PUT', body: JSON.stringify(updatedProducts) }).then(function (saved) {
        catalog = Array.isArray(saved) ? saved : updatedProducts;
        writeStore(PRODUCTS_CACHE_KEY, catalog);
        return catalog;
      });
    },
    saveOrder: saveOrder,
    apiRequest: apiRequest,
    imageUrl: imageUrl
  };

  init();
})();