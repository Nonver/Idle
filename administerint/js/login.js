/* login.js — 后台登录页逻辑 */
(function(){
  'use strict';
  var API=(typeof window!=='undefined' && window.XZWP_API)?window.XZWP_API:'/api/';
  function req(u, body){
    return fetch(API+u, {method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body:JSON.stringify(body)})
      .then(function(r){ return r.ok ? r.json() : {code:1, msg:'接口异常 '+r.status}; })
      .catch(function(){ return {code:1, msg:'网络错误'}; });
  }
  function ok(r){ return r && r.code === 0; }

  /* 已登录则直接进仪表盘 */
  fetch(API+'admin.php?act=me', {credentials:'include'}).then(function(r){ return r.json(); }).then(function(r){
    if (ok(r)) location.href = 'dashboard.html';
  });

  document.getElementById('adminLoginForm').addEventListener('submit', function(e){
    e.preventDefault();
    var u = document.getElementById('adminUser').value.trim();
    var p = document.getElementById('adminPwd').value;
    var m = document.getElementById('msg');
    m.textContent = ''; m.className = 'login-msg';
    if (!u || !p) { m.textContent = '请输入账号和密码'; m.classList.add('visible'); return; }
    var b = this.querySelector('[type=submit]'); b.disabled = true; b.textContent = '登录中…';
    req('admin.php?act=login', {username:u, password:p}).then(function(r){
      b.disabled = false; b.textContent = '登 录';
      if (ok(r)) { location.href = 'dashboard.html'; }
      else { m.textContent = (r && r.msg) || '登录失败'; m.classList.add('visible'); }
    });
  });

  /* 应用站点配置：标题 / 浏览器图标 / 品牌 */
  function applyCfg(cfg){
    if (!cfg) return;
    if (cfg.site_icon) {
      var href = cfg.site_icon.indexOf('http') === 0 ? cfg.site_icon : (API + cfg.site_icon);
      var link = document.querySelector('link[rel~="icon"]');
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = href;
    }
    if (cfg.site_title) {
      document.title = document.title.split('XZWP').join(cfg.site_title).split('闲置微铺').join(cfg.site_title);
      var brandEls = document.querySelectorAll('[data-brand]');
      for (var i = 0; i < brandEls.length; i++) brandEls[i].textContent = cfg.site_title;
      var logoEls = document.querySelectorAll('[data-brand-logo]');
      for (var j = 0; j < logoEls.length; j++) {
        var el = logoEls[j];
        if (cfg.site_icon) {
          el.style.backgroundImage = 'url("' + (cfg.site_icon.indexOf('http') === 0 ? cfg.site_icon : (API + cfg.site_icon)) + '")';
          el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center'; el.textContent = '';
        } else { el.style.backgroundImage = ''; el.textContent = (cfg.site_title || '?').slice(0, 1); }
      }
    }
  }
  fetch(API+'settings.php?act=get', { credentials: 'include' })
    .then(function(r){ return r.json(); })
    .then(function(r){ if (r && r.code === 0) applyCfg(r.data); })
    .catch(function(){});
})();
