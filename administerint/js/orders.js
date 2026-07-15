/* orders.js — 订单管理（Vue 3） */
(function(){
  'use strict';
  var A = window.Admin;

  var app = Vue.createApp({
    data: function(){
      return { loading: false, list: [], busy: 0 };
    },
    mounted: function(){ this.load(); },
    methods: {
      imgUrl: function(p){ return A.img(p); },
      zoom: function(p){ A.lightbox(A.img(p)); },
      load: function(){
        var self = this;
        self.loading = true;
        A.req('admin.php?act=orders').then(function(r){
          self.loading = false;
          if (A.ok(r)) self.list = r.data || [];
          else { A.toast(r.msg||'加载失败','err'); self.list=[]; }
        });
      },
      statusText: function(s){
        return ({ pending:'平台托管中', completed:'已完成·已打款', rejected:'已驳回·已退款' })[s] || ('未知('+s+')');
      },
      statusClass: function(s){
        return ({ pending:'badge--warn', completed:'badge--ok', rejected:'badge--off' })[s] || 'badge--off';
      },
      ship: function(o){
        var self = this;
        A.confirm({ title:'确认发货', message:'确认向发布人「'+o.publisher+'」打款 ¥'+Number(o.price).toFixed(2)+'？\n打款后订单结束，操作不可撤销。', okText:'确认发货', danger:false }).then(function(okd){
          if (!okd) return;
          self.busy = o.id;
          A.req('admin.php?act=orders&op=ship&id='+o.id).then(function(r){
            self.busy = 0;
            if (A.ok(r)) { A.toast(r.msg||'已发货','ok'); o.status='completed'; }
            else { A.toast(r.msg||'失败','err'); }
          });
        });
      },
      reject: function(o){
        var self = this;
        A.confirm({ title:'驳回订单', message:'确认驳回该订单？\n¥'+Number(o.price).toFixed(2)+' 将退回买家「'+o.buyer+'」，商品重新上架。', okText:'确认驳回', danger:true }).then(function(okd){
          if (!okd) return;
          self.busy = o.id;
          A.req('admin.php?act=orders&op=reject&id='+o.id).then(function(r){
            self.busy = 0;
            if (A.ok(r)) { A.toast(r.msg||'已驳回','ok'); o.status='rejected'; }
            else { A.toast(r.msg||'失败','err'); }
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
  app.mount('#orderApp');
})();
