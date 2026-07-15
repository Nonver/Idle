/* login.js — 登录/注册（Vue 3） */
(function(){
  'use strict';
  /* 防御：确保依赖已加载 */
  if (typeof Vue === 'undefined') { console.error('[xzwp] Vue 未加载'); return; }
  if (typeof window.App === 'undefined') { console.error('[xzwp] common.js 未正确加载'); return; }
  var App = window.App;
  var API = App.API, toast = App.toast;

  /* ---------- 验证码工具（美化版） ---------- */
  var _captchaColors = [
    '#13c2a3','#0ea58e','#36d1dc','#5cdbd8','#1abc9c','#16a085',
    '#e74c3c','#c0392b','#3498db','#2980b9','#9b59b6','#8e44ad'
  ];
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function rand(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }

  function genCode(len){
    /* 去掉易混淆字符：0/O、1/I/L、S/5 */
    var c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s='';
    for(var i=0;i<len;i++) s+=c[Math.floor(Math.random()*c.length)];
    return s;
  }

  function drawCaptcha(canvasEl, code){
    if(!canvasEl) return;
    var ctx=canvasEl.getContext('2d'), w=canvasEl.width, h=canvasEl.height;

    /* 圆角矩形裁剪区 */
    ctx.save();
    ctx.beginPath();
    var r=8;
    ctx.moveTo(r,0); ctx.lineTo(w-r,0); ctx.arcTo(w,0,w,r,r);
    ctx.lineTo(w,h-r); ctx.arcTo(w,h,w-r,h,r);
    ctx.lineTo(r,h); ctx.arcTo(0,h,0,r,r);
    ctx.lineTo(0,r); ctx.arcTo(0,0,r,0,r);
    ctx.closePath();
    ctx.clip();

    /* 渐变背景 */
    var bgGrad=ctx.createLinearGradient(0,0,w,h);
    bgGrad.addColorStop(0,'#f0f7f6');
    bgGrad.addColorStop(0.5,'#eaf4f3');
    bgGrad.addColorStop(1,'#f5faf9');
    ctx.fillStyle=bgGrad; ctx.fillRect(0,0,w,h);

    /* 干扰曲线（贝塞尔） */
    for(var i=0;i<4;i++){
      ctx.strokeStyle='rgba('+rand(100,200)+','+rand(180,220)+','+rand(180,210)+','+(0.15+Math.random()*0.2).toFixed(2)+')';
      ctx.lineWidth=rand(1,2);
      ctx.beginPath();
      ctx.moveTo(rand(-10,w+10),rand(0,h));
      ctx.bezierCurveTo(
        rand(0,w),rand(0,h),
        rand(0,w),rand(0,h),
        rand(-10,w+10),rand(0,h)
      );
      ctx.stroke();
    }

    /* 干扰点（大小不一） */
    for(var j=0;j<60;j++){
      var dotR=rand(1,3);
      ctx.fillStyle='rgba('+rand(120,200)+','+rand(160,210)+','+rand(170,200)+','+rand(20,50)/100+')';
      ctx.beginPath(); ctx.arc(rand(0,w),rand(0,h),dotR,0,Math.PI*2); ctx.fill();
    }

    /* 绘制文字（每个字符独立颜色+旋转+位置抖动） */
    var cw=Math.floor((w-24)/code.length);
    for(var k=0;k<code.length;k++){
      var x=12+k*cw+rand(-3,3), y=rand(h*0.55,h*0.82);
      ctx.fillStyle=pick(_captchaColors);
      var fontSize=rand(21,26);
      ctx.font='bold '+fontSize+'px "Segoe UI","PingFang SC","Microsoft YaHei",sans-serif';
      ctx.textBaseline='middle';
      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(rand(-18,18)*Math.PI/180);
      /* 轻微阴影 */
      ctx.shadowColor='rgba(0,0,0,0.12)';
      ctx.shadowOffsetX=1; ctx.shadowOffsetY=1; ctx.shadowBlur=2;
      ctx.fillText(code[k],0,0);
      ctx.restore();
    }

    /* 装饰性短线 */
    for(var m=0;m<6;m++){
      ctx.strokeStyle='rgba('+rand(150,210)+','+rand(170,220)+','+rand(180,210)+',0.25)';
      ctx.lineWidth=rand(1,2);
      ctx.beginPath();
      var sx=rand(0,w), sy=rand(0,h);
      ctx.moveTo(sx,sy);
      ctx.lineTo(sx+rand(-15,15),sy+rand(-15,15));
      ctx.stroke();
    }

    ctx.restore();

    /* 边框描边 */
    ctx.strokeStyle='rgba(19,194,163,0.2)';
    ctx.lineWidth=1;
    ctx.strokeRect(0.5,0.5,w-1,h-1);
  }

  var app = Vue.createApp({
    data: function(){
      return {
        /* 系统配置（从 settings 表读取） */
        siteTitle: '闲置微铺',
        siteIcon: '',
        siteSub: '让闲置流动起来',
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
    computed: {
      iconStyle: function(){
        if(this.siteIcon) return { backgroundImage:'url('+App.img(this.siteIcon)+')', backgroundSize:'cover', backgroundPosition:'center' };
        return {};
      },
      iconChar: function(){ return this.siteIcon ? '' : (this.siteTitle||'?').slice(0,1); }
    },
    mounted: function(){
      this.refreshLoginCaptcha();
      this.refreshRegCaptcha();
      if(API.getSession()) location.href='user.html';
      App.renderNav('login.html');
      /* 从系统配置读取标题/图标/描述（覆盖默认值） */
      var cfg=App.config();
      if(cfg){
        if(cfg.site_title) this.siteTitle=cfg.site_title;
        if(cfg.site_icon) this.siteIcon=cfg.site_icon;
        if(cfg.contact) this.siteSub=cfg.contact||this.siteSub;
      }
      /* 异步：loadConfig 可能还没返回，监听一下 */
      var self=this;
      App.loadConfig().then(function(c){
        if(c){
          if(c.site_title) self.siteTitle=c.site_title;
          if(c.site_icon) self.siteIcon=c.site_icon;
          if(c.contact) self.siteSub=c.contact||self.siteSub;
        }
      });
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
  try { app.mount('#loginApp'); } catch (e) { console.error('[xzwp] login Vue mount 失败:', e); }
})();
