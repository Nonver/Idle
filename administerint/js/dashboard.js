/* dashboard.js — 仪表盘（Vue 3） */
(function(){
  'use strict';
  var A = window.Admin;

  function fmt(n){ return (Number(n||0)).toFixed(2); }
  function pct(t, total){
    t=Number(t||0); total=Number(total||0);
    return total<=0 ? 0 : Math.min(100, Math.round(t/total*100));
  }

  var app = Vue.createApp({
    data: function(){
      return { s: {} };
    },
    mounted: function(){ this.load(); },
    methods: {
      fmt: fmt,
      pct: pct,
      load: function(){
        var self = this;
        A.req('admin.php?act=stats').then(function(r){
          if (A.ok(r)) self.s = r.data || {};
          else A.toast(r.msg || '加载失败', 'err');
        });
      }
    }
  });
  app.mount('#dashApp');

  /* 页面日期（非 Vue 管理，保留原生） */
  var d = new Date(), wd = ['日','一','二','三','四','五','六'][d.getDay()];
  var p = function(n){ return n<10 ? '0'+n : ''+n; };
  var pd = document.getElementById('pageDate');
  if(pd) pd.textContent = d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' 星期'+wd;
})();
