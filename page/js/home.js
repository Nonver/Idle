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
        me:null                            /* 当前登录用户，用于判断是否为自己发布的商品 */
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
        API.getProducts().then(function(list){self.productList=list||[];});
      },
      buy:function(p){
        if(!App.requireLogin())return;
        /* 发布人不可购买自己发布的商品 */
        if(this.isOwn(p)){ toast('不能购买自己发布的商品','err'); return; }
        this.buyProduct=p;
        this.showBuyModal=true;
        this.buying=false;
      },
      isOwn:function(p){
        try {
          return !!(this.me && p && p.publisher && this.me.nickname && p.publisher === this.me.nickname);
        } catch (e) { return false; }
      },
      confirmBuy:function(){
        var self=this;
        if(!self.buyProduct)return;
        if(self.isOwn(self.buyProduct)){ toast('不能购买自己发布的商品','err'); self.showBuyModal=false; return; }
        self.buying=true;
        API.createOrder(self.buyProduct).then(function(r){
          self.buying=false;
          if(r.code===0){toast('购买成功，已扣款','ok');self.showBuyModal=false;self.loadProducts();App.renderNav('index.html');}
          else toast(r.msg,'err');
        });
      }
    }
  });
  try { app.mount('#homeApp'); } catch (e) { console.error('[xzwp] home Vue mount 失败:', e); }
})();
