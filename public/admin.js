/* admin workspace for GhaliShop */
(function () {
  'use strict';

  var ADMIN_SESSION_KEY = 'ghalishop-admin';
  var ADMIN_TTL_MS = 30 * 60 * 1000;

  var loginView = document.querySelector('#admin-login');
  var dashboard = document.querySelector('#admin-dashboard');
  var loginForm = document.querySelector('#login-form');
  var passwordInput = document.querySelector('#admin-password');
  var loginError = document.querySelector('#login-error');
  var form = document.querySelector('#product-form');
  var productList = document.querySelector('#admin-product-list');
  var imageUploadInput = document.querySelector('#image-upload');
  var imagePreview = document.querySelector('#image-preview');

  var products = [];
  var editingId = null;

  function toast(message) {
    var node = document.querySelector('.toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(window._ghalishopAdminToast);
    window._ghalishopAdminToast = setTimeout(function () { node.classList.remove('show'); }, 2400);
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (event) { resolve(event.target.result); };
      reader.onerror = function () { reject(new Error('Unable to read selected image.')); };
      reader.readAsDataURL(file);
    });
  }

  function renderPreview(images) {
    if (!imagePreview) return;
    var valid = (images || []).filter(Boolean);
    if (!valid.length) {
      imagePreview.innerHTML = '<div class="image-empty">No image selected</div>';
      return;
    }
    imagePreview.innerHTML = valid.map(function (src) {
      return '<div class="image-preview-item"><img src="' + window.GhaliShop.imageUrl(src, 300) + '" alt="Selected product image"></div>';
    }).join('');
  }

  function renderList() {
    var count = document.querySelector('#admin-product-count');
    if (count) count.textContent = products.length + ' items';
    if (!productList) return;
    productList.innerHTML = products.map(function (product) {
      return (
        '<button class="admin-product-item' + (product.id === editingId ? ' active' : '') + '" data-admin-product="' + product.id.replace(/"/g, '&quot;') + '">' +
          '<img src="' + window.GhaliShop.imageUrl(product.images && product.images[0], 120) + '" alt="">' +
          '<span><strong>' + product.name + '</strong><small>' + product.category + ' · ' + Number(product.price || 0).toLocaleString() + ' MAD</small></span>' +
        '</button>'
      );
    }).join('');
  }

  function selectProduct(product) {
    if (!product) return;
    editingId = product.id;

    var eyebrow = document.querySelector('#editor-eyebrow');
    var title = document.querySelector('#editor-title');
    var deleteButton = document.querySelector('#delete-product-button');
    if (eyebrow) eyebrow.textContent = 'Edit product';
    if (title) title.textContent = product.name;
    if (deleteButton) deleteButton.disabled = false;

    var values = {
      id: product.id,
      name: product.name,
      price: product.price,
      oldPrice: product.oldPrice || '',
      category: product.category,
      discount: product.discount || '',
      rating: product.rating,
      stock: product.stock,
      description: product.description,
      material: product.material,
      dimensions: product.dimensions,
      colors: (product.colors || []).join(', '),
      sizes: (product.sizes || []).join(', '),
      images: (product.images || []).join('\n')
    };
    Object.keys(values).forEach(function (name) {
      if (form.elements[name]) form.elements[name].value = values[name];
    });
    renderPreview(product.images || []);
    renderList();
  }

  function clearForm() {
    editingId = null;
    form.reset();
    form.elements.id.value = 'gs-' + String(products.length + 1).padStart(3, '0');
    form.elements.rating.value = '4.8';
    form.elements.stock.value = 'In stock';
    form.elements.category.value = 'Women';
    form.elements.images.value = '';

    var eyebrow = document.querySelector('#editor-eyebrow');
    var title = document.querySelector('#editor-title');
    var deleteButton = document.querySelector('#delete-product-button');
    if (eyebrow) eyebrow.textContent = 'New product';
    if (title) title.textContent = 'Add a product';
    if (deleteButton) deleteButton.disabled = true;

    renderPreview([]);
    renderList();
  }

  function readForm() {
    var data = new FormData(form);
    var product = {
      id: String(data.get('id') || '').trim(),
      name: String(data.get('name') || '').trim(),
      price: Number(data.get('price')) || 0,
      oldPrice: data.get('oldPrice') ? Number(data.get('oldPrice')) : undefined,
      discount: data.get('discount') ? Number(data.get('discount')) : undefined,
      category: data.get('category'),
      description: String(data.get('description') || '').trim(),
      material: String(data.get('material') || '').trim(),
      dimensions: String(data.get('dimensions') || '').trim(),
      colors: String(data.get('colors') || '').split(',').map(function (value) { return value.trim(); }).filter(Boolean),
      sizes: String(data.get('sizes') || '').split(',').map(function (value) { return value.trim(); }).filter(Boolean),
      rating: Number(data.get('rating')) || 0,
      stock: String(data.get('stock') || '').trim(),
      images: String(data.get('images') || '').split('\n').map(function (value) { return value.trim(); }).filter(Boolean)
    };
    return product;
  }

  function saveProduct(event) {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    var product = readForm();
    if (!product.id) {
      toast('A product ID is required');
      return;
    }
    var existingIndex = products.findIndex(function (item) { return item.id === editingId; });
    var duplicateIndex = products.findIndex(function (item) { return item.id === product.id; });

    if (existingIndex >= 0) {
      if (duplicateIndex >= 0 && duplicateIndex !== existingIndex) {
        toast('That product ID is already in use');
        return;
      }
      products[existingIndex] = product;
    } else {
      if (duplicateIndex >= 0) {
        toast('That product ID is already in use');
        return;
      }
      products.unshift(product);
    }

    window.GhaliShop.saveProducts(products)
      .then(function () {
        products = window.GhaliShop.getProducts();
        selectProduct(product);
        toast('Product saved for every visitor');
      })
      .catch(function () {
        toast('Could not save. Check the store connection.');
      });
  }

  function deleteProduct() {
    if (!editingId || !window.confirm('Delete this product from the collection?')) return;
    var updated = products.filter(function (product) { return product.id !== editingId; });
    window.GhaliShop.saveProducts(updated)
      .then(function () {
        products = window.GhaliShop.getProducts();
        toast('Product deleted for every visitor');
        if (products.length) selectProduct(products[0]);
        else clearForm();
      })
      .catch(function () {
        toast('Could not delete. Check the store connection.');
      });
  }

  function showDashboard() {
    loginView.classList.add('hidden');
    dashboard.classList.remove('hidden');
    products = window.GhaliShop.getProducts();
    renderList();
    if (products.length) selectProduct(products[0]);
    else clearForm();
  }

  function authenticate() {
    var password = passwordInput.value;
    passwordInput.value = '';
    window.GhaliShop.login(password)
      .then(function (result) {
        sessionStorage.setItem('ghalishop-api-token', result.token);
        sessionStorage.setItem(ADMIN_SESSION_KEY, String(Date.now() + ADMIN_TTL_MS));
        loginError.classList.remove('visible');
        return window.GhaliShop.ready;
      })
      .then(showDashboard)
      .catch(function () {
        loginError.classList.add('visible');
      });
  }

  function logout() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    dashboard.classList.add('hidden');
    loginView.classList.remove('hidden');
    passwordInput.value = '';
  }

  function handleImageUpload(event) {
    var files = Array.prototype.slice.call(event.target.files || []);
    if (!files.length) return;
    var images = files.filter(function (file) { return file.type.indexOf('image/') === 0; });

    Promise.all(images.map(fileToDataUrl))
      .then(function (uploaded) {
        var current = String(form.elements.images.value || '').split('\n').map(function (value) { return value.trim(); }).filter(Boolean);
        var merged = current.slice();
        uploaded.forEach(function (src) {
          if (merged.indexOf(src) < 0) merged.push(src);
        });
        form.elements.images.value = merged.join('\n');
        renderPreview(merged);
        toast(uploaded.length + ' image' + (uploaded.length === 1 ? '' : 's') + ' added');
        event.target.value = '';
      })
      .catch(function () { toast('Could not read the selected images.'); });
  }

  loginForm.addEventListener('submit', function (event) {
    event.preventDefault();
    authenticate();
  });

  document.querySelector('#logout-button').addEventListener('click', logout);

  document.querySelector('#new-product-button').addEventListener('click', clearForm);

  document.querySelector('#cancel-edit-button').addEventListener('click', function () {
    if (editingId) {
      var current = products.find(function (product) { return product.id === editingId; });
      selectProduct(current || products[0]);
    } else {
      selectProduct(products[0]);
    }
  });

  document.querySelector('#delete-product-button').addEventListener('click', deleteProduct);

  productList.addEventListener('click', function (event) {
    var button = event.target.closest('[data-admin-product]');
    if (button) {
      var product = products.find(function (item) { return item.id === button.dataset.adminProduct; });
      if (product) selectProduct(product);
    }
  });

  if (imageUploadInput) imageUploadInput.addEventListener('change', handleImageUpload);

  form.addEventListener('submit', saveProduct);

  var session = Number(sessionStorage.getItem(ADMIN_SESSION_KEY));
  if (session > Date.now()) {
    window.GhaliShop.ready.then(showDashboard);
  } else {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  }
})();