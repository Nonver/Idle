/* home.js — 首页（Vue 3） */
(function(){
  'use strict';
  if (typeof Vue === 'undefined') { console.error('[xzwp] Vue 未加载'); return; }
  if (typeof window.App === 'undefined') { console.error('[xzwp] common.js 未正确加载'); return; }
  var App=window.App, API=App.API, toast=App.toast;

  var DEFAULT_SLIDES=[
    {tag:'限时推荐',title:'闲置好物 低价捡漏',desc:'每天更新，手慢无',c1:'#13c2a3',c2:'#36d1dc'},
    {tag:'数码专区',title:'耳机 / 相机 / 游戏机',desc:'95新起，同城可面交',c1:'#5b86e5',c2:'#36d1dc'},
    {tag:'家具日用',title:'书桌 / 收纳 / 小家电',desc:'搬家清仓，自提更划算',c1:'#f7971e',c2:'#ff6a3d'}
  ];
  var autoTimer=null;

  var app=Vue.createApp({
    data:function(){
      return{
        slides:DEFAULT_SLIDES,
        curSlide:0,
        productList:[],
        showBuyModal:false,
        buyProduct:null,
        buying:false,
        me:null,                           /* 当前登录用户，用于判断是否为自己发布的商品 */
        buyerNote:'',                      /* 购买备注（选填） */
        buyerImg:'',                       /* 购买图片 base64（选填，提交时发后端） */
        buyerImgPreview:'',                /* 图片预览 URL（前端用，不发后端） */
        showCustomPrice:false,             /* 是否显示自定义金额输入 */
        customAmount:0                     /* 自定义购买金额 */
      };
    },
      mounted:function(){
      this.autoPlay();
      this.loadBanners();
      this.loadProducts();
      try { this.me = App.getUser() || {}; } catch (e) { this.me = {}; }
      App.renderNav('index.html');
      App.renderFooter();
    },
    methods:{
      imgUrl:function(path){return App.img(path);},
      zoomImg:function(path){ App.lightbox(App.img(path)); },
      loadBanners:function(){
        var self=this;
        API.getBanners().then(function(list){
          if(list && list.length){
            self.slides = list.map(function(b){
              return { img:b.img, link:b.link||'', title:b.title||'', tag:b.tag||'', desc:b.desc||'' };
            });
            self.curSlide = 0;
            self.resetAutoPlay();
          }
        });
      },
      go:function(i){
        this.curSlide=i;
        this.resetAutoPlay();
      },
      autoPlay:function(){ autoTimer=setInterval(function(){this.curSlide=(this.curSlide+1)%this.slides.length;}.bind(this),4000); },
      resetAutoPlay:function(){ clearInterval(autoTimer); this.autoPlay(); },
      loadProducts:function(){
        var self=this;
        API.getProducts({limit:4}).then(function(list){self.productList=list||[];});
      },
      goProducts:function(){
        window.location.href='page/products.html';
      },
      goDetail:function(p){
        try { sessionStorage.setItem('xzwp_detail_product', JSON.stringify(p)); } catch(e){}
        var params = 'id=' + (p._type==='admin_order' ? p.order_id : p.id);
        if(p._type) params += '&type=' + p._type;
        location.href = 'page/product-detail.html?' + params;
      },
      buy:function(p){
        if(!App.requireLogin())return;
        /* 发布人不可购买自己发布的商品 */
        if(this.isOwn(p)){ toast('不能购买自己发布的商品','err'); return; }
        this.buyProduct=p;
        this.showBuyModal=true;
        this.buying=false;
        this.buyerNote='';
        this.buyerImg='';
        this.buyerImgPreview='';
        // 自定义金额
        if(p._type === 'admin_order' && p.custom_price && Number(p.price) >= 2000){
          this.showCustomPrice = true;
          this.customAmount = Number(p.price);
        } else {
          this.showCustomPrice = false;
          this.customAmount = 0;
        }
      },
      isOwn:function(p){
        try {
          return !!(this.me && p && p.publisher && this.me.nickname && p.publisher === this.me.nickname);
        } catch (e) { return false; }
      },
      confirmBuy:function(){
        var self=this;
        if(!self.buyProduct)return;
        self.buying=true;
        /* 构建下单参数 */
        var orderData;
        if (self.buyProduct._type === 'admin_order') {
          orderData = { orderId: self.buyProduct.order_id };
          if(self.showCustomPrice && self.customAmount > 0){
            orderData.customAmount = self.customAmount;
          }
        } else {
          if(self.isOwn(self.buyProduct)){ toast('不能购买自己发布的商品','err'); self.showBuyModal=false; self.buying=false; return; }
          orderData = { productId: self.buyProduct.id };
        }
        if (self.buyerNote) orderData.buyerNote = self.buyerNote;
        if (self.buyerImg)  orderData.buyerImg  = self.buyerImg;
        API.createOrder(orderData).then(function(r){
          self.buying=false;
          if(r.code===0){toast('购买成功，款项已由平台托管','ok');self.showBuyModal=false;self.loadProducts();App.renderNav('index.html');}
          else toast(r.msg,'err');
        });
      },
      /* 选择购买图片 → 转 base64 预览 + 存储 */
      pickBuyImg:function(e){
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        /* 限制大小 5MB */
        if (file.size > 5*1024*1024) { toast('图片不能超过 5MB','err'); return; }
        var self = this;
        var reader = new FileReader();
        reader.onload = function(ev){
          self.buyerImgPreview = ev.target.result;
          self.buyerImg = ev.target.result;   /* base64 data URL，直接发给后端 */
        };
        reader.onerror = function(){ toast('图片读取失败','err'); };
        reader.readAsDataURL(file);
        /* 清空 input，允许重复选同一文件 */
        e.target.value = '';
      },
      /* 清除已选图片 */
      clearBuyImg:function(){
        this.buyerImg='';
        this.buyerImgPreview='';
      }
    },
    /* 防御：模板渲染异常不白屏，打印到控制台 */
    errorCaptured:function(err, vm, info){
      console.error('[xzwp] home 渲染异常:', err, info);
      return false; /* 不向上传播 */
    }
  });
  app.config.errorHandler = function(err, vm, info){
    console.error('[xzwp] home 全局渲染异常:', err, info);
  };
  try { app.mount('#homeApp'); } catch (e) { console.error('[xzwp] home Vue mount 失败:', e); }
})();
