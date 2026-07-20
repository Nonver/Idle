/* product-detail.js — 商品详情页（Vue 3） */
(function(){
  'use strict';
  if (typeof Vue === 'undefined') { console.error('[xzwp] Vue 未加载'); return; }
  if (typeof window.App === 'undefined') { console.error('[xzwp] common.js 未正确加载'); return; }
  var App = window.App, API = App.API, toast = App.toast;

  /* 从 URL 参数读取商品 ID */
  function getParam(key) {
    var m = location.search.match(new RegExp('[?&]' + key + '=([^&]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  var app = Vue.createApp({
    data: function(){
      return {
        loading: true,
        product: null,
        categories: [],
        /* 购买弹窗 */
        showBuyModal: false, buying: false,
        buyerNote: '', buyerImg: '', buyerImgPreview: '',
        showCustomPrice: false, customAmount: 0,
        me: null
      };
    },
    mounted: function(){
      this.loadDetail();
      var self = this;
      if(API.getCategories){
        API.getCategories().then(function(list){ self.categories = list || []; }).catch(function(){});
      }
      try {
        if (API.me) {
          API.me().then(function(r){ self.me = r.data || r || null; }).catch(function(){});
        }
      } catch(e){}
    },
    computed: {
      productImg: function(){
        var p = this.product;
        if (!p) return '';
        return (p && p.img) ? App.img(p.img) : '';
      }
    },
    methods: {
      imgUrl: function(p){
        if (!p) return '';
        var src = p && (p.img || '');
        if (!src) return '';
        return App.img(src);
      },
      zoomImg: function(url){ if(url) App.lightbox(url); },

      loadDetail: function(){
        var self = this;
        var id = getParam('id');
        var type = getParam('type'); // ''=product | admin_order

        if (!id && !type) { self.loading = false; return; }

        // 从列表中查找（通过 sessionStorage 传递，或重新请求）
        var cached = null;
        try { cached = JSON.parse(sessionStorage.getItem('xzwp_detail_product')); } catch(e){}
        if (cached && String(cached.id||cached.order_id) === id && cached._type === type) {
          self.product = cached;
          self.loading = false;
          return;
        }

        // 没有缓存则从列表接口获取后匹配
        self.loading = true;
        API.getProducts({}).then(function(list){
          list = list || [];
          var found = null;
          if (type === 'admin_order') {
            found = list.find(function(p){ return p._type==='admin_order' && String(p.order_id)===id; });
          } else {
            found = list.find(function(p){ return p._type!=='admin_order' && String(p.id)===id; });
          }
          if (found) {
            self.product = found;
          } else {
            self.product = null;
          }
          self.loading = false;
        });
      },

      isOwn: function(p){
        try {
          return !!(this.me && p && p.publisher && this.me.nickname && p.publisher === this.me.nickname);
        } catch (e) { return false; }
      },

      catName: function(p){
        try{
          var cid = Number(p.category_id);
          if (!cid || !this.categories.length) return '';
          var c = this.categories.find(function(x){ return x.id === cid; });
          return c ? c.name : '';
        } catch(e){ return ''; }
      },

      doBuy: function(){
        if(!App.requireLogin())return;
        var p = this.product;
        if(!p)return;
        if(p._type !== 'admin_order' && this.isOwn(p)){ toast('不能购买自己发布的商品','err'); return; }
        this.showBuyModal = true;
        this.buying = false;
        this.buyerNote = ''; this.buyerImg = ''; this.buyerImgPreview = '';
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
        if(!self.product) return;
        self.buying = true;
        var orderData;
        if (self.product._type === 'admin_order') {
          orderData = { orderId: self.product.order_id };
          if(self.showCustomPrice && self.customAmount > 0){
            orderData.customAmount = self.customAmount;
          }
        } else {
          if(self.isOwn(self.product)){ toast('不能购买自己发布的商品','err'); self.showBuyModal=false; self.buying=false; return; }
          orderData = { productId: self.product.id };
        }
        if (self.buyerNote) orderData.buyerNote = self.buyerNote;
        if (self.buyerImg)  orderData.buyerImg  = self.buyerImg;
        API.createOrder(orderData).then(function(r){
          self.buying = false;
          if(r.code===0){toast('购买成功，款项已由平台托管','ok');self.showBuyModal=false;}
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
      console.error('[xzwp] detail 渲染异常:', err, info);
      return false;
    }
  });
  app.config.errorHandler = function(err, vm, info){
    console.error('[xzwp] detail 全局异常:', err, info);
  };
  try { app.mount('#detailApp'); } catch (e) { console.error('[xzwp] mount 失败', e); }
})();
