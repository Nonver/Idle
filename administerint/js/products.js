/* products.js — 商品管理（Vue 3） */
(function(){
  'use strict';
  if (typeof Vue === 'undefined') { console.error('[xzwp-admin] Vue 未加载'); return; }
  if (typeof window.Admin === 'undefined') { console.error('[xzwp-admin] shared.js 未正确加载'); return; }
  var A = window.Admin;
  var timer = null;

  var app = Vue.createApp({
    data: function(){
      return { loading: false, kw: '', list: [] };
    },
    mounted: function(){ this.load(); },
    methods: {
      load: function(kw){
        var self = this;
        self.loading = true;
        var url = 'admin.php?act=products';
        if (kw) url += '&kw=' + encodeURIComponent(kw);
        A.req(url).then(function(r){
          self.loading = false;
          try {
            if (A.ok(r)) {
              var d = r.data;
              self.list = Array.isArray(d) ? d : [];
            } else {
              A.toast(r.msg||'加载失败','err');
              self.list = [];
            }
          } catch(e) {
            console.error('[products] load error:', e);
            self.list = [];
          }
        }).catch(function(err){
          console.error('[products] network:', err);
          self.loading = false;
          self.list = [];
        });
      },
      onSearch: function(){
        var self = this;
        clearTimeout(timer);
        timer = setTimeout(function(){ self.load(self.kw); }, 300);
      },
      imgUrl: function(path){
        if (!path) return '';
        /* 数据库存的已是相对路径如 "uploads/p_xxx.jpg" 或 "uploads/avatar_xxx.jpg"
           后台位于 administerint/，API 在 ../api/，所以图片在 ../api/{path} */
        if (/^https?:\/\//.test(path) || /^data:/i.test(path)) return path;
        var base = (A.API || '../api/').replace(/\/$/,'');
        return base + '/' + path.replace(/^\/+/,'');
      },
      zoomImg: function(path){ if(path) A.lightbox(this.imgUrl(path)); },
      offProd: function(p){
        var self = this;
        A.confirm({
          title: '下架商品',
          message: '确定下架「' + (p.title||p.name||'') + '」？保证金将退回发布人「' + (p.publisher||'') + '」账户。',
          okText: '确认下架'
        }).then(function(okd){
          if (!okd) return;
          A.req('admin.php?act=products&op=off&id='+p.id).then(function(r){
            if (A.ok(r)) { A.toast(r.msg || '已下架','ok'); self.load(self.kw); }
            else A.toast(r.msg || '下架失败','err');
          });
        });
      },
      fmt: function(val){ return Number(val||0).toFixed(2); },
      statusLabel: function(s){
        return s === 'on' ? '在售' : (s === 'sold' ? '已售出' : '已下架');
      },
      statusCls: function(s){
        if (s === 'on') return 'badge badge--on';
        if (s === 'sold') return 'badge badge--warn';
        return 'badge badge--off';
      }
    }
  });
  app.mount('#prodApp');
})();
