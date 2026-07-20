/* shared.js — 后台通用逻辑：登录守卫 / 填充管理员信息 / 退出 / 工具函数 */
(function(){
  'use strict';
  /* API 基址：优先读取 config.js 的全局配置，未加载时兜底 */
  var API=(typeof window!=='undefined' && window.XZWP_API)?window.XZWP_API:'/api/';

  function req(u, body){
    if (body) {
      return fetch(API+u, {method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body:JSON.stringify(body)})
        .then(function(r){ return r.ok ? r.json() : {code:1, msg:'接口异常 '+r.status}; })
        .catch(function(){ return {code:1, msg:'网络错误'}; });
    }
    return fetch(API+u, {credentials:'include'})
      .then(function(r){ return r.ok ? r.json() : {code:1, msg:'接口异常 '+r.status}; })
      .catch(function(){ return {code:1, msg:'网络错误'}; });
  }
  function ok(r){ return r && r.code === 0; }
  function toast(m, t){
    var e = document.getElementById('toast');
    if (!e) { e = document.createElement('div'); e.id='toast'; e.className='toast'; document.body.appendChild(e); }
    e.textContent = m; e.className = 'toast show' + (t ? ' toast--'+t : '');
    clearTimeout(toast._t); toast._t = setTimeout(function(){ e.className='toast'; }, 2200);
  }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function fmt(t){
    if (!t) return '-';
    var d = new Date(t*1000), p = function(n){ return n<10?'0'+n:n; };
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());
  }
  function img(p){ if (!p) return ''; return p.indexOf('http')===0 ? p : (API+p); }

  /* 自定义确认弹窗（替代原生 confirm），返回 Promise<boolean> */
  function confirmDialog(opts){
    opts = opts || {};
    return new Promise(function(resolve){
      var mask = document.getElementById('admin-modal-mask');
      if (!mask){ mask = document.createElement('div'); mask.id='admin-modal-mask'; mask.className='amodal-mask'; document.body.appendChild(mask); }
      var okCls = opts.danger ? ' amodal-btn-danger' : ' amodal-btn-ok';
      mask.innerHTML =
        '<div class="amodal" role="dialog" aria-modal="true">' +
          '<div class="amodal-title">' + esc(opts.title || '确认操作') + '</div>' +
          '<div class="amodal-body">' + (opts.html || esc(opts.message || '')) + '</div>' +
          '<div class="amodal-foot">' +
            '<button class="amodal-btn amodal-btn-cancel" data-act="cancel">' + esc(opts.cancelText || '取消') + '</button>' +
            '<button class="amodal-btn' + okCls + '" data-act="ok">' + esc(opts.okText || '确定') + '</button>' +
          '</div>' +
        '</div>';
      var done = false;
      function close(v){ if (done) return; done = true; mask.classList.remove('show'); setTimeout(function(){ mask.innerHTML=''; }, 180); resolve(v); }
      mask.querySelector('[data-act=cancel]').onclick = function(){ close(false); };
      mask.querySelector('[data-act=ok]').onclick = function(){ close(true); };
      mask.onclick = function(e){ if (e.target === mask) close(false); };
      document.addEventListener('keydown', function onEsc(ev){ if (ev.key==='Escape'){ document.removeEventListener('keydown', onEsc); close(false); } });
      requestAnimationFrame(function(){ mask.classList.add('show'); });
    });
  }

  /* 登录态守卫 */
  req('admin.php?act=me').then(function(r){
    if (!ok(r)) { location.href = 'admin.html'; return; }
    var n = (r.data && r.data.name) || '';
    ['adminName','sideName'].forEach(function(id){ var el=document.getElementById(id); if(el) el.textContent=n; });
    var av = document.getElementById('sideAvatar'); if (av) av.textContent = (n.charAt(0)||'A').toUpperCase();
  });

  /* 退出（事件委托，任意 [data-act=logout] 触发） */
  document.addEventListener('click', function(e){
    var t = e.target.closest('[data-act=logout]');
    if (!t) return;
    e.preventDefault();
    req('admin.php?act=logout').then(function(){ location.href='admin.html'; });
  });

  /* ---------- 图片放大 Lightbox（后台） ---------- */
  var _lb = null;
  function lightbox(src) {
    if (!src) return;
    if (!_lb) {
      _lb = document.createElement('div');
      _lb.id = 'admin-lightbox';
      _lb.className='alb';
      document.body.appendChild(_lb);
    }
    var saveCls = src.startsWith('data:') ? ' alb-hide' : '';
    _lb.innerHTML =
      '<div class="alb-mask"></div>' +
      '<div class="alb-inner">' +
        '<img class="alb-img" src="'+esc(src)+'" alt="预览大图"/>' +
        '<div class="alb-bar'+saveCls+'">' +
          '<button class="alb-btn" data-act="zi" title="放大"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg></button>' +
          '<button class="alb-btn" data-act="zo" title="缩小"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M8 11h6"/></svg></button>' +
          '<button class="alb-btn" data-act="save" title="保存图片"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> 保存</button>' +
          '<button class="alb-btn alb-close" data-act="close">&times;</button>' +
        '</div>' +
      '</div>';
    var img=_lb.querySelector('.alb-img'), scale=1, px=0, py=0, dragging=false, sx, sy;
    function setT(){ img.style.transform='translate('+px+'px,'+py+'px) scale('+scale+')'; }
    function reset(){ scale=1; px=0; py=0; setT(); }

    _lb.querySelector('[data-act=zi]').onclick=function(){ scale=Math.min(scale*1.4,5); setT(); };
    _lb.querySelector('[data-act=zo]').onclick=function(){ scale=Math.max(scale/1.4,.3); setT(); };
    _lb.querySelector('[data-act=save]').onclick=function(){
      if(src.startsWith('data:'))return;
      var a=document.createElement('a'); a.href=src; a.download=''; a.target='_blank';
      document.body.appendChild(a); a.click(); a.remove();
      toast('已开始下载','ok');
    };
    function close(){ _lb.classList.remove('show'); }
    _lb.querySelector('[data-act=close]').onclick=close;
    _lb.querySelector('.alb-mask').onclick=close;
    img.onclick=function(e){ e.stopPropagation(); };

    /* 拖拽 */
    img.addEventListener('mousedown',function(e){ dragging=true; sx=e.clientX-px; sy=e.clientY-py; e.preventDefault(); });
    document.addEventListener('mousemove',function(e){ if(!dragging)return; px=e.clientX-sx; py=e.clientY-sy; setT(); });
    document.addEventListener('mouseup',function(){ dragging=false; });
    /* 滚轮 */
    _lb.addEventListener('wheel',function(e){ e.preventDefault(); var d=e.deltaY>0?.9:1.1; scale=Math.max(.3,Math.min(5,scale*d)); setT(); },{passive:false});
    /* 触摸 */
    var ld=0,lcx=0,lcy=0;
    img.addEventListener('touchstart',function(e){
      if(e.touches.length===1){dragging=true;sx=e.touches[0].clientX-px;sy=e.touches[0].clientY-py;}
      else if(e.touches.length===2){var dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY;ld=Math.sqrt(dx*dx+dy*dy);lcx=(e.touches[0].clientX+e.touches[1].clientX)/2;lcy=(e.touches[0].clientY+e.touches[1].clientY)/2;}
    },{passive:true});
    img.addEventListener('touchmove',function(e){
      e.preventDefault();
      if(e.touches.length===1&&dragging){px=e.touches[0].clientX-sx;py=e.touches[0].clientY-sy;setT();}
      else if(e.touches.length===2){var dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY,d=Math.sqrt(dx*dx+dy*dy);if(ld>0){scale=Math.max(.3,Math.min(5,scale*(d/ld)));setT();}ld=d;}
    },{passive:false});
    img.addEventListener('touchend',function(){dragging=false;ld=0;});
    /* ESC */
    function onEsc(e){if(e.key==='Escape'){close();document.removeEventListener('keydown',onEsc);} } document.addEventListener('keydown',onEsc);
    img.addEventListener('dblclick',reset);

    requestAnimationFrame(function(){_lb.classList.add('show'); reset();});
  }

  /* ---------- 系统配置（标题 / 图标 / 客服） ---------- */
  function iconHref(icon) {
    if (!icon) return '';
    if (icon.indexOf('http') === 0 || icon.indexOf('data:') === 0 || icon.indexOf('//') === 0) return icon;
    return API + icon.replace(/^(\.\.\/)?api\//, '');
  }
  function applyConfig(cfg) {
    if (!cfg) return;
    if (cfg.site_icon) {
      var href = iconHref(cfg.site_icon);
      var link = document.querySelector('link[rel~="icon"]');
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = href;
      var ap = document.querySelector('link[rel~="apple-touch-icon"]');
      if (!ap) { ap = document.createElement('link'); ap.rel = 'apple-touch-icon'; document.head.appendChild(ap); }
      ap.href = href;
    }
    if (cfg.site_title) {
      document.title = document.title.split('XZWP').join(cfg.site_title).split('闲置微铺').join(cfg.site_title);
    }
    var brandEls = document.querySelectorAll('[data-brand]');
    for (var i = 0; i < brandEls.length; i++) brandEls[i].textContent = cfg.site_title || '闲置微铺';
    var logoEls = document.querySelectorAll('[data-brand-logo]');
    for (var j = 0; j < logoEls.length; j++) {
      var el = logoEls[j];
      if (cfg.site_icon) {
        el.style.backgroundImage = 'url("' + iconHref(cfg.site_icon) + '")';
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
    return req('settings.php?act=get').then(function(r){
      if (ok(r) && r.data) applyConfig(r.data);
      return r.data;
    }).catch(function(){ return null; });
  }

  window.Admin = { API:API, req:req, ok:ok, toast:toast, esc:esc, fmt:fmt, img:img, confirm:confirmDialog, lightbox:lightbox, loadConfig:loadConfig, applyConfig:applyConfig };

  /* 自动应用站点配置（标题 / favicon / 品牌） */
  loadConfig();
})();
