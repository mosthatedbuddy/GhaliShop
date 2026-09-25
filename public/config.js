(function () {
  'use strict';
  window.GhaliShopConfig = window.GhaliShopConfig || {};
  var base = window.GhaliShopApiBase || window.GhaliShopConfig.apiBase || window.location.origin;
  window.GhaliShopConfig.apiBase = String(base).replace(/\/+$/, '');
})();