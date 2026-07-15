<?php
/**
 * captcha.php — 验证码接口
 *
 * 工作方式：
 *   GET ?act=generate → 返回 {code: "ABCD"} （前端用此 code 渲染验证码图片）
 *   POST {captcha}    → 校验传入的验证码是否与 session 中的一致
 *
 * 不依赖 GD 库，前端 JS 用 Canvas 绘制图形验证码。
 */
require_once __DIR__ . '/config.php';

$act = $_GET['act'] ?? '';

// ---- 生成验证码（返回 code 给前端 Canvas 用）----
if ($act === 'generate') {
    session_reopen();
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $code = '';
    for ($i = 0; $i < 4; $i++) {
        $code .= $chars[mt_rand(0, strlen($chars) - 1)];
    }
    // 存入 session，供登录/注册校验
    $_SESSION['captcha_code'] = $code;
    json_out(0, '', ['code' => $code]);
}

// ---- 校验验证码 ----
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $b = body();
    $input = strtoupper(trim($b['captcha'] ?? ''));

    if (!isset($_SESSION['captcha_code']) || $input !== $_SESSION['captcha_code']) {
        json_out(1, '验证码错误或已过期');
    }
    unset($_SESSION['captcha_code']); // 用完即销
    json_out(0, '验证码正确');
}

json_out(1, '未知操作');
