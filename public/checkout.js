/* checkout inbox for GhaliShop */
(function () {
  'use strict';

  var CHECKOUT_SESSION_KEY = 'ghalishop-checkout-admin';
  var ORDERS_LOCAL_KEY = 'ghalishop-orders';
  var CHECKOUT_TTL_MS = 30 * 60 * 1000;

  var loginView = document.querySelector('#checkout-login');
  var dashboard = document.querySelector('#checkout-dashboard');
  var loginForm = document.querySelector('#checkout-login-form');
  var passwordInput = document.querySelector('#checkout-password');
  var loginError = document.querySelector('#checkout-login-error');

  var orders = readOrders();

  function readOrders() {
    try {
      var value = JSON.parse(localStorage.getItem(ORDERS_LOCAL_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function writeOrders() {
    try {
      localStorage.setItem(ORDERS_LOCAL_KEY, JSON.stringify(orders));
    } catch (error) {
      /* storage unavailable - ignore */
    }
  }

  function toast(message) {
    var node = document.querySelector('.toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(window._ghalishopCheckoutToast);
    window._ghalishopCheckoutToast = setTimeout(function () { node.classList.remove('show'); }, 2400);
  }

  function formatOrderDate(value) {
    return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function money(value) {
    return Number(value || 0).toLocaleString('en-US') + ' MAD';
  }

  async function loadOrders() {
    try {
      orders = await window.GhaliShop.apiRequest('/api/orders');
    } catch (error) {
      orders = readOrders();
    }
    return orders;
  }

  function renderOrders() {
    var count = document.querySelector('#order-count');
    if (count) {
      count.textContent = orders.length + ' ' + (orders.length === 1 ? 'order' : 'orders');
    }
    var list = document.querySelector('#orders-list');
    if (!list) return;

    if (!orders.length) {
      list.innerHTML = '<div class="orders-empty"><span>&#9675;</span><h2>No orders yet</h2><p>Completed client checkouts will appear here.</p></div>';
      return;
    }

    list.innerHTML = orders.map(function (order) {
      var completed = order.status === 'Completed';
      var customer = order.customer || {};
      return (
        '<article class="order-card' + (completed ? ' order-completed' : '') + '">' +
          '<header>' +
            '<div><p class="eyebrow">' + (order.status || 'New') + '</p><h2>' + (order.id || '—') + '</h2></div>' +
            '<time>' + formatOrderDate(order.createdAt) + '</time>' +
          '</header>' +
          '<div class="order-customer">' +
            '<div><strong>Customer</strong><span>' + (customer.name || '—') + '</span></div>' +
            '<div><strong>Phone</strong><span>' + (customer.phone || '—') + '</span></div>' +
            '<div><strong>City / address</strong><span>' + (customer.city || '') + ', ' + (customer.address || '') + '</span></div>' +
            (customer.notes ? '<div><strong>Notes</strong><span>' + customer.notes + '</span></div>' : '') +
          '</div>' +
          '<div class="order-items">' +
            (order.items || []).map(function (item) {
              return '<div><span>' + item.quantity + ' \u00d7 ' + item.name + '</span><strong>' + money(item.price * item.quantity) + '</strong></div>';
            }).join('') +
          '</div>' +
          '<footer>' +
            '<strong>Total ' + money(order.total) + '</strong>' +
            '<button class="order-status-button" data-order-action="' + (completed ? 'new' : 'complete') + '" data-order-id="' + order.id + '">' + (completed ? 'Mark as new' : 'Mark completed') + '</button>' +
            '<button class="text-button" data-order-action="delete" data-order-id="' + order.id + '">Delete</button>' +
          '</footer>' +
        '</article>'
      );
    }).join('');
  }

  async function showDashboard() {
    await loadOrders();
    loginView.classList.add('hidden');
    dashboard.classList.remove('hidden');
    renderOrders();
  }

  function authenticate() {
    var password = passwordInput.value;
    passwordInput.value = '';
    window.GhaliShop.login(password)
      .then(function (result) {
        sessionStorage.setItem('ghalishop-api-token', result.token);
        sessionStorage.setItem(CHECKOUT_SESSION_KEY, String(Date.now() + CHECKOUT_TTL_MS));
        loginError.classList.remove('visible');
        return showDashboard();
      })
      .catch(function () {
        loginError.classList.add('visible');
      });
  }

  function pushOrders() {
    writeOrders();
    return window.GhaliShop.apiRequest('/api/orders', {
      method: 'PUT',
      body: JSON.stringify(orders)
    }).catch(function () { return orders; });
  }

  loginForm.addEventListener('submit', function (event) {
    event.preventDefault();
    authenticate();
  });

  document.querySelector('#checkout-logout').addEventListener('click', function () {
    sessionStorage.removeItem(CHECKOUT_SESSION_KEY);
    dashboard.classList.add('hidden');
    loginView.classList.remove('hidden');
    renderOrders();
  });

  document.querySelector('#clear-orders').addEventListener('click', function () {
    orders = orders.filter(function (order) { return order.status !== 'Completed'; });
    pushOrders().then(renderOrders);
  });

  document.querySelector('#orders-list').addEventListener('click', function (event) {
    var button = event.target.closest('[data-order-action]');
    if (!button) return;
    var id = button.dataset.orderId;
    var order = orders.find(function (item) { return item.id === id; });
    if (!order) return;

    if (button.dataset.orderAction === 'delete') {
      orders = orders.filter(function (item) { return item.id !== id; });
    } else {
      order.status = button.dataset.orderAction === 'complete' ? 'Completed' : 'New';
    }
    pushOrders().then(renderOrders);
  });

  var session = Number(sessionStorage.getItem(CHECKOUT_SESSION_KEY));
  if (session > Date.now()) {
    window.GhaliShop.ready.then(showDashboard);
  } else {
    sessionStorage.removeItem(CHECKOUT_SESSION_KEY);
  }
})();