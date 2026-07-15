/* user.js — 个人中心（Vue 3） */
(function(){
  'use strict';
  if (typeof Vue === 'undefined') { console.error('[xzwp] Vue 未加载'); return; }
  if (typeof window.App === 'undefined') { console.error('[xzwp] common.js 未正确加载'); return; }
  var App = window.App, API = App.API, toast = App.toast;

  var app = Vue.createApp({
    data: function(){
      return {
        isLoggedIn: !!API.getSession(),
        user: API.getUser() || {},
        showOrders: false,
        showWithdraw: false,
        showPwd: false,
        orderList: [],
        /* 提现相关 */
        withdrawAmount: null,
        withdrawing: false,
        wdPayMethod: 'alipay',    // 'alipay' | 'qrcode'
        wdAlipayAccount: '',       // 支付宝账号
        wdQrBase64: '',            // 收款码 base64
        wdRemark: '',
        /* 修改密码 */
        changingPwd: false,
        pwdForm: { oldPwd:'', newPwd:'', confirmPwd:'' },
        contact: '',
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
      var self = this;
      App.loadConfig().then(function(c){ if(c) self.contact = c.contact || ''; });
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
        else if(item.act==='pwd'){ self.pwdForm={oldPwd:'',newPwd:'',confirmPwd:''}; self.showPwd=true; }
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
        /* 校验收款方式 */
        if(self.wdPayMethod==='alipay' && !self.wdAlipayAccount){ toast('请输入支付宝账号','err'); return; }
        if(self.wdPayMethod==='qrcode' && !self.wdQrBase64){ toast('请上传收款二维码','err'); return; }
        self.withdrawing=true;
        var payInfo = {
          method: self.wdPayMethod,
          remark: self.wdRemark
        };
        if(self.wdPayMethod==='alipay') payInfo.account = self.wdAlipayAccount;
        if(self.wdPayMethod==='qrcode') payInfo.qrcode = self.wdQrBase64;
        API.withdraw(amt, payInfo).then(function(r){
          self.withdrawing=false;
          if(r.code===0){
            toast('提现申请已提交，等待审核打款','ok');
            self.showWithdraw=false;
            /* 重置表单 */
            self.withdrawAmount=null;
            self.wdAlipayAccount='';
            self.wdQrBase64='';
            self.wdRemark='';
            self.loadUser();
            App.renderNav('user.html');
          }
          else{ toast(r.msg,'err'); }
        });
      },
      onWdQrChange: function(e){
        var f=e.target.files && e.target.files[0]; if(!f) return;
        if(f.size>3*1024*1024){ toast('图片不能超过 3MB','err'); e.target.value=''; return; }
        if(!f.type.match(/^image\//)){ toast('请选择图片文件','err'); e.target.value=''; return; }
        var r=new FileReader();
        r.onload=function(ev){
          this.wdQrBase64=ev.target.result;
          // 压缩：如果 base64 太长就缩小
          if(this.wdQrBase64.length > 300000){
            this.compressQr(this.wdQrBase64);
          }
        }.bind(this);
        r.readAsDataURL(f);
      },
      compressQr: function(base64){
        var img=new Image();
        img.onload=function(){
          var canvas=document.createElement('canvas'), ctx=canvas.getContext('2d');
          var maxSide=400, w=img.width, h=img.height;
          if(w>maxSide||h>maxSide){
            var ratio=Math.min(maxSide/w,maxSide/h);
            w=Math.round(w*ratio); h=Math.round(h*ratio);
          }
          canvas.width=w; canvas.height=h;
          ctx.drawImage(img,0,0,w,h);
          this.wdQrBase64=canvas.toDataURL('image/jpeg',0.8);
        }.bind(this);
        img.src=base64;
      },
      doChangePwd: function(){
        var f=this.pwdForm;
        if(!f.oldPwd){ toast('请输入当前密码','err'); return; }
        if(!f.newPwd||f.newPwd.length<6){ toast('新密码至少6位','err'); return; }
        if(f.newPwd!==f.confirmPwd){ toast('两次输入的新密码不一致','err'); return; }
        this.changingPwd=true;
        var self=this;
        API.changePassword(f.oldPwd,f.newPwd).then(function(r){
          self.changingPwd=false;
          if(r.code===0){
            toast('密码修改成功，请重新登录','ok');
            setTimeout(function(){ location.href='login.html'; },800);
            self.showPwd=false;
          }
          else{ toast(r.msg||'修改失败','err'); }
        });
      },
      fmtTime: App.fmtTime,
      orderStatusText: function(s){
        return ({ pending:'平台托管中（待发货）', completed:'已完成（已打款）', rejected:'已驳回（已退款）' })[s] || ('未知('+s+')');
      },
      copyContact: function(){
        if(!this.contact) return;
        var self=this;
        if(navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(this.contact).then(function(){ toast('客服联系方式已复制','ok'); }).catch(function(){});
        } else {
          toast(this.contact, 'ok');
        }
      }
    }
  });
  try { app.mount('#userApp'); } catch (e) { console.error('[xzwp] user Vue mount 失败:', e); }
})();
