/* orders.js — 订单管理（Vue 3） */
(function(){
  'use strict';
  var App = window.App, API = App.API;

  var app = Vue.createApp({
    data: function(){
      return {
        loaded: false,
        currentTab: 'all',
        orderList: [],
        tabs: [
          { key:'all', label:'全部' },
          { key:'pending', label:'待发货' },
          { key:'completed', label:'已完成' },
          { key:'rejected', label:'已驳回' }
        ]
      };
    },
    computed: {
      filteredOrders: function(){
        var t = this.currentTab;
        if(t==='all') return this.orderList;
        return this.orderList.filter(function(o){ return o.status===t; });
      }
    },
    mounted: function(){
      App.renderNav('orders.html');
      App.renderFooter();
      this.load();
    },
    methods: {
      imgUrl: function(path){ return App.img(path); },
      zoomImg: function(path){ App.lightbox(App.img(path)); },

      load: function(){
        var self = this;
        API.getOrders().then(function(list){
          self.orderList = list || [];
          self.loaded = true;
        });
      },

      statusText: function(s){
        return ({ pending:'待发货', completed:'已完成', rejected:'已驳回' })[s] || ('未知('+s+')');
      },
      statusBadgeClass: function(s){
        return ({ pending:'badge--warn', completed:'badge--ok', rejected:'badge--bad' })[s] || '';
      },

      fmtTime: App.fmtTime
    }
  });
  app.mount('#ordersApp');
})();
