/* products-list.js — 商品列表页（搜索 + 分类 + 购买弹窗） */
(function(){
  'use strict';
  if (typeof Vue === 'undefined') { console.error('[xzwp] Vue 未加载'); return; }
  if (typeof window.App === 'undefined') { console.error('[xzwp] common.js 未正确加载'); return; }
  var App = window.App, API = App.API, toast = App.toast;

  var app = Vue.createApp({
    data: function(){
      return {
        list: [], categories: [],
        kw: '', activeCat: -1,
        loading: false,
        /* 购买弹窗 */
        showBuyModal: false, buyProduct: null, buying: false,
        buyerNote: '', buyerImg: '', buyerImgPreview: '',
        showCustomPrice: false, customAmount: 0,
        me: null
      };
    },
    mounted: function(){
      this.loadCats();
      this.loadList();
      /* 同步登录态 */
      var self = this;
      try {
        if (API.me) {
          API.me().then(function(r){ self.me = r.data || r || null; }).catch(function(){});
        }
      } catch(e){}
      /* 子页面：使用顶部返回栏（renderTopbar 自动读取 data-title），不渲染底部导航 */
    },
    methods: {
      imgUrl: function(p){ return App.img(p); },
      zoomImg: function(path){ App.lightbox(App.img(path)); },
      isOwn: function(p){
        try {
          return !!(this.me && p && p.publisher && this.me.nickname && p.publisher === this.me.nickname);
        } catch (e) { return false; }
      },

      /* ---- 搜索 & 分类 ---- */
      doSearch: function(){ this.loadList(); },
      clearKw: function(){ this.kw = ''; this.loadList(); },
      switchCat: function(catId){
        this.activeCat = catId;
        this.loadList();
      },

      loadCats: function(){
        var self = this;
        API.getCategories().then(function(list){ self.categories = list || []; });
      },
      loadList: function(){
        var self = this;
        self.loading = true;
        var params = {};
        if (self.kw)     params.kw = self.kw;
        if (self.activeCat >= 0) params.cat_id = self.activeCat;
        API.getProducts(params).then(function(list){
          self.list = list || [];
          self.loading = false;
        });
      },

      /* ---- 购买（复用首页逻辑） ---- */
      goDetail: function(p){
        try { sessionStorage.setItem('xzwp_detail_product', JSON.stringify(p)); } catch(e){}
        var params = 'id=' + (p._type==='admin_order' ? p.order_id : p.id);
        if(p._type) params += '&type=' + p._type;
        location.href = 'product-detail.html?' + params;
      },
      buy: function(p){
        if(!App.requireLogin())return;
        /* 管理员发布的订单（admin_order）无需检查是否自己发布 */
        if(p._type !== 'admin_order' && this.isOwn(p)){ toast('不能购买自己发布的商品','err'); return; }
        this.buyProduct = p;
        this.showBuyModal = true;
        this.buying = false;
        this.buyerNote = ''; this.buyerImg = ''; this.buyerImgPreview = '';
        // 自定义金额：官方商品开启了 custom_price 且价格>=2000 时可自定
        if(p._type === 'admin_order' && p.custom_price && Number(p.price) >= 2000){
          this.showCustomPrice = true;
          this.customAmount = Number(p.price);
        } else {
          this.showCustomPrice = false;
          this.customAmount = 0;
        }
      },
      confirmBuy: function(){
        var self = this;
        if(!self.buyProduct) return;
        self.buying = true;
        var orderData;
        if (self.buyProduct._type === 'admin_order') {
          // 管理员发布的订单：传 orderId
          orderData = { orderId: self.buyProduct.order_id };
          // 自定义金额
          if(self.showCustomPrice && self.customAmount > 0){
            orderData.customAmount = self.customAmount;
          }
        } else {
          // 普通商品：传 productId
          if(self.isOwn(self.buyProduct)){ toast('不能购买自己发布的商品','err'); self.showBuyModal=false; self.buying=false; return; }
          orderData = { productId: self.buyProduct.id };
        }
        if (self.buyerNote) orderData.buyerNote = self.buyerNote;
        if (self.buyerImg)  orderData.buyerImg  = self.buyerImg;
        API.createOrder(orderData).then(function(r){
          self.buying = false;
          if(r.code===0){toast('购买成功，款项已由平台托管','ok');self.showBuyModal=false;self.loadList();}
          else toast(r.msg,'err');
        });
      },
      pickBuyImg: function(e){
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        if (file.size > 5*1024*1024) { toast('图片不能超过 5MB','err'); return; }
        var self = this, reader = new FileReader();
        reader.onload = function(ev){
          self.buyerImgPreview = ev.target.result;
          self.buyerImg = ev.target.result;
        };
        reader.onerror = function(){ toast('图片读取失败','err'); };
        reader.readAsDataURL(file);
        e.target.value = '';
      },
      clearBuyImg: function(){
        this.buyerImg = ''; this.buyerImgPreview = '';
      }
    },
    errorCaptured: function(err, vm, info){
      console.error('[xzwp] products-list 渲染异常:', err, info);
      return false;
    }
  });
  app.config.errorHandler = function(err, vm, info){
    console.error('[xzwp] products-list 全局异常:', err, info);
  };
  try { app.mount('#plistApp'); } catch (e) { console.error('[xzwp] mount 失败', e); }
})();
