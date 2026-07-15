/* manage.js — 管理页（Vue 3） */
(function(){
  'use strict';
  var App=window.App, API=App.API, toast=App.toast;
  if(!App.requireLogin()) return;

  var me = API.getUser();

  var app=Vue.createApp({
    data:function(){
      return{
        tab:'publish',
        publishing:false,
        imgData:'',
        imgHint:'点击上传商品图',
        form:{title:'',price:null},
        me:me||{},
        myList:[]
      };
    },
    mounted:function(){
      App.renderNav('manage.html');
      App.renderFooter();
    },
    methods:{
      imgUrl:function(path){ return App.img(path); },
      zoomImg:function(path){ App.lightbox(App.img(path)); },
      switchTab:function(t){
        this.tab=t;
        if(t==='mine') this.loadMine();
      },
      onImgChange:function(e){
        var f=e.target.files&&e.target.files[0]; if(!f)return;
        var r=new FileReader();
        r.onload=function(ev){ this.imgData=ev.target.result; }.bind(this);
        r.readAsDataURL(f);
      },
      doPublish:function(){
        var self=this, f=self.form;
        if(!f.title.trim()){toast('请填写商品标题','err');return;}
        if(!(f.price>=0)||isNaN(f.price)){toast('请填写有效价格','err');return;}
        if(!self.imgData){toast('请上传商品图片','err');return;}
        self.publishing=true;
        API.createProduct({title:f.title.trim(),price:f.price,publisher:self.me.nickname,img:self.imgData,desc:f.title.trim()}).then(function(){
          toast('发布成功','ok');
          f.title=''; f.price=null; self.imgData='';
          self.publishing=false; App.renderNav('manage.html');
        });
      },
      loadMine:function(){
        var self=this;
        API.getMyProducts(self.me.nickname).then(function(list){
          self.myList=list||[];
        });
      },
      toggleProd:function(p){
        var self=this, next=p.status==='on'?'off':'on';
        API.updateProduct(p.id,{status:next}).then(function(){
          toast(next==='on'?'已上架':'已下架','ok'); self.loadMine(); App.renderNav('manage.html');
        });
      },
      delProd:function(p){
        var self=this;
        App.confirm({ title:'删除商品', message:'确定删除该商品？此操作不可恢复。', okText:'删除', danger:true }).then(function(okd){
          if(!okd)return;
          API.deleteProduct(p.id).then(function(){toast('已删除','ok');self.loadMine();App.renderNav('manage.html');});
        });
      }
    }
  });
  app.mount('#manageApp');
})();
