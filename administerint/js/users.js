/* users.js — 用户管理（Vue 3） */
(function(){
  'use strict';
  if (typeof Vue === 'undefined') { console.error('[xzwp-admin] Vue 未加载'); return; }
  if (typeof window.Admin === 'undefined') { console.error('[xzwp-admin] shared.js 未正确加载'); return; }
  var A = window.Admin;
  var timer = null;

  var app = Vue.createApp({
    data: function(){
      return {
        loading: false,
        kw: '',
        list: []
      };
    },
    mounted: function(){ this.load(); },
    methods: {
      load: function(kw){
        var self = this;
        self.loading = true;
        var url = 'admin.php?act=users';
        if (kw) url += '&kw=' + encodeURIComponent(kw);
        A.req(url).then(function(r){
          self.loading = false;
          if (A.ok(r)) self.list = r.data || [];
          else { A.toast(r.msg || '加载失败', 'err'); self.list = []; }
        });
      },
      onSearch: function(){
        var self = this;
        clearTimeout(timer);
        timer = setTimeout(function(){ self.load(self.kw); }, 300);
      },
      banUser: function(u){
        var v = u.banned == 1 ? 0 : 1;
        var self = this;
        A.req('admin.php?act=users&op=ban&id='+u.id+'&v='+v).then(function(r){
          if (A.ok(r)) { A.toast(r.msg||'已更新','ok'); self.load(self.kw); }
          else A.toast(r.msg||'失败','err');
        });
      },
      delUser: function(u){
        var self = this;
        A.confirm({ title:'删除用户', message:'确定删除用户「'+u.username+'」？此操作不可恢复。', okText:'删除', danger:true }).then(function(okd){
          if (!okd) return;
          A.req('admin.php?act=users&op=delete&id='+u.id).then(function(r){
            if (A.ok(r)) { A.toast('已删除','ok'); self.load(self.kw); }
            else A.toast(r.msg||'失败','err');
          });
        });
      },
      syncBalance: function(u){
        var self = this;
        A.confirm({ title:'同步余额', message:'确定根据财务审核记录重新计算「'+u.username+'」的余额？' }).then(function(okd){
          if (!okd) return;
          A.req('admin.php?act=users&op=sync_balance&id='+u.id).then(function(r){
            if (A.ok(r)) {
              A.toast('余额已同步：¥'+(r.data&&r.data.balance?Number(r.data.balance).toFixed(2):'0.00'), 'ok');
              self.load(self.kw);
            } else {
              A.toast(r.msg||'同步失败', 'err');
            }
          });
        });
      },
      fmt: function(val){ return Number(val||0).toFixed(2); },
      fmtTime: function(ts){
        if (!ts) return '-';
        var d = new Date(ts * 1000);
        var p = function(n){return n<10?'0'+n:''+n;};
        return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());
      }
    }
  });
  app.mount('#userApp');
})();
