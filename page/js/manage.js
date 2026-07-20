/* manage.js — 管理页（Vue 3） v20260715c */
console.log('[xzwp] manage.js v20260715c start');
(function(){
  'use strict';

  if (typeof Vue === 'undefined') { console.error('[xzwp] Vue 未加载'); return; }
  if (typeof window === 'undefined' || !window.App) { console.error('[xzwp] App 缺失'); return; }

  var App = window.App, API, toast;
  try { API = App.API; toast = App.toast; } catch(e) { console.error('[xzwp] API读取失败:',e); return; }
  if (!API) return;
  if (!toast) toast = function(m){ console.warn('[toast]',m); };

  /* 用户信息（安全降级） */
  var _u = {};
  try { var tmp = API.getUser && API.getUser(); if(tmp&&typeof tmp==='object') _u=tmp; } catch(e){}

  /* 登录态同步：先从后端拉取，写入localStorage后再渲染导航栏 */
  var _loginReady = false;
  function syncLogin() {
    if (_loginReady) return Promise.resolve();
    _loginReady = true;
    /* 如果 localStorage 已有 session，直接通过 */
    if (App.API && App.API.getSession()) return Promise.resolve();
    /* 否则请求后端 me 接口，同步登录态到 localStorage */
    if (App.API && App.API.me) {
      return App.API.me().then(function(){ return; }).catch(function(){
        console.warn('[xzwp] me 接口异常');
      });
    }
    return Promise.resolve();
  }

  var app;
  try {
    app = Vue.createApp({
      data: function(){
        return {
          tab: 'publish',
          publishing: false,
          imgData: '',
          imgHint: '点击上传商品图',
          form: { title: '', price: '', category_id: 0, description: '' },   /* 全部用字符串/数字，避免 null 问题 */
          nick: (_u.nickname||''),
          bal: Number(_u.balance)||0,
          list: [],       /* 原始数组 */
          categories: [],  /* 分类列表（发布时选择） */
          ok: false        /* mounted 标记 */
        };
      },

      computed: {
        bTxt: function(){ return this.bal.toFixed(2); },
        btnTxt: function(){ return this.publishing ? '发布中...' : '发布商品'; },
        showMine: function(){ return this.tab==='mine'; },
        showPub: function(){ return this.tab==='publish'; },
        hasList: function(){
          try { return Array.isArray(this.list)&&this.list.length>0; } catch(e){ return false; }
        }
      },

      mounted: function(){
        this.ok = true;
        var self = this;
        /* 加载分类列表 */
        if(API.getCategories){
          API.getCategories().then(function(list){ self.categories=list||[]; }).catch(function(){});
        }
        /* 子页面：使用顶部返回栏（data-back=../index.html），不渲染底部导航 */
        syncLogin().then(function(){
          self.refMe();
        }).catch(function(){
          self.refMe();
        });
      },

      methods: {
        /* ========== 纯数据访问方法（全部 try-catch） ========== */
        gS: function(p){ try{ return p&&(typeof p==='object')?(p.status||'off'):'off'; }catch(e){return'off';} },
        gT: function(p){ try{ return p&&(typeof p==='object')?(p.title||''):''; }catch(e){return'';} },
        gP: function(p){ try{ var n=p&&(typeof p==='object')?Number(p.price):0; return isNaN(n)?0:n; }catch(e){return 0;} },
        gD: function(p){ try{ var n=p&&(typeof p==='object')?Number(p.deposit):0; return isNaN(n)?0:n; }catch(e){return 0;} },
        gPub: function(p){ try{ return p&&(typeof p==='object')?(p.publisher||''):''; }catch(e){return'';} },
        gId: function(p){ try{ return p&&(typeof p==='object')?p.id:null; }catch(e){return null;} },
        gImg: function(p){
          try{
            if(!p||typeof p!=='object') return '';
            var raw = p.img||'';
            if(!raw) return '';
            return (App.img&&App.img(raw))||'';
          }catch(e){ return ''; }
        },

        isOn: function(p){ return this.gS(p)==='on'; },
        isSold: function(p){ return this.gS(p)==='sold'; },
        sLabel: function(p){ var s=this.gS(p); return s==='on'?'在售':s==='sold'?'已售出':'已下架'; },
        sCls: function(p){ var s=this.gS(p); return s==='on'?'badge--on':s==='sold'?'badge--sold':'badge--off'; },
        hasDep: function(p){ return this.gD(p)>0; },

        /* ========== 操作方法 ========== */
        swTab: function(t){ this.tab=t; if(t==='mine') this.doLoad(); },

        onImg: function(e){
          var f=e.target.files&&e.target.files[0]; if(!f)return;
          var self=this,r=new FileReader();
          r.onload=function(){ try{ self.imgData=r.result||''; }catch(e2){} };
          r.readAsDataURL(f);
        },

        doPub: function(){
          var self=this,f=self.form;
          if(!(f.title&&f.title.trim())){ toast('请填写标题','err'); return; }
          var pr=parseFloat(f.price);
          if(isNaN(pr)||pr<0){ toast('价格无效','err'); return; }
          if(!self.imgData){ toast('请上传图片','err'); return; }
          self.publishing=true;
          API.createProduct({title:f.title.trim(),price:pr,deposit:0,category_id:Number(f.category_id)||0,publisher:self.nick,img:self.imgData,desc:f.description.trim()||f.title.trim()})
            .then(function(r){
              self.publishing=false;
              if(r&&r.code===0){
                toast('发布成功','ok');
                f.title='';f.price='';f.deposit='';f.category_id=0;f.description='';self.imgData='';
                self.refMe(); self.doLoad();
              }else{ toast((r&&r.msg)||'失败','err'); }
            })
            .catch(function(err){ self.publishing=false; console.error(err); toast('请求失败','err'); });
        },

        refMe: function(){
          try{ var u=(API.getUser&&API.getUser())||{}; if(u&&typeof u==='object'){ this.nick=u.nickname||''; this.bal=Number(u.balance)||0;} }catch(e){}
        },

        doLoad: function(){
          var self=this,n=self.nick;
          if(!n){ self.list=[]; return; }
          API.getMyProducts(n)
            .then(function(d){
              try{
                var arr=Array.isArray(d)?d:[];
                arr=arr.filter(function(x){ return x&&typeof x==='object'&&x.id!=null; });
                self.list=arr;
              }catch(e){ self.list=[]; }
            })
            .catch(function(e){ console.warn(e); self.list=[]; });
        },

        doToggle: function(p){
          var id=this.gId(p); if(id==null)return;
          var nx=this.isOn(p)?'off':'on',self=this;
          API.updateProduct(id,{status:nx})
            .then(function(r){
              if(r&&r.code===0){ toast(nx==='on'?'已上架':'已下架','ok'); self.refMe();self.doLoad(); }
              else{ toast((r&&r.msg)||'操作失败','err');}
            })
            .catch(function(e){ console.error(e); toast('操作失败','err'); });
        },

        doDel: function(p){
          var id=this.gId(p); if(id==null)return;
          var self=this,go=function(){
            API.deleteProduct(id).then(function(r){
              if(r&&r.code===0){ toast('已删除','ok'); self.refMe();self.doLoad(); }
              else{ toast((r&&r.msg)||'删除失败','err');}
            }).catch(function(e){ console.error(e); toast('删除失败','err'); });
          };
          var c=App.confirm;
          if(c&&typeof c==='function'){ c.call(App,{title:'删除',message:'确定删除？不可恢复。',okText:'删除',danger:true}).then(function(y){if(y)go();}); }
          else{ if(confirm('确定删除？')) go(); }
        },

        zoom: function(p){ try{ this.gImg(p)&&(App.lightbox&&App.lightbox(this.gImg(p))); }catch(e){} },
        imgSrc: function(p){ return this.gImg(p); }
      }
    });

    app.config.errorHandler = function(err,vm,info){
      console.error('[xzwp] 渲染异常:', info, err.message||err);
    };
  } catch(e) {
    console.error('[xzwp] createApp失败:', e); return;
  }

  try {
    app.mount('#manageApp');
    console.log('[xzwp] manage mount OK v20260715c');
  } catch(e) {
    console.error('[xzwp] mount失败:', e);
    var el=document.getElementById('manageApp');
    if(el) el.innerHTML='<div style="padding:30px;text-align:center;color:#999"><p>加载异常</p><button onclick="location.reload()" style="padding:8px24px;background:#13c2a3;color:#fff;border:none;border-radius:9px">刷新</button></div>';
  }
})();
console.log('[xzwp] manage.js v20260715c loaded');
