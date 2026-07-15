/* login.js — 登录 / 注册页面逻辑（纯前端 Canvas 验证码，不依赖服务器） */
(function () {
  'use strict';
  const { renderNav, API, toast } = window.App;

  /* 存储当前验证码（用于本地校验，防无脑机器人） */
  let loginCode = '';
  let regCode = '';

  /* ---------- Tab 切换 ---------- */
  document.querySelectorAll('.login-tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.login-tabs button').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.login-form').forEach((f) => f.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.auth + 'Form').classList.add('active');
    });
  });

  /* ========== 纯前端 Canvas 验证码 ==========
   * 随机生成 4 位字符 → 绘制带干扰线/噪点/随机色的图形
   * 校验在本地进行（防无脑机器人，不依赖服务器）
   */
  function genCode(len) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  function drawCaptcha(canvasEl, code) {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    const w = canvasEl.width;
    const h = canvasEl.height;

    // 背景
    ctx.fillStyle = '#f0f3f8';
    ctx.fillRect(0, 0, w, h);

    // 干扰线
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = 'rgba(' + r(150,220) + ',' + r(150,220) + ',' + r(150,220) + ',0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(r(0,w), r(0,h));
      ctx.lineTo(r(0,w), r(0,h));
      ctx.stroke();
    }
    // 噪点
    for (let j = 0; j < 80; j++) {
      ctx.fillStyle = 'rgba(' + r(160,230) + ',' + r(160,230) + ',' + r(160,230) + ',0.5)';
      ctx.fillRect(r(0,w), r(0,h), 1, 1);
    }
    // 字符
    const charW = Math.floor((w - 20) / code.length);
    for (let k = 0; k < code.length; k++) {
      const x = 10 + k * charW + r(-2, 2);
      const y = r(26, 38);
      ctx.fillStyle = 'rgb(' + r(20,80) + ',' + r(30,90) + ',' + r(50,120) + ')';
      ctx.font = 'bold ' + r(20,24) + 'px monospace';
      ctx.textBaseline = 'middle';
      ctx.save();
      ctx.translate(x + 7, y);
      ctx.rotate(r(-15, 15) * Math.PI / 180);
      ctx.fillText(code[k], 0, 0);
      ctx.restore();
    }
  }

  function r(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  function refreshLoginCaptcha() {
    loginCode = genCode(4);
    drawCaptcha(document.getElementById('loginCaptchaCanvas'), loginCode);
  }
  function refreshRegCaptcha() {
    regCode = genCode(4);
    drawCaptcha(document.getElementById('regCaptchaCanvas'), regCode);
  }

  document.getElementById('loginCaptchaCanvas').addEventListener('click', refreshLoginCaptcha);
  document.getElementById('regCaptchaCanvas').addEventListener('click', refreshRegCaptcha);

  /* ---------- 注册头像上传（读取为 base64）---------- */
  let regAvatarBase64 = '';
  document.getElementById('regAvatar').addEventListener('change', function () {
    const file = this.files && this.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('头像图片不能超过 2MB', 'err'); this.value = ''; return; }
    const reader = new FileReader();
    reader.onload = function (e) {
      regAvatarBase64 = e.target.result;
      document.getElementById('regAvatarPreview').style.backgroundImage = 'url(' + regAvatarBase64 + ')';
      document.getElementById('regAvatarPreview').textContent = '';
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('regAvatarPreview').addEventListener('click', function () {
    document.getElementById('regAvatar').click();
  });

  /* ---------- 登录 ---------- */
  document.getElementById('loginBtn').addEventListener('click', function () {
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPwd').value;
    const captcha = document.getElementById('loginCaptcha').value.trim().toUpperCase();

    if (!username || !password) return toast('请填写账号和密码', 'err');
    if (!captcha) return toast('请填写验证码', 'err');
    if (captcha !== loginCode) {
      toast('验证码错误', 'err');
      refreshLoginCaptcha();
      document.getElementById('loginCaptcha').value = '';
      return;
    }

    API.login({ username: username, password: password }).then(function (r) {
      if (r.code === 0) {
        toast('登录成功', 'ok');
        setTimeout(function () { location.href = 'user.html'; }, 600);
      } else {
        toast(r.msg || '登录失败', 'err');
      }
    });
  });

  /* ---------- 注册 ---------- */
  document.getElementById('registerBtn').addEventListener('click', function () {
    const username = document.getElementById('regUser').value.trim();
    const nickname = document.getElementById('regNick').value.trim();
    const password = document.getElementById('regPwd').value;
    const captcha = document.getElementById('regCaptcha').value.trim().toUpperCase();

    if (!username || !password) return toast('请填写账号和密码', 'err');
    if (password.length < 6) return toast('密码至少6位', 'err');
    if (!captcha) return toast('请填写验证码', 'err');
    if (captcha !== regCode) {
      toast('验证码错误', 'err');
      refreshRegCaptcha();
      document.getElementById('regCaptcha').value = '';
      return;
    }

    API.register({ username: username, password: password, nickname: nickname, avatar: regAvatarBase64 }).then(function (r) {
      if (r.code === 0) {
        toast('注册成功，已自动登录', 'ok');
        setTimeout(function () { location.href = 'user.html'; }, 600);
      } else {
        toast(r.msg || '注册失败', 'err');
      }
    });
  });

  /* ---------- 回车提交 ---------- */
  [document.getElementById('loginUser'), document.getElementById('loginPwd'),
   document.getElementById('loginCaptcha')].forEach(function (el) {
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('loginBtn').click();
    });
  });
  [document.getElementById('regUser'), document.getElementById('regNick'),
   document.getElementById('regPwd'), document.getElementById('regCaptcha')].forEach(function (el) {
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('registerBtn').click();
    });
  });

  /* ---------- 初始化 ---------- */
  renderNav('login.html');

  if (API.getSession()) {
    location.href = 'user.html';
    return;
  }

  refreshLoginCaptcha();
  refreshRegCaptcha();
})();
