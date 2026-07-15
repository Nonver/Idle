/* home.js — 首页：轮播图 + 商品区 + 购买 */
(function () {
  'use strict';
  const { renderNav, renderFooter, API, toast, modal, requireLogin } = window.App;

  /* ---------- 轮播图 ---------- */
  const slides = [
    { tag: '限时推荐', title: '闲置好物 低价捡漏', desc: '每天更新，手慢无', c1: '#13c2a3', c2: '#36d1dc' },
    { tag: '数码专区', title: '耳机 / 相机 / 游戏机', desc: '95 新起，同城可面交', c1: '#5b86e5', c2: '#36d1dc' },
    { tag: '家具日用', title: '书桌 / 收纳 / 小家电', desc: '搬家清仓，自提更划算', c1: '#f7971e', c2: '#ff6a3d' },
  ];
  let cur = 0, timer = null;

  function buildCarousel() {
    const track = document.getElementById('carouselTrack');
    const dots = document.getElementById('carouselDots');
    track.innerHTML = slides.map((s) =>
      '<div class="carousel__slide" style="background:linear-gradient(135deg,' + s.c1 + ',' + s.c2 + ')">' +
        '<span class="tag">' + s.tag + '</span>' +
        '<div style="text-align:center"><h3>' + s.title + '</h3><p>' + s.desc + '</p></div>' +
      '</div>'
    ).join('');
    dots.innerHTML = slides.map((_, i) =>
      '<span data-i="' + i + '"' + (i === 0 ? ' class="active"' : '') + '></span>'
    ).join('');
    dots.querySelectorAll('span').forEach((d) =>
      d.addEventListener('click', () => go(+d.dataset.i))
    );
    document.getElementById('carPrev').onclick = () => go((cur - 1 + slides.length) % slides.length);
    document.getElementById('carNext').onclick = () => go((cur + 1) % slides.length);
    auto();
  }
  function go(i) {
    cur = i;
    document.getElementById('carouselTrack').style.transform = 'translateX(' + (-100 * cur) + '%)';
    document.querySelectorAll('#carouselDots span').forEach((d, idx) =>
      d.classList.toggle('active', idx === cur)
    );
    auto();
  }
  function auto() {
    clearInterval(timer);
    timer = setInterval(() => go((cur + 1) % slides.length), 4000);
  }

  /* ---------- 商品区 ---------- */
  function renderProducts() {
    const grid = document.getElementById('productGrid');
    API.getProducts().then((list) => {
      if (!list.length) {
        grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="empty__icon">📦</div>暂无闲置商品，去「管理」发布吧</div>';
        return;
      }
      grid.innerHTML = list.map((p) => (
        '<div class="product-card">' +
          '<img class="product-card__img" src="' + p.img + '" alt="' + p.title + '" />' +
          '<div class="product-card__body">' +
            '<p class="product-card__title">' + p.title + '</p>' +
            '<div class="product-card__publisher">发布人：<b>' + p.publisher + '</b></div>' +
            '<div class="product-card__foot">' +
              '<span class="price product-card__price">' + p.price + '</span>' +
              '<button class="buy-btn" data-id="' + p.id + '">购买</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      )).join('');

      grid.querySelectorAll('.buy-btn').forEach((btn) =>
        btn.addEventListener('click', () => buy(btn.dataset.id))
      );
    });
  }

  function buy(id) {
    if (!requireLogin('user.html')) return;
    API.getProducts().then((list) => {
      const p = list.find((x) => x.id === id);
      if (!p) return;
      modal({
        title: '确认购买',
        body:
          '<div style="text-align:center">' +
          '<img src="' + p.img + '" style="width:120px;border-radius:10px;margin:0 auto 12px" />' +
          '<div style="font-weight:700;font-size:15px">' + p.title + '</div>' +
          '<div class="price" style="font-size:22px;margin-top:6px">' + p.price + '</div>' +
          '<div class="text-muted" style="margin-top:6px">发布人：' + p.publisher + '</div>' +
          '</div>',
        confirmText: '确认支付',
        onConfirm() {
          API.createOrder(p).then((r) => {
            if (r.code === 0) { toast('购买成功，已扣款', 'ok'); renderProducts(); renderNav('index.html'); }
            else toast(r.msg, 'err');
          });
          return true;
        },
      });
    });
  }

  /* ---------- 初始化 ---------- */
  renderNav('index.html');
  renderFooter();
  buildCarousel();
  renderProducts();
})();
