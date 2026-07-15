<?php
/**
 * auth.php — 用户认证
 *   POST ?act=register   注册   {username, password, nickname}
 *   POST ?act=login      登录   {username, password}
 *   POST ?act=logout     登出
 *   POST ?act=pwd        改密   {oldP, newP}
 *   GET  ?act=me         当前用户
 */
require_once __DIR__ . '/config.php';

// 保存 base64 图片到 uploads/，返回相对可访问路径（或空串）
function save_avatar($dataUrl) {
    if (!preg_match('/^data:image\/(\w+);base64,/', $dataUrl, $m)) return '';
    $ext = strtolower($m[1]);
    if (!in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) $ext = 'jpg';
    $bin = base64_decode(substr($dataUrl, strpos($dataUrl, ',') + 1), true);
    if ($bin === false) return '';
    $dir = __DIR__ . '/uploads';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $name = 'avatar_' . time() . '_' . mt_rand(1000, 9999) . '.' . $ext;
    if (file_put_contents($dir . '/' . $name, $bin) === false) return '';
    return 'uploads/' . $name;
}

$act = $_GET['act'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

if ($act === 'me' && $method === 'GET') {
    global $session_uid;
    if ($session_uid === null) json_out(401, '未登录');
    $u = db()->prepare('SELECT id,username,nickname,avatar,balance,created_at FROM users WHERE id=?');
    $u->execute([$session_uid]);
    json_out(0, '', $u->fetch());
}

if ($method !== 'POST') json_out(1, '方法不允许');

if ($act === 'register') {
    session_reopen();
    $b = body();
    $username = trim($b['username'] ?? '');
    $password = $b['password'] ?? '';
    $nickname = trim($b['nickname'] ?? $username);

    if ($username === '' || $password === '') json_out(1, '账号和密码必填');
    if (mb_strlen($username) > 50 || mb_strlen($nickname) > 50) json_out(1, '长度超限');

    $chk = db()->prepare('SELECT id FROM users WHERE username=?');
    $chk->execute([$username]);
    if ($chk->fetch()) json_out(1, '该账号已存在');

    $avatar = '';
    if (!empty($b['avatar']) && is_string($b['avatar'])) {
        $avatar = save_avatar($b['avatar']);
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $ins = db()->prepare('INSERT INTO users (username,password,nickname,avatar,balance,created_at) VALUES (?,?,?,?,0,?)');
    $ins->execute([$username, $hash, $nickname, $avatar, time()]);
    $uid = db()->lastInsertId();

    $_SESSION['uid'] = $uid;
    $_SESSION['username'] = $username;
    $_SESSION['nickname'] = $nickname;
    json_out(0, '注册成功', ['id' => $uid, 'username' => $username, 'nickname' => $nickname, 'avatar' => $avatar, 'balance' => 0]);
}

if ($act === 'login') {
    session_reopen();
    $b = body();
    $username = trim($b['username'] ?? '');
    $password = $b['password'] ?? '';

    if ($username === '' || $password === '') json_out(1, '账号和密码必填');

    $u = db()->prepare('SELECT id,username,nickname,avatar,password,balance,banned FROM users WHERE username=?');
    $u->execute([$username]);
    $row = $u->fetch();
    if (!$row || !password_verify($password, $row['password'])) json_out(1, '账号或密码错误');
    if (!empty($row['banned'])) json_out(1, '该账号已被封禁，请联系管理员');

    $_SESSION['uid'] = $row['id'];
    $_SESSION['username'] = $row['username'];
    $_SESSION['nickname'] = $row['nickname'];
    json_out(0, '登录成功', [
        'id' => $row['id'], 'username' => $row['username'],
        'nickname' => $row['nickname'], 'avatar' => $row['avatar'], 'balance' => $row['balance'],
    ]);
}

if ($act === 'logout') {
    session_reopen();
    session_destroy();
    json_out(0, '已退出');
}

if ($act === 'pwd') {
    $uid = require_login();  // 用缓存变量
    $b = body();
    $oldP = $b['oldP'] ?? '';
    $newP = $b['newP'] ?? '';
    if ($oldP === '' || $newP === '') json_out(1, '请填写完整');

    $u = db()->prepare('SELECT password FROM users WHERE id=?');
    $u->execute([$uid]);
    $row = $u->fetch();
    if (!password_verify($oldP, $row['password'])) json_out(1, '原密码错误');

    $hash = password_hash($newP, PASSWORD_DEFAULT);
    db()->prepare('UPDATE users SET password=? WHERE id=?')->execute([$hash, $uid]);
    json_out(0, '密码修改成功');
}

json_out(1, '未知操作');
