/* =========================================================
 * common.js — 公共层
 * 1) UI 工具：Toast / Modal / 导航栏 / 页脚
 * 2) 登录态（display session 存 localStorage，仅用于界面展示）
 * 3) API 对象：真实对接 api/*.php（同域 fetch）
 *
 * 后端返回约定：{"code":0,"msg":"","data":{...}}（code!=0 为失败）
 * ========================================================= */
(function (global) {
  'use strict';

  /* ---------- localStorage 键 ---------- */
  const K = {
    session: 'xzwp_session',       // {id,username,nickname} 仅展示用
    cache_user: 'xzwp_cache_user', // 最新用户对象（含 balance）
    migrated: 'xzwp_migrated_v1',
  };

  const read = (k, def) => {
    try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); }
    catch (e) { return def; }
  };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  /* ---------- 从模拟数据迁移到真实后端（仅一次） ---------- */
  if (!localStorage.getItem(K.migrated)) {
    ['xzwp_users', 'xzwp_products', 'xzwp_orders', 'xzwp_session', 'xzwp_cache']
      .forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(K.migrated, '1');
  }

  /* ---------- 显示用会话 ---------- */
  function saveUser(u) {
    if (!u) return;
    write(K.cache_user, u);
    write(K.session, { id: u.id, username: u.username, nickname: u.nickname });
  }
  function clearUser() {
    localStorage.removeItem(K.session);
    localStorage.removeItem(K.cache_user);
  }

  /* ---------- fetch 封装 ---------- */
  function req(url, payload) {
    const opt = { method: payload ? 'POST' : 'GET', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' } };
    if (payload) opt.body = JSON.stringify(payload);
    return fetch(url, opt)
      .then((r) => (r.ok ? r.json() : { code: 1, msg: '接口返回异常 ' + r.status }))
      .catch(() => ({ code: 1, msg: '网络错误，请确认通过 http 访问且 api 可连通' }));
  }
  const ok = (r) => r && r.code === 0;

  /* =========================================================
   * API —— 全部对接真实后端；返回形状与页面调用保持一致
   * ========================================================= */
  const API = {
    /* 商品 */
    getProducts() {
      return req('api/products.php').then((r) => (ok(r) && r.data) || []);
    },
    getMyProducts(publisher) {
      return req('api/products.php?mine=1&publisher=' + encodeURIComponent(publisher))
        .then((r) => (ok(r) && r.data) || []);
    },
    createProduct(data) {
      return req('api/products.php', data).then((r) => (ok(r) ? r : { code: 1, msg: r.msg || '发布失败' }));
    },
    updateProduct(id, patch) {
      return req('api/products.php?act=update', Object.assign({ id }, patch))
        .then((r) => (ok(r) ? r : { code: 1, msg: r.msg || '操作失败' }));
    },
    deleteProduct(id) {
      return req('api/products.php?act=delete', { id })
        .then((r) => (ok(r) ? r : { code: 1, msg: r.msg || '删除失败' }));
    },

    /* 用户 / 认证 */
    register(p) {
      return req('api/auth.php?act=register', p).then((r) => {
        if (ok(r) && r.data) saveUser(r.data);
        return r;
      });
    },
    login(p) {
      return req('api/auth.php?act=login', p).then((r) => {
        if (ok(r) && r.data) saveUser(r.data);
        return r;
      });
    },
    logout() {
      return req('api/auth.php?act=logout').then((r) => { clearUser(); return r; });
    },
    getSession() { return read(K.session, null); },
    getUser() { return read(K.cache_user, null); },
    changePassword(oldP, newP) {
      return req('api/auth.php?act=pwd', { oldP, newP });
    },

    /* 资金 */
    recharge(amount) {
      return req('api/wallet.php?act=recharge', { amount }).then((r) => {
        if (ok(r) && r.data) saveUser(r.data);
        return r;
      });
    },
    withdraw(amount) {
      return req('api/wallet.php?act=withdraw', { amount }).then((r) => {
        if (ok(r) && r.data) saveUser(r.data);
        return r;
      });
    },

    /* 订单 */
    createOrder(product) {
      return req('api/order.php', { productId: product.id }).then((r) => {
        if (ok(r) && r.data && r.data.user) saveUser(r.data.user);
        return r;
      });
    },
    getOrders() {
      return req('api/order.php').then((r) => (ok(r) && r.data) || []);
    },

    /* 缓存 */
    clearCache() {
      localStorage.removeItem('xzwp_cache');
      return Promise.resolve({ code: 0 });
    },
  };

  /* =========================================================
   * UI 助手
   * ========================================================= */
  function toast(msg, type) {
    let el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = msg;
    el.className = 'toast show' + (type ? ' toast--' + type : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.className = 'toast'; }, 2200);
  }

  function modal({ title, body, confirmText, onConfirm, cancelText }) {
    let mask = document.getElementById('modal-mask');
    if (!mask) {
      mask = document.createElement('div');
      mask.id = 'modal-mask'; mask.className = 'modal-mask';
      document.body.appendChild(mask);
    }
    mask.innerHTML =
      '<div class="modal">' +
        '<div class="modal__title">' + (title || '') + '</div>' +
        '<div class="modal__body">' + (body || '') + '</div>' +
        '<div class="modal__row">' +
          '<button class="btn btn--ghost" data-act="cancel" style="flex:1">' + (cancelText || '取消') + '</button>' +
          '<button class="btn btn--primary" data-act="ok" style="flex:1">' + (confirmText || '确定') + '</button>' +
        '</div>' +
      '</div>';
    const close = () => { mask.classList.remove('show'); mask.innerHTML = ''; };
    mask.querySelector('[data-act="cancel"]').onclick = close;
    mask.querySelector('[data-act="ok"]').onclick = () => {
      const res = onConfirm && onConfirm();
      if (res !== false) close();
    };
    mask.classList.add('show');
    return close;
  }

  function requireLogin(redirect) {
    if (!API.getSession()) {
      toast('请先登录', 'err');
      setTimeout(() => { location.href = (redirect || 'login.html'); }, 900);
      return false;
    }
    return true;
  }

  /* ---------- 导航栏 / 页脚 ---------- */
  function renderNav(active) {
    const nav = document.getElementById('navbar');
    if (!nav) return;
    const s = API.getSession();
    const user = API.getUser();
    const link = (href, name) =>
      '<a href="' + href + '"' + (active === href ? ' class="active"' : '') + '>' + name + '</a>';
    const right = (s && user)
      ? '<div class="nav-user">' +
          '<span class="nav-user__balance">余额 ¥' + (user.balance || 0) + '</span>' +
          (user.avatar
            ? '<span class="nav-user__avatar" style="background-image:url(' + user.avatar + ');background-size:cover;color:transparent">' + (user.nickname || '?').slice(0, 1) + '</span>'
            : '<span class="nav-user__avatar">' + (user.nickname || '?').slice(0, 1) + '</span>') +
        '</div>'
      : '<a class="btn-login" href="login.html">登录 / 注册</a>';
    nav.className = 'navbar';
    nav.innerHTML =
      '<div class="navbar__inner">' +
        '<a class="brand" href="index.html">' +
          '<span class="brand__logo">闲</span>' +
          '<span class="brand__name">闲置<b>微铺</b></span>' +
        '</a>' +
        '<nav class="nav">' +
          link('index.html', '首页') +
          link('manage.html', '管理') +
          link('user.html', '个人中心') +
        '</nav>' +
        '<span class="nav__spacer"></span>' + right +
      '</div>';
  }

  function renderFooter() {
    const el = document.getElementById('footer');
    if (!el) return;
    el.className = 'footer';
    el.innerHTML = '闲置微铺 · 让闲置流动起来 &nbsp;|&nbsp; © 2026 XZWP';
  }

  /* ---------- 暴露 ---------- */
  global.App = {
    K, read, write, API, toast, modal, requireLogin,
    renderNav, renderFooter,
    fmtTime(t) {
      const d = new Date(t * 1000); // PHP time() 为秒级
      const p = (n) => (n < 10 ? '0' + n : n);
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
        ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    },
  };
})(window);
