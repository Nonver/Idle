/* banners.js — 后台轮播图管理（Vue 3） */
(function(){
  'use strict';
  if (typeof Vue === 'undefined') { console.error('[xzwp-admin] Vue 未加载'); return; }
  if (typeof window.Admin === 'undefined') { console.error('[xzwp-admin] shared.js 未正确加载'); return; }
  var A = window.Admin;

  var app = Vue.createApp({
    data: function(){
      return {
        loading: false,
        list: [],
        showAdd: false,
        saving: false,
        form: { img: '', title: '', link: '', sort_order: 0 }
      };
    },
    mounted: function(){ this.load(); },
    methods: {
      load: function(){
        var self = this;
        self.loading = true;
        A.req('banner.php?act=admin').then(function(r){
          self.loading = false;
          if (A.ok(r)) self.list = r.data || [];
          else { A.toast(r.msg || '加载失败', 'err'); self.list = []; }
        });
      },
      imgUrl: function(path){
        if (!path) return '';
        if (/^https?:\/\//.test(path) || /^data:/i.test(path)) return path;
        var base = A.API.replace(/\/$/, '');
        return base + '/' + path.replace(/^\/+/, '');
      },
      zoom: function(path){ if (path) A.lightbox(this.imgUrl(path)); },
      openAdd: function(){
        this.form = { img: '', title: '', link: '', sort_order: 0 };
        this.showAdd = true;
      },
      pickImg: function(){ if (this.$refs.file) this.$refs.file.click(); },
      onFile: function(e){
        var self = this, f = e.target.files && e.target.files[0];
        if (!f) return;
        if (f.size > 3 * 1024 * 1024) { A.toast('图片不能超过 3MB', 'err'); return; }
        var fr = new FileReader();
        fr.onload = function(){ self.form.img = fr.result; };
        fr.readAsDataURL(f);
      },
      submit: function(){
        var self = this;
        if (!self.form.img) { A.toast('请选择轮播图片', 'err'); return; }
        self.saving = true;
        A.req('banner.php', {
          img: self.form.img,
          title: self.form.title || '',
          link: self.form.link || '',
          sort_order: parseInt(self.form.sort_order || 0, 10)
        }).then(function(r){
          self.saving = false;
          if (A.ok(r)) { A.toast('已添加', 'ok'); self.showAdd = false; self.load(); }
          else A.toast(r.msg || '保存失败', 'err');
        });
      },
      toggle: function(b){
        var self = this;
        A.req('banner.php?act=toggle&id=' + b.id).then(function(r){
          if (A.ok(r)) self.load();
          else A.toast(r.msg || '操作失败', 'err');
        });
      },
      del: function(b){
        var self = this;
        A.confirm({ title: '删除轮播图', message: '确定删除该轮播图？此操作不可恢复。', okText: '删除', danger: true }).then(function(okd){
          if (!okd) return;
          A.req('banner.php?act=delete&id=' + b.id).then(function(r){
            if (A.ok(r)) { A.toast('已删除', 'ok'); self.load(); }
            else A.toast(r.msg || '删除失败', 'err');
          });
        });
      }
    }
  });
  app.mount('#bannerApp');
})();
