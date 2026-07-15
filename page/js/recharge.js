/* recharge.js — 充值页（Vue 3） */
(function(){
  'use strict';
  var App = window.App;
  if(!App.requireLogin()) return;
  var API = App.API;

  var app=Vue.createApp({
    data:function(){
      return{
        balance:'0.00',
        amount:null,
        accounts:[],
        accountsLoaded:false,
        submitting:false
      };
    },
    mounted:function(){ this.init(); },
    methods:{
      init:function(){
        var self=this;
        var c=JSON.parse(localStorage.getItem('xzwp_cache_user'));
        if(c&&c.balance!=null) this.balance=Number(c.balance).toFixed(2);
        API.me().then(function(r){
          if(r&&r.code===0&&r.data){
            self.balance=Number(r.data.balance||0).toFixed(2);
            localStorage.setItem('xzwp_cache_user',JSON.stringify(r.data));
          }
        });
        App.renderNav('user.html');
        App.renderFooter();
        API.getPayConfigs('recharge').then(function(list){
          self.accounts=list||[];
          self.accountsLoaded=true;
        });
      },
      chLabel:function(ch){
        return ch==='alipay'?'支付宝':ch==='wechat'?'微信':'银行卡';
      },
      copyText:function(text){
        if(!text)return;
        if(navigator.clipboard&&navigator.clipboard.writeText){
          navigator.clipboard.writeText(text).then(function(){App.toast('已复制','ok');});
        }else{
          var inp=document.createElement('input');inp.value=text;
          document.body.appendChild(inp);inp.select();document.execCommand('copy');
          document.body.removeChild(inp);App.toast('已复制','ok');
        }
      },
      submitRecharge:function(){
        var self=this, amt=self.amount;
        if(!(amt>0)){App.toast('请输入有效金额','err');return;}
        if(amt<1){App.toast('最低充值 1 元','err');return;}
        self.submitting=true;
        API.recharge(amt).then(function(r){
          self.submitting=false;
          if(r.code===0){App.toast('充值申请已提交，等待管理员审核','ok');self.amount=null;
            var c=JSON.parse(localStorage.getItem('xzwp_cache_user'));
            if(c&&c.balance!=null) self.balance=Number(c.balance).toFixed(2);
          }
          else App.toast(r.msg||'提交失败','err');
        });
      }
    }
  });
  app.mount('#rcApp');
})();
