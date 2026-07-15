/* payconfig.js — 支付配置（Vue 3） */
(function(){
  'use strict';
  if (typeof Vue === 'undefined') { console.error('[xzwp-admin] Vue 未加载'); return; }
  if (typeof window.Admin === 'undefined') { console.error('[xzwp-admin] shared.js 未正确加载'); return; }
  var A = window.Admin;

  var CH = { alipay:'支付宝', wechat:'微信', bank:'银行卡' };

  var app = Vue.createApp({
    data: function(){
      return {
        rechargeList: [],
        withdrawList: [],
        /* 弹窗 */
        modalVisible: false,
        formType: 'recharge',
        editId: null,
        form: { channel:'alipay', account_name:'', account_no:'', sort_order:0 }
      };
    },
    mounted: function(){ this.loadAll(); },
    methods: {
      chLabel: function(ch){ return CH[ch] || ch; },
      loadAll: function(){
        var self = this;
        A.req('pay_config.php?act=list&type=recharge&all=1').then(function(r){
          self.rechargeList = (A.ok(r) && Array.isArray(r.data)) ? r.data : [];
        });
        A.req('pay_config.php?act=list&type=withdraw&all=1').then(function(r){
          self.withdrawList = (A.ok(r) && Array.isArray(r.data)) ? r.data : [];
        });
      },
      openModal: function(type, item){
        this.formType = type;
        this.editId = item ? item.id : null;
        this.form = item
          ? { channel:item.channel||'alipay', account_name:item.account_name||'', account_no:item.account_no||'', sort_order:item.sort_order||0 }
          : { channel:'alipay', account_name:'', account_no:'', sort_order:0 };
        this.modalVisible = true;
      },
      submitForm: function(){
        var self = this;
        if (!self.form.account_no.trim()) { A.toast('账号不能为空','err'); return; }
        var payload = {
          type: self.formType,
          channel: self.form.channel,
          account_name: self.form.account_name.trim(),
          account_no: self.form.account_no.trim(),
          sort_order: parseInt(self.form.sort_order,10)||0
        };
        var act = self.editId ? ('update&id='+self.editId) : 'add';
        A.req('pay_config.php?act='+act, payload).then(function(r){
          if (A.ok(r)) { A.toast(self.editId?'已更新':'已添加','ok'); self.modalVisible=false; self.loadAll(); }
          else A.toast(r.msg||'操作失败','err');
        });
      },
      toggleItem: function(item){
        var v = item.status == 1 ? 0 : 1;
        var self = this;
        A.req('pay_config.php?act=update&id='+item.id, { status:v }).then(function(r){
          if (A.ok(r)) { A.toast(v==1?'已启用':'已禁用','ok'); self.loadAll(); }
          else A.toast(r.msg||'失败','err');
        });
      },
      delItem: function(item){
        var self = this;
        A.confirm({ title:'删除收款账户', message:'确定删除该收款账户？删除后前端将不再展示。', okText:'删除', danger:true }).then(function(okd){
          if (!okd) return;
          A.req('pay_config.php?act=delete&id='+item.id).then(function(r){
            if (A.ok(r)) { A.toast('已删除','ok'); self.loadAll(); }
            else A.toast(r.msg||'失败','err');
          });
        });
      },
      copyText: function(text){
        if(!text) return;
        if(navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(text).then(function(){ A.toast('已复制到剪贴板','ok'); });
        }else{
          var inp=document.createElement('input'); inp.value=text;
          document.body.appendChild(inp); inp.select();
          document.execCommand('copy'); document.body.removeChild(inp);
          A.toast('已复制到剪贴板','ok');
        }
      }
    }
  });

  /* 复用 modal-fade transition（与 finance.css 共用） */
  app.mount('#pcApp');
})();
