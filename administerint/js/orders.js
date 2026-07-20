/* orders.js — 订单管理（仅展示用户已购订单，Vue 3） */
(function(){
  'use strict';
  if (typeof Vue === 'undefined') { console.error('[xzwp-admin] Vue 未加载'); return; }
  if (typeof window.Admin === 'undefined') { console.error('[xzwp-admin] shared.js 未正确加载'); return; }
  var A = window.Admin;

  var app = Vue.createApp({
    data: function(){
      return {
        loading: false, list: [], busy: 0,
        showShip: false, shipOrder: null, shipAmount: 0, shipping: false
      };
    },
    mounted: function(){ this.load(); },
    methods: {
      imgUrl: function(p){ return A.img(p); },
      zoom: function(p){ A.lightbox(A.img(p)); },

      /* ---- 加载订单 ---- */
      load: function(){
        var self = this;
        self.loading = true;
        A.req('admin.php?act=orders').then(function(r){
          self.loading = false;
          if (A.ok(r)) {
            // 过滤：只展示已购买的交易单（pending/completed/rejected），不展示 available 发布单
            var data = r.data || [];
            if (Array.isArray(data)) {
              self.list = data.filter(function(o){ return o.status !== 'available'; });
            } else {
              self.list = [];
            }
          } else { A.toast(r.msg||'加载失败','err'); self.list=[]; }
        });
      },

      /* ---- 状态文字/样式 ---- */
      statusText: function(s){
        return ({ pending:'平台托管中', completed:'已完成·已打款', rejected:'已驳回·已退款' })[s] || ('未知('+s+')');
      },
      statusClass: function(s){
        return ({ pending:'badge--warn', completed:'badge--ok', rejected:'badge--off' })[s] || 'badge--off';
      },

      /* ---- 发货打款 ---- */
      openShip: function(o){
        this.shipOrder = o;
        this.shipAmount = Number(o.price || 0);
        this.showShip = true;
      },
      confirmShip: function(){
        var self = this;
        var amt = Number(self.shipAmount);
        if (isNaN(amt) || amt < 0) { A.toast('请输入有效的打款金额', 'err'); return; }
        if (!self.shipOrder) return;
        self.shipping = true;
        A.req('admin.php?act=orders&op=ship&id=' + self.shipOrder.id + '&amount=' + encodeURIComponent(amt)).then(function(r){
          self.shipping = false;
          if (A.ok(r)) {
            A.toast(r.msg || '已打款', 'ok');
            self.shipOrder.status = 'completed';
            self.shipOrder.actual_paid = amt;
            self.showShip = false;
          } else { A.toast(r.msg || '失败', 'err'); }
        });
      },

      /* ---- 驳回 ---- */
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

      /* ---- 工具 ---- */
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
