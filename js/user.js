/* user.js — 个人中心（未登录显示"去登录"，已登录显示完整个人中心） */
(function () {
  'use strict';
  const { renderNav, renderFooter, API, toast, modal } = window.App;

  const authView = document.getElementById('authView');
  const profileView = document.getElementById('profileView');

  /* ---------- 根据登录态切换视图 ---------- */
  if (API.getSession()) {
    // 已登录 → 显示个人中心
    authView.style.display = 'none';
    profileView.style.display = '';
    renderProfile();
  }
  // 未登录 → authView 默认显示（"去登录"按钮链接到 login.html）

  /* ---------- 渲染个人信息 ---------- */
  function renderProfile() {
    const u = API.getUser();
    if (!u) { location.href = 'login.html'; return; }
    const av = document.getElementById('pAvatar');
    if (u.avatar) {
      av.textContent = '';
      av.style.backgroundImage = 'url(' + u.avatar + ')';
      av.style.backgroundSize = 'cover';
      av.style.backgroundPosition = 'center';
    } else {
      av.style.backgroundImage = '';
      av.textContent = (u.nickname || '?').slice(0, 1);
    }
    document.getElementById('pName').textContent = u.nickname;
    document.getElementById('pUser').textContent = '账号：' + u.username;
    document.getElementById('pBalance').textContent = '¥' + (u.balance || 0);
  }

  /* ---------- 菜单动作 ---------- */
  document.getElementById('menu').addEventListener('click', (e) => {
    const item = e.target.closest('[data-act]');
    if (!item) return;
    const act = item.dataset.act;
    if (act === 'recharge') recharge();
    else if (act === 'withdraw') withdraw();
    else if (act === 'orders') orders();
    else if (act === 'pwd') changePwd();
    else if (act === 'cache') clearCache();
    else if (act === 'logout') logout();
  });

  function recharge() {
    modal({
      title: '充值', body: '<input id="mAmount" class="field" type="number" min="1" placeholder="充值金额（¥）" style="width:100%;padding:11px 13px;border:1px solid var(--border);border-radius:9px" />',
      confirmText: '确认充值', onConfirm() {
        const amt = parseFloat(document.getElementById('mAmount').value);
        if (!(amt > 0)) { toast('请输入有效金额', 'err'); return false; }
        API.recharge(amt).then((r) => { toast('充值成功', 'ok'); renderProfile(); renderNav('user.html'); });
      },
    });
  }

  function withdraw() {
    modal({
      title: '提现', body: '<input id="mAmount" type="number" min="1" placeholder="提现金额（¥）" style="width:100%;padding:11px 13px;border:1px solid var(--border);border-radius:9px" />',
      confirmText: '确认提现', onConfirm() {
        const amt = parseFloat(document.getElementById('mAmount').value);
        if (!(amt > 0)) { toast('请输入有效金额', 'err'); return false; }
        API.withdraw(amt).then((r) => {
          if (r.code === 0) { toast('提现成功', 'ok'); renderProfile(); renderNav('user.html'); }
          else { toast(r.msg, 'err'); return false; }
        });
      },
    });
  }

  function orders() {
    API.getOrders().then((list) => {
      const body = list.length
        ? list.map((o) => (
            '<div class="order-item">' +
              '<div class="order-item__top">' +
                '<span class="order-item__title">' + o.title + '</span>' +
                '<span class="order-item__price">¥' + o.price + '</span>' +
              '</div>' +
              '<div class="order-item__meta">卖家：' + o.publisher + ' · ' + window.App.fmtTime(o.createdAt) + ' · 已支付</div>' +
            '</div>'
          )).join('')
        : '<div class="empty"><div class="empty__icon">🧾</div>暂无订单</div>';
      modal({ title: '我的订单（' + list.length + '）', body: '<div style="max-height:50vh;overflow:auto">' + body + '</div>', confirmText: '关闭' });
    });
  }

  function changePwd() {
    modal({
      title: '修改密码',
      body:
        '<div class="field"><input id="oldP" type="password" placeholder="原密码" style="width:100%;padding:11px 13px;border:1px solid var(--border);border-radius:9px" /></div>' +
        '<div class="field"><input id="newP" type="password" placeholder="新密码" style="width:100%;padding:11px 13px;border:1px solid var(--border);border-radius:9px" /></div>',
      confirmText: '保存', onConfirm() {
        const oldP = document.getElementById('oldP').value;
        const newP = document.getElementById('newP').value;
        if (!oldP || !newP) { toast('请填写完整', 'err'); return false; }
        API.changePassword(oldP, newP).then((r) => {
          if (r.code === 0) toast('密码修改成功', 'ok');
          else { toast(r.msg, 'err'); return false; }
        });
      },
    });
  }

  function clearCache() {
    modal({
      title: '清理缓存', body: '将清除本地临时缓存（不影响商品与订单数据），确定继续？',
      confirmText: '清理', onConfirm() {
        API.clearCache().then(() => toast('缓存已清理', 'ok'));
      },
    });
  }

  function logout() {
    modal({
      title: '退出登录', body: '确定退出当前账号？',
      confirmText: '退出', onConfirm() {
        API.logout().then(() => {
          toast('已退出', 'ok');
          // 退出后切回未登录视图，不跳走
          profileView.style.display = 'none';
          authView.style.display = '';
          renderNav('user.html');
        });
      },
    });
  }

  /* ---------- 初始化 ---------- */
  renderNav('user.html');
  renderFooter();
})();
