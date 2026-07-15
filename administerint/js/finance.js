/* finance.js — 财务管理（Vue 3 版本） */
(function () {
  'use strict';

  var API = Admin.API + 'finance.php';
  var $ = function (s) { return document.querySelector(s); };

  /* ========== Vue 3 App ========== */
  var app = Vue.createApp({
    data: function () {
      return {
        // Tab
        currentTab: 'recharge',
        tabs: [
          { key: 'recharge', label: '充值审核' },
          { key: 'withdraw', label: '提现审核' }
        ],
        // 筛选
        statusFilter: '',
        statusMap: {
          pending: '待审核',
          approved: '已通过',
          rejected: '已拒绝'
        },
        // 列表
        loading: false,
        list: [],
        total: 0,
        pageSize: 50,
        // 统计
        stats: {},
        // 弹窗
        reviewVisible: false,
        reviewRow: null,
        reviewAction: '',     // approve | reject
        actualAmount: null,
        reviewNote: '',
        submitting: false
      };
    },

    computed: {
      /* 统计卡片 */
      statCards: function () {
        var s = this.stats;
        var typeLabel = this.currentTab === 'recharge' ? '充值' : '提现';
        var f = function(n){ return Number(n||0).toFixed(2); };
        return [
          { label: '待审核' + typeLabel, value: (s.pending_count || 0), unit: '笔', sub: '&yen;' + f(s.pending_amount), color: 'warn' },
          { label: '已通过' + typeLabel, value: (s.approved_count || 0), unit: '笔', sub: '&yen;' + f(s.approved_amount), color: 'ok' },
          { label: '已拒绝' + typeLabel, value: (s.rejected_count || 0), unit: '笔', sub: '&yen;' + f(s.rejected_amount), color: 'err' },
          { label: typeLabel + '总额', value: f(s.total_amount), unit: '元', sub: '共 ' + (s.total_count || 0) + ' 笔', color: 'info' }
        ];
      },
      /* 前端筛选（服务端也可做，这里做双重保险） */
      filteredList: function () {
        if (!this.statusFilter) return this.list;
        return this.list.filter(function (r) { return r.status === this.statusFilter; }.bind(this));
      }
    },

    mounted: function () {
      this.loadData();
    },

    methods: {
      /* ---- 切换 Tab ---- */
      switchTab: function (key) {
        if (key === this.currentTab) return;
        this.currentTab = key;
        this.statusFilter = '';
        this.list = [];
        this.loadData();
      },

      /* ---- 加载数据（单次请求，列表+统计一起返回） ---- */
      loadData: function () {
        var self = this;
        self.loading = true;
        var url = API + '?act=records&type=' + encodeURIComponent(self.currentTab);
        if (self.statusFilter) url += '&status=' + encodeURIComponent(self.statusFilter);

        fetch(url, { credentials: 'same-origin' })
          .then(function (r) { return r.json(); })
          .then(function (res) {
            self.loading = false;
            if (res.code === 0 && res.data) {
              /* 列表 */
              self.list = Array.isArray(res.data.list) ? res.data.list : [];
              /* 统计（后端直接按当前 type 返回） */
              var sd = res.data.stats || {};
              var p = self.currentTab + '_';
              self.stats = {
                pending_count:   Number(sd[p+'pending']) || 0,
                pending_amount:  Number(sd[p+'pending_amount']) || 0,
                approved_count:  Number(sd[p+'approved']) || 0,
                approved_amount: Number(sd[p+'approved_amount']) || 0,
                rejected_count:  Number(sd[p+'rejected']) || 0,
                rejected_amount: Number(sd[p+'rejected_amount']) || 0,
                total_count:     (Number(sd[p+'pending'])||0)+(Number(sd[p+'approved'])||0)+(Number(sd[p+'rejected'])||0),
                total_amount:    (Number(sd[p+'pending_amount'])||0)+(Number(sd[p+'approved_amount'])||0)+(Number(sd[p+'rejected_amount'])||0)
              };
            } else {
              self.list = [];
              self.stats = {};
              if (res.msg) Admin.toast(res.msg);
            }
          })
          .catch(function (err) {
            self.loading = false;
            console.error('[finance] load error:', err);
            Admin.toast('网络错误，请检查连接');
          });
      },

      /* ---- 打开审核弹窗 ---- */
      openReview: function (row, action) {
        this.reviewRow = row;
        this.reviewAction = action;
        this.actualAmount = null;   // 重置
        this.reviewNote = '';
        this.submitting = false;
        this.reviewVisible = true;
      },

      /* ---- 提交审核 ---- */
      submitReview: function () {
        var self = this;
        if (!self.reviewRow) return;

        var body = {
          id: self.reviewRow.id,
          action: self.reviewAction,
          note: self.reviewNote
        };
        /* 充值通过时可填实际金额 */
        if (self.reviewAction === 'approve' && self.reviewRow.type === 'recharge') {
          if (self.actualAmount != null && self.actualAmount > 0) {
            body.actual_amount = parseFloat(self.actualAmount);
          }
        }

        self.submitting = true;
        fetch(API + '?act=review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'same-origin'
        })
          .then(function (r) { return r.json(); })
          .then(function (res) {
            self.submitting = false;
            if (res.code === 0) {
              Admin.toast(self.reviewAction === 'approve' ? '已通过' : '已拒绝');
              self.reviewVisible = false;
              self.loadData(); // 刷新列表和统计
            } else {
              Admin.toast(res.msg || '操作失败');
            }
          })
          .catch(function (err) {
            self.submitting = false;
            console.error('[finance] review error:', err);
            Admin.toast('网络错误');
          });
      },

      /* ---- 安全格式化金额（兼容字符串/数字/null） ---- */
      fmt: function (val) {
        return Number(val || 0).toFixed(2);
      },

      /* ---- 格式化时间 ---- */
      fmtTime: function (ts) {
        if (!ts) return '-';
        var d = new Date(ts * 1000);
        var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
               ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      }
    }
  });

  app.mount('#financeApp');

})();
