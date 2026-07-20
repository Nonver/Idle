/* settings.js — 后台系统配置（Vue 3） */
(function(){
  'use strict';
  if (typeof Vue === 'undefined') { console.error('[xzwp-admin] Vue 未加载'); return; }
  if (typeof window.Admin === 'undefined') { console.error('[xzwp-admin] shared.js 未正确加载'); return; }
  var A = window.Admin;

  function iconSrc(icon){
    if (!icon) return '';
    if (/^(https?:|\/\/|data:)/.test(icon)) return icon;
    return A.API + icon;
  }

  var app = Vue.createApp({
    data: function(){
      return {
        saving: false,
        loading: false,
        form: { site_title: '闲置微铺', site_icon: '', contact: '' }
      };
    },
    computed: {
      iconSrc: function(){
        if (!this.form.site_icon) return '';
        if (/^(https?:|\/\/|data:)/.test(this.form.site_icon)) return this.form.site_icon;
        return A.API + this.form.site_icon;
      }
    },
    mounted: function(){ this.load(); },
    methods: {
      load: function(){
        var self = this;
        self.loading = true;
        A.req('settings.php?act=admin').then(function(r){
          self.loading = false;
          if (A.ok(r) && r.data) {
            self.form.site_title = r.data.site_title || '闲置微铺';
            self.form.site_icon = r.data.site_icon || '';
            self.form.contact = r.data.contact || '';
          }
        });
      },
      pickIcon: function(){ if (this.$refs.file) this.$refs.file.click(); },
      onFile: function(e){
        var self = this, f = e.target.files && e.target.files[0];
        if (!f) return;
        if (f.size > 2 * 1024 * 1024) { A.toast('图标不能超过 2MB', 'err'); return; }
        var fr = new FileReader();
        fr.onload = function(){ self.form.site_icon = fr.result; };
        fr.readAsDataURL(f);
      },
      clearIcon: function(){ this.form.site_icon = ''; },
      save: function(){
        var self = this;
        if (!self.form.site_title || !self.form.site_title.trim()) { A.toast('请填写站点标题', 'err'); return; }
        self.saving = true;
        A.req('settings.php', {
          site_title: self.form.site_title.trim(),
          site_icon: self.form.site_icon || '',
          contact: self.form.contact || ''
        }).then(function(r){
          self.saving = false;
          if (A.ok(r)) {
            A.toast('已保存，配置已生效', 'ok');
            A.applyConfig({ site_title: self.form.site_title, site_icon: self.form.site_icon, contact: self.form.contact });
          } else A.toast(r.msg || '保存失败', 'err');
        });
      }
    }
  });
  app.mount('#settingsApp');
})();
