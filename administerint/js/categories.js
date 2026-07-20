/* categories.js — 分类管理（Vue 3） */
(function(){
  'use strict';
  if (typeof Vue === 'undefined') { console.error('[xzwp-admin] Vue 未加载'); return; }
  if (typeof window.Admin === 'undefined') { console.error('[xzwp-admin] shared.js 未正确加载'); return; }
  var A = window.Admin;

  var app = Vue.createApp({
    data: function(){
      return { loading: false, list: [], busy: 0,
        showAdd: false, adding: false,
        newName: '', newSort: 0
      };
    },
    mounted: function(){ this.load(); },
    methods: {
      load: function(){
        var self = this;
        self.loading = true;
        fetch(A.API + 'categories.php', { credentials: 'same-origin' }).then(function(r){ return r.json(); })
          .then(function(r){
            self.loading = false;
            if (A.ok(r)) self.list = r.data || [];
            else { A.toast(r.msg||'加载失败','err'); self.list=[]; }
          });
      },
      openAdd: function(){
        this.showAdd = true;
        this.newName = '';
        this.newSort = (this.list.length > 0 ? Math.max.apply(null, this.list.map(function(c){return c.sort_order;})) + 1 : 1);
        /* 下一个 tick 后聚焦输入框 */
        var self = this;
        this.$nextTick(function(){ if (self.$refs.nameInput) self.$refs.nameInput.focus(); });
      },
      closeAdd: function(){
        this.showAdd = false;
        this.newName = '';
        this.newSort = 0;
      },
      doAdd: function(){
        var self = this;
        if (!self.newName.trim()) return;
        self.adding = true;
        A.req('categories.php?act=add', { name: self.newName.trim(), sort_order: Number(self.newSort)||0 })
          .then(function(r){
            self.adding = false;
            if (A.ok(r)) {
              A.toast('添加成功','ok');
              self.closeAdd();
              self.load();
            } else {
              A.toast(r.msg||'添加失败','err');
            }
          });
      },
      delCat: function(c){
        var self = this;
        A.confirm({ title:'删除分类', message:'确认删除分类「'+c.name+'」？\n（该分类下无商品时才可删除）', okText:'确认删除', danger:true })
          .then(function(okd){
            if (!okd) return;
            self.busy = c.id;
            A.req('categories.php?act=delete', { id: c.id })
              .then(function(r){
                self.busy = 0;
                if (A.ok(r)) { A.toast('已删除','ok'); self.load(); }
                else { A.toast(r.msg||'失败','err'); }
              });
          });
      },
      fmtTime: function(ts){
        if (!ts) return '-';
        var d = new Date(ts * 1000);
        var p = function(n){return n<10?'0'+n:''+n;};
        return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());
      }
    }
  });
  app.mount('#catApp');
})();
