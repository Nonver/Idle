/* products.js — 商品管理（Vue 3） */
(function(){
  'use strict';
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
          if (A.ok(r)) self.list = r.data || [];
          else { A.toast(r.msg||'加载失败','err'); self.list=[]; }
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
      toggleProd: function(p){
        var self = this;
        A.req('admin.php?act=products&op=toggle&id='+p.id).then(function(r){
          if (A.ok(r)) { A.toast('已切换','ok'); self.load(self.kw); }
          else A.toast(r.msg||'失败','err');
        });
      },
      delProd: function(p){
        var self = this;
        A.confirm({ title:'删除商品', message:'确定删除商品「'+(p.title||p.name||'')+'」？此操作不可恢复。', okText:'删除', danger:true }).then(function(okd){
          if (!okd) return;
          A.req('admin.php?act=products&op=delete&id='+p.id).then(function(r){
            if (A.ok(r)) { A.toast('已删除','ok'); self.load(self.kw); }
            else A.toast(r.msg||'失败','err');
          });
        });
      },
      fmt: function(val){ return Number(val||0).toFixed(2); }
    }
  });
  app.mount('#prodApp');
})();
