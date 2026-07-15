/* login.js — 后台登录页逻辑 */
(function(){
  'use strict';
  var API='../api/';
  function req(u, body){
    return fetch(API+u, {method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body:JSON.stringify(body)})
      .then(function(r){ return r.ok ? r.json() : {code:1, msg:'接口异常 '+r.status}; })
      .catch(function(){ return {code:1, msg:'网络错误'}; });
  }
  function ok(r){ return r && r.code === 0; }

  /* 已登录则直接进仪表盘 */
  fetch(API+'admin.php?act=me', {credentials:'same-origin'}).then(function(r){ return r.json(); }).then(function(r){
    if (ok(r)) location.href = 'dashboard.html';
  });

  document.getElementById('adminLoginForm').addEventListener('submit', function(e){
    e.preventDefault();
    var u = document.getElementById('adminUser').value.trim();
    var p = document.getElementById('adminPwd').value;
    var m = document.getElementById('msg');
    m.textContent = ''; m.className = 'login-msg';
    if (!u || !p) { m.textContent = '请输入账号和密码'; m.classList.add('visible'); return; }
    var b = this.querySelector('[type=submit]'); b.disabled = true; b.textContent = '登录中…';
    req('admin.php?act=login', {username:u, password:p}).then(function(r){
      b.disabled = false; b.textContent = '登 录';
      if (ok(r)) { location.href = 'dashboard.html'; }
      else { m.textContent = (r && r.msg) || '登录失败'; m.classList.add('visible'); }
    });
  });
})();
