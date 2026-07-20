/* products.js — 商品管理 + 官方商品发布（Vue 3） */
(function(){
  'use strict';
  if (typeof Vue === 'undefined') { console.error('[xzwp-admin] Vue 未加载'); return; }
  if (typeof window.Admin === 'undefined') { console.error('[xzwp-admin] shared.js 未正确加载'); return; }
  var A = window.Admin;
  var timer = null;

  var app = Vue.createApp({
    data: function(){
      return {
        /* 用户商品列表 */
        loading: false, kw: '', list: [],
        /* 官方商品列表 */
        loadingPub: false, pubList: [], busy: 0,
        /* 分类 */
        categories: [],
        /* 发布/编辑弹窗 */
        showPub: false, pubPublishing: false, editingId: 0,
        pubForm: {
          title: '', price: '', category_id: 0, custom_price: false,
          description: '', img: '', imgPreview: ''
        }
      };
    },
    mounted: function(){ this.load(); this.loadPubList(); this.loadCategories(); },
    methods: {
      loadCategories: function(){
        var self = this;
        A.req('categories.php').then(function(r){
          if (A.ok(r)) self.categories = r.data || [];
        });
      },

      /* ========== 用户商品列表 ========== */

      load: function(kw){
        var self = this;
        self.loading = true;
        var url = 'admin.php?act=products';
        if (kw) url += '&kw=' + encodeURIComponent(kw);
        A.req(url).then(function(r){
          self.loading = false;
          try {
            if (A.ok(r)) {
              var d = r.data;
              self.list = Array.isArray(d) ? d : [];
            } else {
              A.toast(r.msg||'加载失败','err');
              self.list = [];
            }
          } catch(e) {
            console.error('[products] load error:', e);
            self.list = [];
          }
        }).catch(function(err){
          console.error('[products] network:', err);
          self.loading = false;
          self.list = [];
        });
      },
      onSearch: function(){
        var self = this;
        clearTimeout(timer);
        timer = setTimeout(function(){ self.load(self.kw); }, 300);
      },
      imgUrl: function(path){
        if (!path) return '';
        if (/^https?:\/\//.test(path) || /^data:/i.test(path)) return path;
        var base = A.API.replace(/\/$/,'');
        return base + '/' + path.replace(/^\/+/,'');
      },
      zoomImg: function(path){ if(path) A.lightbox(this.imgUrl(path)); },
      offProd: function(p){
        var self = this;
        A.confirm({
          title: '下架商品',
          message: '确定下架「' + (p.title||p.name||'') + '」？保证金将退回发布人「' + (p.publisher||'') + '」账户。',
          okText: '确认下架'
        }).then(function(okd){
          if (!okd) return;
          A.req('admin.php?act=products&op=off&id='+p.id).then(function(r){
            if (A.ok(r)) { A.toast(r.msg || '已下架','ok'); self.load(self.kw); }
            else A.toast(r.msg || '下架失败','err');
          });
        });
      },
      fmt: function(val){ return Number(val||0).toFixed(2); },
      statusLabel: function(s){
        return s === 'on' ? '在售' : (s === 'sold' ? '已售出' : '已下架');
      },
      statusCls: function(s){
        if (s === 'on') return 'badge badge--on';
        if (s === 'sold') return 'badge badge--warn';
        return 'badge badge--off';
      },

      /* ========== 官方商品（管理员发布单） ========== */

      /* 加载 available 状态的发布单 */
      loadPubList: function(){
        var self = this;
        self.loadingPub = true;
        A.req('admin.php?act=orders').then(function(r){
          self.loadingPub = false;
          if (A.ok(r)) {
            var data = r.data || [];
            if (Array.isArray(data)) {
              self.pubList = data.filter(function(o){ return o.status === 'available'; });
            } else {
              self.pubList = [];
            }
          } else {
            self.pubList = [];
          }
        });
      },

      /* 状态文字/样式（官方商品） */
      pubStatusText: function(o){
        if (o.status === 'available') return '可购买';
        return o.status === 'sold' ? '已售出' : o.status;
      },
      pubStatusCls: function(o){
        if (o.status === 'available') return 'badge badge--pub';
        return 'badge badge--off';
      },

      delPub: function(o){
        var self = this;
        A.confirm({ title:'删除官方商品', message:'确认删除「'+o.title+'」？该商品目前无人购买。', okText:'删除', danger:true }).then(function(okd){
          if (!okd) return;
          self.busy = o.id;
          A.req('admin.php?act=orders&op=delete_pub&id='+o.id).then(function(r){
            self.busy = 0;
            if (A.ok(r)) { A.toast('已删除','ok'); self.loadPubList(); }
            else { A.toast(r.msg||'失败','err'); }
          });
        });
      },

      /* ===== 发布官方商品 ===== */

      openPub: function(){
        this.showPub = true;
        this.pubForm = { title: '', price: '', category_id: 0, custom_price: false, description: '', img: '', imgPreview: '' };
        var self = this;
        this.$nextTick(function(){ if (self.$refs.pubTitleInput) self.$refs.pubTitleInput.focus(); });
      },
      closePub: function(){
        this.showPub = false;
        this.editingId = 0;
        this.pubForm = { title: '', price: '', category_id: 0, custom_price: false, description: '', img: '', imgPreview: '' };
      },
      /* 打开编辑弹窗，预填数据 */
      editPub: function(o){
        this.editingId = o.id;
        var self = this;
        this.pubForm = {
          title: o.title || '',
          price: o.price || '',
          category_id: o.category_id || 0,
          custom_price: !!o.custom_price,
          description: o.description || '',
          img: o.img || '',
          imgPreview: o.img ? self.imgUrl(o.img) : ''
        };
        this.showPub = true;
        this.$nextTick(function(){ if (self.$refs.pubTitleInput) self.$refs.pubTitleInput.focus(); });
      },
      /* 提交编辑 */
      doEditPub: function(){
        var self = this;
        var data = {
          title: self.pubForm.title.trim(),
          price: Number(self.pubForm.price) || 0,
          category_id: Number(self.pubForm.category_id) || 0,
          custom_price: self.pubForm.custom_price ? 1 : 0,
          description: self.pubForm.description.trim()
        };
        // 只有重新选了新图片才传（否则后端保留原图）
        if (self.pubForm.img && !self.pubForm.img.startsWith('uploads/')) {
          data.img = self.pubForm.img;
        }

        if (!data.title) { A.toast('请填写商品标题','err'); return; }
        if (data.price <= 0) { A.toast('请填写有效价格','err'); return; }

        self.pubPublishing = true;
        A.req('admin.php?act=orders&op=edit_pub&id=' + self.editingId, data).then(function(r){
          self.pubPublishing = false;
          if (A.ok(r)) {
            A.toast('已保存','ok');
            self.closePub();
            self.loadPubList();
          } else {
            A.toast(r.msg||'保存失败','err');
          }
        });
      },
      pickPubImg: function(e){
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        if (file.size > 5*1024*1024) { A.toast('图片不能超过5MB','err'); return; }
        var self = this;
        var reader = new FileReader();
        reader.onload = function(ev){
          self.pubForm.imgPreview = ev.target.result;
          self.pubForm.img = ev.target.result;
        };
        reader.readAsDataURL(file);
        e.target.value = '';
      },
      clearPubImg: function(){
        this.pubForm.img = '';
        this.pubForm.imgPreview = '';
      },
      doPub: function(){
        var self = this;
        var data = {
          title: self.pubForm.title.trim(),
          price: Number(self.pubForm.price) || 0,
          category_id: Number(self.pubForm.category_id) || 0,
          custom_price: self.pubForm.custom_price ? 1 : 0,
          description: self.pubForm.description.trim()
        };
        if (self.pubForm.img) data.img = self.pubForm.img;

        if (!data.title) { A.toast('请填写商品标题','err'); return; }
        if (data.price <= 0) { A.toast('请填写有效价格','err'); return; }

        self.pubPublishing = true;
        A.req('admin.php?act=orders&op=publish', data).then(function(r){
          self.pubPublishing = false;
          if (A.ok(r)) {
            A.toast('发布成功','ok');
            self.closePub();
            self.loadPubList();
          } else {
            A.toast(r.msg||'发布失败','err');
          }
        });
      }

    }
  });
  app.mount('#prodApp');
})();
