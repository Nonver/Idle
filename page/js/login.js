/* login.js — 登录/注册（Vue 3） */
(function(){
  'use strict';
  var App = window.App;
  var API = App.API, toast = App.toast;

  /* 验证码工具 */
  function genCode(len){
    var c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s='';
    for(var i=0;i<len;i++) s+=c[Math.floor(Math.random()*c.length)];
    return s;
  }
  function rand(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
  function drawCaptcha(canvasEl, code){
    if(!canvasEl) return;
    var ctx=canvasEl.getContext('2d'), w=canvasEl.width, h=canvasEl.height;
    ctx.fillStyle='#f0f3f8'; ctx.fillRect(0,0,w,h);
    for(var i=0;i<5;i++){ ctx.strokeStyle='rgba('+rand(150,220)+','+rand(150,220)+','+rand(150,220)+',0.6)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(rand(0,w),rand(0,h)); ctx.lineTo(rand(0,w),rand(0,h)); ctx.stroke(); }
    for(var j=0;j<80;j++){ ctx.fillStyle='rgba('+rand(160,230)+','+rand(160,230)+','+rand(160,230)+',0.5)'; ctx.fillRect(rand(0,w),rand(0,h),1,1); }
    var cw=Math.floor((w-20)/code.length);
    for(var k=0;k<code.length;k++){
      var x=10+k*cw+rand(-2,2), y=rand(26,38);
      ctx.fillStyle='rgb('+rand(20,80)+','+rand(30,90)+','+rand(50,120)+')';
      ctx.font='bold '+rand(20,24)+'px monospace'; ctx.textBaseline='middle';
      ctx.save(); ctx.translate(x+7,y); ctx.rotate(rand(-15,15)*Math.PI/180); ctx.fillText(code[k],0,0); ctx.restore();
    }
  }

  var app = Vue.createApp({
    data: function(){
      return {
        tab: 'login',
        logging: false,
        registering: false,
        loginCode: '',
        regCode: '',
        regAvatarBase64: '',
        form: {
          loginUser: '', loginPwd: '', loginCaptcha: '',
          regUser: '', regNick: '', regPwd: '', regCaptcha: ''
        }
      };
    },
    mounted: function(){
      this.refreshLoginCaptcha();
      this.refreshRegCaptcha();
      if(API.getSession()) location.href='user.html';
      App.renderNav('login.html');
    },
    methods: {
      switchToReg: function(){ this.tab='register'; this.refreshRegCaptcha(); },
      refreshLoginCaptcha: function(){
        this.loginCode = genCode(4);
        this.$nextTick(function(){ drawCaptcha(this.$refs.loginCanvas, this.loginCode); }.bind(this));
      },
      refreshRegCaptcha: function(){
        this.regCode = genCode(4);
        this.$nextTick(function(){ drawCaptcha(this.$refs.regCanvas, this.regCode); }.bind(this));
      },
      onAvatarChange: function(e){
        var f=e.target.files && e.target.files[0]; if(!f) return;
        if(f.size>2*1024*1024){ toast('头像图片不能超过 2MB','err'); e.target.value=''; return; }
        var r=new FileReader();
        r.onload=function(ev){ this.regAvatarBase64=ev.target.result; }.bind(this);
        r.readAsDataURL(f);
      },
      doLogin: function(){
        var self=this, f=self.form;
        if(!f.loginUser||!f.loginPwd){ toast('请填写账号和密码','err'); return; }
        if(!f.loginCaptcha){ toast('请填写验证码','err'); return; }
        if(f.loginCaptcha.toUpperCase()!==self.loginCode){ toast('验证码错误','err'); self.refreshLoginCaptcha(); f.loginCaptcha=''; return; }
        self.logging=true;
        API.login({username:f.loginUser,password:f.loginPwd}).then(function(r){
          self.logging=false;
          if(r.code===0){ toast('登录成功','ok'); setTimeout(function(){location.href='user.html';},600); }
          else{ toast(r.msg||'登录失败','err'); self.refreshLoginCaptcha(); f.loginCaptcha=''; }
        });
      },
      doRegister: function(){
        var self=this, f=self.form;
        if(!f.regUser||!f.regPwd){ toast('请填写账号和密码','err'); return; }
        if(f.regPwd.length<6){ toast('密码至少6位','err'); return; }
        if(!f.regCaptcha){ toast('请填写验证码','err'); return; }
        if(f.regCaptcha.toUpperCase()!==self.regCode){ toast('验证码错误','err'); self.refreshRegCaptcha(); f.regCaptcha=''; return; }
        self.registering=true;
        API.register({username:f.regUser,password:f.regPwd,nickname:f.regNick,avatar:self.regAvatarBase64}).then(function(r){
          self.registering=false;
          if(r.code===0){ toast('注册成功，已自动登录','ok'); setTimeout(function(){location.href='user.html';},600); }
          else{ toast(r.msg||'注册失败','err'); self.refreshRegCaptcha(); f.regCaptcha=''; }
        });
      }
    }
  });
  app.mount('#loginApp');
})();
