/* =========================================================
 * common.js — 公共层（置于 page/js/）
 * 1) UI 工具：Toast / Modal / 导航栏 / 页脚
 * 2) 登录态（display session 存 localStorage，仅用于界面展示）
 * 3) API 对象：真实对接 ../api/*.php（同域 fetch，按页面层级自动计算基址）
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

  /* ---------- 路径自适应 ----------
   * index.html 在站点根；其余页面都在 page/ 子目录。
   * 后端 api/ 始终位于站点根，因此按当前页面层级计算基址。 */
  const IN_PAGE = /(^|\/)page(\/|$)/.test(location.pathname);
  /* API 基址统一指向后端服务器（站点根下的 api/） */
  /* API 基址：优先读取 config.js 的全局配置，未加载时兜底 */
  const API_BASE = (typeof window !== 'undefined' && window.XZWP_API)
    ? window.XZWP_API
    : '/api/';
  // 图片存于站点根 uploads/，按层级补全（兼容后端返回 'uploads/..' 或 'api/uploads/..'）
  function img(path) {
    if (!path) return '';
    if (/^(https?:|\/\/|\/|data:)/.test(path)) return path;
    const u = path.replace(/^(\.\.\/)?api\//, '');
    return API_BASE + u;
  }

  /* ---------- 请求缓存 / 去重 / 加载态 ---------- */
  const _net = { cache: new Map(), inflight: new Map() };
  function netCacheGet(url) {
    const h = _net.cache.get(url);
    return (h && h.exp > Date.now()) ? h.val : null;
  }
  function netCacheSet(url, val, ttl) {
    _net.cache.set(url, { exp: Date.now() + (ttl || 10000), val: val });
  }
  function netCacheClear() { _net.cache.clear(); }

  /* 全局加载态：引用计数 + 120ms 防抖，快请求（<120ms）不闪 */
  let _ld = 0, _ldTimer = null;
  function loadingInc() {
    _ld++;
    if (_ld === 1) { _ldTimer = setTimeout(showLoading, 120); }
  }
  function loadingDec() {
    _ld = Math.max(0, _ld - 1);
    if (_ld === 0) { if (_ldTimer) { clearTimeout(_ldTimer); _ldTimer = null; } hideLoading(); }
  }
  function showLoading() {
    let el = document.getElementById('app-loading');
    if (!el) {
      el = document.createElement('div'); el.id = 'app-loading'; el.className = 'app-loading';
      el.innerHTML = '<div class="spinner"></div>';
      document.body.appendChild(el);
    }
    requestAnimationFrame(function () { el.classList.add('show'); });
  }
  function hideLoading() {
    const el = document.getElementById('app-loading');
    if (el) el.classList.remove('show');
  }

  /* ---------- fetch 封装（带缓存 / 去重 / 加载态） ---------- */
  function req(url, payload, opts) {
    opts = opts || {};
    const isGet = !payload;
    /* GET：先命中内存缓存；再复用进行中的同一请求（去重，避免并发重复拉取） */
    if (isGet && !opts.noCache) {
      const cached = netCacheGet(url);
      if (cached) return Promise.resolve(cached);
      if (_net.inflight.has(url)) return _net.inflight.get(url);
    }
    const opt = {
      method: isGet ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    };
    if (payload) opt.body = JSON.stringify(payload);

    let p = fetch(url, opt)
      .then((r) => (r.ok ? r.json() : { code: 1, msg: '接口返回异常 ' + r.status }))
      .catch(() => ({ code: 1, msg: '网络错误，请确认通过 http 访问且 api 可连通' }));

    if (isGet && !opts.noCache) {
      _net.inflight.set(url, p);
      p.finally(() => _net.inflight.delete(url));
    }
    if (opts.loading) loadingInc();
    p = p.then((data) => {
      if (isGet && !opts.noCache && data && data.code === 0) netCacheSet(url, data, opts.ttl);
      return data;
    }).finally(() => { if (opts.loading) loadingDec(); });
    return p;
  }
  const ok = (r) => r && r.code === 0;

  /* =========================================================
   * API —— 全部对接真实后端；返回形状与页面调用保持一致
   * ========================================================= */
  const API = {
    /* 商品（支持 params: {limit, kw, cat_id}） */
    getProducts(params) {
      var qs = '';
      if (params && typeof params === 'object') {
        if (params.limit)  qs += '&limit=' + encodeURIComponent(params.limit);
        if (params.kw)     qs += '&kw=' + encodeURIComponent(params.kw);
        if (typeof params.cat_id !== 'undefined') qs += '&cat_id=' + parseInt(params.cat_id || 0);
      }
      return req(API_BASE + 'products.php' + (qs ? '?' + qs.slice(1) : ''), null)
        .then((r) => (ok(r) && r.data) || []);
    },
    /* 分类列表 */
    getCategories() {
      return req(API_BASE + 'categories.php')
        .then((r) => (ok(r) && r.data) || []);
    },
    /* 轮播图（前端首页） */
    getBanners() {
      return req(API_BASE + 'banner.php?act=list')
        .then((r) => (ok(r) && r.data) || []);
    },
    getMyProducts(publisher) {
      return req(API_BASE + 'products.php?mine=1&publisher=' + encodeURIComponent(publisher), null, { loading: true })
        .then((r) => (ok(r) && r.data) || []);
    },
    createProduct(data) {
      return req(API_BASE + 'products.php', data).then((r) => {
        if (ok(r)) { netCacheClear(); if (r.data && r.data.user) saveUser(r.data.user); }
        return ok(r) ? r : { code: 1, msg: r.msg || '发布失败' };
      });
    },
    updateProduct(id, patch) {
      return req(API_BASE + 'products.php?act=update', Object.assign({ id }, patch)).then((r) => {
        if (ok(r)) { netCacheClear(); if (r.data && r.data.user) saveUser(r.data.user); }
        return ok(r) ? r : { code: 1, msg: r.msg || '操作失败' };
      });
    },
    deleteProduct(id) {
      return req(API_BASE + 'products.php?act=delete', { id }).then((r) => {
        if (ok(r)) { netCacheClear(); if (r.data && r.data.user) saveUser(r.data.user); }
        return ok(r) ? r : { code: 1, msg: r.msg || '删除失败' };
      });
    },

    /* 用户 / 认证 */
    register(p) {
      return req(API_BASE + 'auth.php?act=register', p).then((r) => {
        if (ok(r) && r.data) saveUser(r.data);
        return r;
      });
    },
    login(p) {
      return req(API_BASE + 'auth.php?act=login', p).then((r) => {
        if (ok(r) && r.data) saveUser(r.data);
        return r;
      });
    },
    logout() {
      return req(API_BASE + 'auth.php?act=logout').then((r) => { clearUser(); return r; });
    },
    getSession() { return read(K.session, null); },
    getUser() { return read(K.cache_user, null); },
    me() {
      return req(API_BASE + 'auth.php?act=me', null, { loading: true }).then((r) => {
        if (ok(r) && r.data) saveUser(r.data);
        return r;
      });
    },
    changePassword(oldP, newP) {
      return req(API_BASE + 'auth.php?act=pwd', { oldP, newP });
    },

    /* 资金 */
    recharge(amount) {
      return req(API_BASE + 'wallet.php?act=recharge', { amount }).then((r) => {
        /* 等余额刷新完成再 resolve，保证后续读到最新余额 */
        if (ok(r)) return req(API_BASE + 'auth.php?act=me').then((mr) => { if (ok(mr) && mr.data) saveUser(mr.data); return r; });
        return r;
      });
    },
    withdraw(amount, payInfo) {
      return req(API_BASE + 'wallet.php?act=withdraw', Object.assign({ amount }, (payInfo || {}))).then((r) => {
        if (ok(r)) return req(API_BASE + 'auth.php?act=me').then((mr) => { if (ok(mr) && mr.data) saveUser(mr.data); return r; });
        return r;
      });
    },

    /* 订单（data = { productId, buyerNote?, buyerImg? }） */
    createOrder(data) {
      return req(API_BASE + 'order.php', data).then((r) => {
        if (ok(r)) netCacheClear();
        if (ok(r) && r.data && r.data.user) saveUser(r.data.user);
        return r;
      });
    },
    getOrders() {
      return req(API_BASE + 'order.php', null, { loading: true })
        .then((r) => (ok(r) && r.data) || []);
    },

    /* 收款账户（充值页用） */
    getPayConfigs(type) {
      return req(API_BASE + 'pay_config.php?act=list&type=' + encodeURIComponent(type || 'recharge'), null, { loading: true })
        .then((r) => (ok(r) && r.data) || []);
    },

    /* 缓存 */
    clearCache() {
      netCacheClear();
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

  /* 自定义确认弹窗（替代原生 confirm），返回 Promise<boolean> */
  function confirmDialog(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      let mask = document.getElementById('modal-mask');
      if (!mask) {
        mask = document.createElement('div');
        mask.id = 'modal-mask'; mask.className = 'modal-mask';
        document.body.appendChild(mask);
      }
      const okCls = opts.danger ? 'btn--danger' : 'btn--primary';
      mask.innerHTML =
        '<div class="modal">' +
          '<div class="modal__title">' + (opts.title || '确认操作') + '</div>' +
          '<div class="modal__body">' + (opts.html || opts.message || '') + '</div>' +
          '<div class="modal__row">' +
            '<button class="btn btn--ghost" data-act="cancel" style="flex:1">' + (opts.cancelText || '取消') + '</button>' +
            '<button class="btn ' + okCls + '" data-act="ok" style="flex:1">' + (opts.okText || '确定') + '</button>' +
          '</div>' +
        '</div>';
      let done = false;
      const close = (v) => { if (done) return; done = true; mask.classList.remove('show'); mask.innerHTML = ''; resolve(v); };
      mask.querySelector('[data-act="cancel"]').onclick = () => close(false);
      mask.querySelector('[data-act="ok"]').onclick = () => close(true);
      mask.onclick = (e) => { if (e.target === mask) close(false); };
      mask.classList.add('show');
    });
  }

  function requireLogin() {    if (!API.getSession()) {
      toast('请先登录', 'err');
      setTimeout(() => { location.href = (IN_PAGE ? 'login.html' : 'page/login.html'); }, 900);
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
    const home = IN_PAGE ? '../index.html' : 'index.html';
    const page = (name) => (IN_PAGE ? name : 'page/' + name);
    const link = (key, href, name) =>
      '<a href="' + href + '"' + (active === key ? ' class="active"' : '') + '>' +
        '<svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        (key === 'index.html'
          ? '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'
          : (key === 'manage.html'
            ? '<path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4M4 7l8 4M4 7v10l8 4"/><line x1="12" y1="11" x2="12" y2="17"/>'
            : '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>')) +
        '</svg>' + name + '</a>';
    const right = (s && user)
      ? '<div class="nav-user">' +
          '<span class="nav-user__balance">余额 ¥' + (user.balance || 0) + '</span>' +
          (user.avatar
            ? '<span class="nav-user__avatar" style="background-image:url(' + img(user.avatar) + ');background-size:cover;color:transparent">' + (user.nickname || '?').slice(0, 1) + '</span>'
            : '<span class="nav-user__avatar">' + (user.nickname || '?').slice(0, 1) + '</span>') +
        '</div>'
      : '<a class="btn-login" href="' + page('login.html') + '">登录 / 注册</a>';
    nav.className = 'navbar';
    const cfgTitle = (_cfgCache && _cfgCache.site_title) || '闲置微铺';
    const cfgIcon = (_cfgCache && _cfgCache.site_icon) || '';
    const logoHtml = cfgIcon
      ? '<span class="brand__logo"><img src="' + img(cfgIcon) + '" alt="logo" style="width:100%;height:100%;object-fit:cover;border-radius:9px" /></span>'
      : '<span class="brand__logo">' + esc(cfgTitle.slice(0, 1)) + '</span>';
    nav.innerHTML =
      '<div class="navbar__inner">' +
        '<a class="brand" href="' + home + '">' +
          logoHtml +
          '<span class="brand__name" data-brand>' + esc(cfgTitle) + '</span>' +
        '</a>' +
        '<nav class="nav">' +
          link('index.html', home, '首页') +
          link('manage.html', page('manage.html'), '管理') +
          link('user.html', page('user.html'), '个人中心') +
        '</nav>' +
        '<span class="nav__spacer"></span>' + right +
      '</div>';
  }

  function renderFooter() {
    const el = document.getElementById('footer');
    if (!el) return;
    const cfgTitle = (_cfgCache && _cfgCache.site_title) || '闲置微铺';
    el.className = 'footer';
    el.innerHTML = esc(cfgTitle) + ' · 让闲置流动起来 &nbsp;|&nbsp; © 2026';
  }

  /* ---------- 顶部标题栏（读取 body[data-title]，自动注入） ---------- */
  function renderTopbar() {
    const title = document.body.getAttribute('data-title');
    if (!title) return;
    if (document.getElementById('app-topbar')) return;
    const back = document.body.getAttribute('data-back');
    const bar = document.createElement('header');
    bar.id = 'app-topbar';
    bar.className = 'topbar';
    const backHtml = back
      ? '<a class="topbar__back" href="' + back + '" aria-label="返回">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
        '</a>'
      : '<span class="topbar__sp"></span>';
    bar.innerHTML =
      '<div class="topbar__inner">' +
        backHtml +
        '<span class="topbar__title">' + title + '</span>' +
        '<span class="topbar__sp"></span>' +
      '</div>';
    const nav = document.getElementById('navbar');
    if (nav && nav.parentNode) nav.parentNode.insertBefore(bar, nav.nextSibling);
    else document.body.insertBefore(bar, document.body.firstChild);
  }

  /* ---------- 顶栏标题自动注入 ---------- */
  if (document.body) renderTopbar();
  else document.addEventListener('DOMContentLoaded', renderTopbar);

  /* ---------- 自动拉取系统配置：favicon / 标题 / 品牌 ---------- */
  /* 防御性调用：确保即使 loadConfig 内部出错也不会阻断 window.App 赋值 */
  try { loadConfig(); } catch (e) { console.warn('[xzwp] loadConfig error:', e); }

  /* ---------- HTML 转义 ---------- */
  const esc = (s) => {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  };

  /* ---------- 全局图片放大 / 保存（Lightbox） ---------- */
  let _lb = null;
  function lightbox(src) {
    if (!src) return;
    if (!_lb) {
      _lb = document.createElement('div');
      _lb.id = 'app-lightbox';
      _lb.className = 'lightbox';
      document.body.appendChild(_lb);
    }
    const saveCls = src.startsWith('data:') ? ' lb-hide' : '';
    _lb.innerHTML =
      '<div class="lb-mask"></div>' +
      '<div class="lb-inner">' +
        '<img class="lb-img" src="' + esc(src) + '" alt="预览大图" />' +
        '<div class="lb-toolbar' + saveCls + '">' +
          '<button class="lb-btn" data-act="zoomIn"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg></button>' +
          '<button class="lb-btn" data-act="zoomOut"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M8 11h6"/></svg></button>' +
          '<button class="lb-btn" data-act="save"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>保存</button>' +
          '<button class="lb-btn lb-close" data-act="close">&times;</button>' +
        '</div>' +
      '</div>';
    const img = _lb.querySelector('.lb-img');
    let scale = 1, px = 0, py = 0, dragging = false, sx, sy;

    function setTransform() { img.style.transform = 'translate(' + px + 'px,' + py + 'px) scale(' + scale + ')'; }
    function resetView() { scale = 1; px = 0; py = 0; setTransform(); }

    /* 缩放按钮 */
    _lb.querySelector('[data-act=zoomIn]').onclick = function () {
      scale = Math.min(scale * 1.4, 5); setTransform();
    };
    _lb.querySelector('[data-act=zoomOut]').onclick = function () {
      scale = Math.max(scale / 1.4, 0.3); setTransform();
    };
    /* 保存：尝试下载 */
    _lb.querySelector('[data-act=save]').onclick = function () {
      if (src.startsWith('data:')) return;
      var a = document.createElement('a');
      a.href = src; a.download = ''; a.target = '_blank';
      document.body.appendChild(a);
      a.click(); a.remove();
      toast('已开始下载', 'ok');
    };
    /* 关闭 */
    function close() { _lb.classList.remove('show'); }
    _lb.querySelector('[data-act=close]').onclick = close;
    _lb.querySelector('.lb-mask').onclick = close;
    img.onclick = function (e) { e.stopPropagation(); };

    /* 拖拽平移 */
    img.addEventListener('mousedown', function (e) {
      dragging = true; sx = e.clientX - px; sy = e.clientY - py;
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      px = e.clientX - sx; py = e.clientY - sy; setTransform();
    });
    document.addEventListener('mouseup', function () { dragging = false; });

    /* 滚轮缩放 */
    _lb.addEventListener('wheel', function (e) {
      e.preventDefault();
      var d = e.deltaY > 0 ? 0.9 : 1.1;
      scale = Math.max(0.3, Math.min(5, scale * d)); setTransform();
    }, { passive: false });

    /* 触摸缩放/拖拽 */
    var lastDist = 0, lastCX = 0, lastCY = 0;
    img.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) { dragging = true; sx = e.touches[0].clientX - px; sy = e.touches[0].clientY - py; }
      else if (e.touches.length === 2) {
        dragging = false;
        var dx = e.touches[0].clientX - e.touches[1].clientX;
        var dy = e.touches[0].clientY - e.touches[1].clientY;
        lastDist = Math.sqrt(dx * dx + dy * dy);
        lastCX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        lastCY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      }
    }, { passive: true });
    img.addEventListener('touchmove', function (e) {
      e.preventDefault();
      if (e.touches.length === 1 && dragging) {
        px = e.touches[0].clientX - sx; py = e.touches[0].clientY - sy; setTransform();
      } else if (e.touches.length === 2) {
        var dx = e.touches[0].clientX - e.touches[1].clientX;
        var dy = e.touches[0].clientY - e.touches[1].clientY;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (lastDist > 0) { scale = Math.max(0.3, Math.min(5, scale * (dist / lastDist))); setTransform(); }
        lastDist = dist;
      }
    }, { passive: false });
    img.addEventListener('touchend', function () { dragging = false; lastDist = 0; });

    /* ESC 关闭 */
    function onEsc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); } }
    document.addEventListener('keydown', onEsc);

    /* 双击重置 */
    img.addEventListener('dblclick', resetView);

    requestAnimationFrame(function () { _lb.classList.add('show'); resetView(); });
  }

  /* ---------- 系统配置（标题 / 图标 / 客服） ---------- */
  let _cfgCache = null;
  function _iconHref(icon) {
    if (!icon) return '';
    if (/^(https?:|\/\/|data:)/.test(icon)) return icon;
    return API_BASE + icon.replace(/^(\.\.\/)?api\//, '');
  }
  function applyConfig(cfg) {
    if (!cfg) return;
    /* favicon（浏览器标签图标） */
    if (cfg.site_icon) {
      const href = _iconHref(cfg.site_icon);
      let link = document.querySelector('link[rel~="icon"]');
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = href;
      let ap = document.querySelector('link[rel~="apple-touch-icon"]');
      if (!ap) { ap = document.createElement('link'); ap.rel = 'apple-touch-icon'; document.head.appendChild(ap); }
      ap.href = href;
    }
    /* 浏览器标题：替换已知品牌占位（前端“闲置微铺” / 后台“XZWP”） */
    if (cfg.site_title) {
      document.title = document.title.split('闲置微铺').join(cfg.site_title).split('XZWP').join(cfg.site_title);
    }
    /* 标记了 data-brand 的元素文本统一为站点标题 */
    const brandEls = document.querySelectorAll('[data-brand]');
    for (let i = 0; i < brandEls.length; i++) brandEls[i].textContent = cfg.site_title || '闲置微铺';
    /* 标记了 data-brand-logo 的元素：有图标显示图，否则显示首字 */
    const logoEls = document.querySelectorAll('[data-brand-logo]');
    for (let i = 0; i < logoEls.length; i++) {
      const el = logoEls[i];
      if (cfg.site_icon) {
        el.style.backgroundImage = 'url("' + _iconHref(cfg.site_icon) + '")';
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.textContent = '';
      } else {
        el.style.backgroundImage = '';
        el.textContent = (cfg.site_title || '?').slice(0, 1);
      }
    }
  }
  function loadConfig() {
    /* 同步缓存优先：避免刷新闪烁 */
    if (!_cfgCache) {
      try { _cfgCache = JSON.parse(localStorage.getItem('xzwp_sys_cfg') || 'null'); } catch (e) { _cfgCache = null; }
      if (_cfgCache) { try { applyConfig(_cfgCache); } catch (e2) { console.warn('[xzwp] applyConfig cache error:', e2); } }
    }
    return req(API_BASE + 'settings.php?act=get').then((r) => {
      if (ok(r) && r.data) {
        _cfgCache = r.data;
        try { localStorage.setItem('xzwp_sys_cfg', JSON.stringify(r.data)); } catch (e) {}
        try { applyConfig(r.data); } catch (e2) { console.warn('[xzwp] applyConfig fetch error:', e2); }
      }
      return _cfgCache;
    }).catch(() => _cfgCache);
  }

  /* ---------- 暴露 ---------- */
  global.App = {
    K, read, write, API, toast, modal, confirm: confirmDialog, requireLogin, img,
    IN_PAGE, API_BASE,
    loading(on) { if (on) loadingInc(); else loadingDec(); },
    clearApiCache: netCacheClear,
    lightbox,
    renderNav, renderFooter, renderTopbar,
    config: () => _cfgCache,
    loadConfig, applyConfig,
    fmtTime(t) {
      const d = new Date(t * 1000); // PHP time() 为秒级
      const p = (n) => (n < 10 ? '0' + n : n);
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
        ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    },
  };
})(window);
