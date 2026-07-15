/* manage.js — 管理页：发布商品 + 我的商品 */
(function () {
  'use strict';
  const { renderNav, renderFooter, API, toast, modal, requireLogin } = window.App;

  /* 未登录则跳转到个人中心 */
  if (!requireLogin('user.html')) return;

  const me = API.getUser();

  /* ---------- Tab 切换 ---------- */
  document.querySelectorAll('.tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tabs button').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'mine') renderMine();
    });
  });

  /* ---------- 发布表单 ---------- */
  const publisherInput = document.getElementById('pPublisher');
  publisherInput.value = me.nickname;

  let imgData = ''; // base64 预览
  const picker = document.getElementById('imgPicker');
  const fileInput = document.getElementById('pImage');
  const preview = document.getElementById('imgPreview');
  const hint = document.getElementById('imgHint');

  picker.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const f = fileInput.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      imgData = e.target.result;
      preview.src = imgData; preview.style.display = 'block'; hint.style.display = 'none';
    };
    reader.readAsDataURL(f);
  });

  document.getElementById('publishBtn').addEventListener('click', () => {
    const title = document.getElementById('pTitle').value.trim();
    const price = parseFloat(document.getElementById('pPrice').value);
    if (!title) return toast('请填写商品标题', 'err');
    if (!(price >= 0) || isNaN(price)) return toast('请填写有效价格', 'err');
    if (!imgData) return toast('请上传商品图片', 'err');

    API.createProduct({
      title, price, publisher: me.nickname, img: imgData,
      desc: title,
    }).then(() => {
      toast('发布成功', 'ok');
      // 重置表单
      document.getElementById('pTitle').value = '';
      document.getElementById('pPrice').value = '';
      imgData = ''; preview.style.display = 'none'; hint.style.display = 'block';
      fileInput.value = '';
      renderNav('manage.html');
    });
  });

  /* ---------- 我的商品 ---------- */
  function renderMine() {
    const grid = document.getElementById('myGrid');
    API.getMyProducts(me.nickname).then((list) => {
      if (!list.length) {
        grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="empty__icon">📭</div>你还没有发布商品</div>';
        return;
      }
      grid.innerHTML = list.map((p) => {
        const on = p.status === 'on';
        return (
          '<div class="card my-item">' +
            '<img src="' + p.img + '" alt="' + p.title + '" />' +
            '<div class="my-item__info">' +
              '<p class="my-item__title">' + p.title + '</p>' +
              '<div class="my-item__meta">发布人：' + p.publisher + '</div>' +
              '<div class="my-item__price price">' + p.price + '</div>' +
              '<span class="badge ' + (on ? 'badge--on' : 'badge--off') + '">' + (on ? '在售' : '已下架') + '</span>' +
            '</div>' +
            '<div class="my-item__ops">' +
              '<button class="btn btn--sm" data-act="toggle" data-id="' + p.id + '">' + (on ? '下架' : '上架') + '</button>' +
              '<button class="btn btn--sm btn--danger" data-act="del" data-id="' + p.id + '">删除</button>' +
            '</div>' +
          '</div>'
        );
      }).join('');

      grid.querySelectorAll('[data-act="toggle"]').forEach((b) =>
        b.addEventListener('click', () => toggle(b.dataset.id))
      );
      grid.querySelectorAll('[data-act="del"]').forEach((b) =>
        b.addEventListener('click', () => del(b.dataset.id))
      );
    });
  }

  function toggle(id) {
    API.getMyProducts(me.nickname).then((list) => {
      const p = list.find((x) => x.id === id);
      const next = p.status === 'on' ? 'off' : 'on';
      API.updateProduct(id, { status: next }).then(() => {
        toast(next === 'on' ? '已上架' : '已下架', 'ok');
        renderMine(); renderNav('manage.html');
      });
    });
  }

  function del(id) {
    modal({
      title: '删除商品', body: '确定删除该商品？此操作不可恢复。',
      confirmText: '删除', onConfirm() {
        API.deleteProduct(id).then(() => { toast('已删除', 'ok'); renderMine(); renderNav('manage.html'); });
        return true;
      },
    });
  }

  /* ---------- 初始化 ---------- */
  renderNav('manage.html');
  renderFooter();
})();
