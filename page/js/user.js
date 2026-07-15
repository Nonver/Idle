/* user.js — 个人中心（Vue 3） */
(function(){
  'use strict';
  var App = window.App, API = App.API, toast = App.toast;

  var app = Vue.createApp({
    data: function(){
      return {
        isLoggedIn: !!API.getSession(),
        user: API.getUser() || {},
        showOrders: false,
        showWithdraw: false,
        orderList: [],
        withdrawAmount: null,
        withdrawing: false,
        menuItems: [
          { act:'recharge', label:'充值', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>' },
          { act:'withdraw', label:'提现', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3v13"/><polyline points="7 11 12 16 17 11"/><line x1="5" y1="21" x2="19" y2="21"/></svg>' },
          { act:'orders', label:'订单管理', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>' },
          { act:'pwd', label:'修改密码', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' },
          { act:'cache', label:'清理缓存', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>' },
          { act:'logout', label:'退出登录', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' }
        ]
      };
    },
    mounted: function(){
      if(this.isLoggedIn) this.loadUser();
      App.renderNav('user.html');
      App.renderFooter();
    },
    methods: {
      imgUrl: function(path){ return App.img(path); },
      loadUser: function(){
        var self=this;
        /* 实时从服务端拉取个人信息（含头像、余额），保证每次打开都是最新 */
        return API.me().then(function(r){
          if(r && r.code===0 && r.data) self.user=r.data;
        });
      },
      onMenuAct: function(item){
        var self=this;
        if(item.act==='recharge') location.href='recharge.html';
        else if(item.act==='withdraw') self.showWithdraw=true;
        else if(item.act==='orders') location.href='orders.html';
        else if(item.act==='pwd') toast('修改密码功能开发中','err');
        else if(item.act==='cache'){ API.clearCache(); toast('缓存已清理','ok'); }
        else if(item.act==='logout'){
          App.confirm({ title:'退出登录', message:'确定退出当前账号？', okText:'退出', danger:true }).then(function(okd){
            if(!okd) return;
            API.logout().then(function(){ toast('已退出','ok'); self.isLoggedIn=false; App.renderNav('user.html'); });
          });
        }
      },
      loadOrders: function(){
        var self=this;
        API.getOrders().then(function(list){
          self.orderList=list||[];
          self.showOrders=true;
        });
      },
      doWithdraw: function(){
        var self=this, amt=self.withdrawAmount;
        if(!(amt>0)){ toast('请输入有效金额','err'); return; }
        self.withdrawing=true;
        API.withdraw(amt).then(function(r){
          self.withdrawing=false;
          if(r.code===0){ toast('提现申请已提交，等待审核','ok'); self.showWithdraw=false; self.loadUser(); App.renderNav('user.html'); }
          else{ toast(r.msg,'err'); }
        });
      },
      fmtTime: App.fmtTime,
      orderStatusText: function(s){
        return ({ pending:'平台托管中（待发货）', completed:'已完成（已打款）', rejected:'已驳回（已退款）' })[s] || ('未知('+s+')');
      }
    }
  });
  app.mount('#userApp');
})();
