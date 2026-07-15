<?php
/**
 * wallet.php — 资金（充值 / 提现）—— 审核制
 *   POST ?act=recharge  充值申请 {amount}  → 创建待审核充值订单
 *   POST ?act=withdraw  提现申请 {amount}  → 冻结余额 + 创建待审核提现订单
 *   GET  ?act=records   查看我的记录        → 返回当前用户的充值/提现记录列表
 */
require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$act = $_GET['act'] ?? '';

/* ---- 查看记录（需登录）---- */
if ($act === 'records' && $method === 'GET') {
    $uid = require_login();
    $type = trim($_GET['type'] ?? ''); /* 可选：recharge / withdraw / 空=全部 */
    if (in_array($type, ['recharge', 'withdraw'], true)) {
        $st = db()->prepare('SELECT id,type,amount,status,review_note,created_at,reviewed_at FROM financial_orders WHERE user_id=? AND type=? ORDER BY id DESC');
        $st->execute([$uid, $type]);
    } else {
        $st = db()->prepare('SELECT id,type,amount,status,review_note,created_at,reviewed_at FROM financial_orders WHERE user_id=? ORDER BY id DESC');
        $st->execute([$uid]);
    }
    json_out(0, '', $st->fetchAll());
}

if ($method !== 'POST') json_out(1, '方法不允许');
$uid = require_login();

$b = body();
$amount = isset($b['amount']) ? floatval($b['amount']) : 0;
if ($amount <= 0) json_out(1, '金额无效');
if ($amount < 1) json_out(1, '最低金额为 1 元');

$pdo = db();

/* 取用户名（冗余存入 financial_orders） */
$uname = '';
$ust = $pdo->prepare('SELECT username FROM users WHERE id=?');
$ust->execute([$uid]);
$urow = $ust->fetch();
if ($urow) $uname = $urow['username'];

$now = time();

if ($act === 'recharge') {
    /* 充值 —— 创建待审核订单，不直接加余额 */
    $ins = $pdo->prepare('INSERT INTO financial_orders (type,user_id,username,amount,status,created_at) VALUES (?,?,?,?,?,?)');
    $ins->execute(['recharge', $uid, $uname, $amount, 'pending', $now]);
    json_out(0, '充值申请已提交，等待管理员审核', ['id' => $pdo->lastInsertId()]);

} elseif ($act === 'withdraw') {
    /* 提现 —— 先检查余额并冻结（扣减），创建待审核订单；拒绝时退还 */
    $bal = $pdo->prepare('SELECT balance FROM users WHERE id=? FOR UPDATE');
    $bal->execute([$uid]);
    $row = $bal->fetch();
    $cur = floatval($row['balance'] ?? 0);
    if ($cur < $amount) json_out(1, '余额不足，当前余额 ¥' . number_format($cur, 2));

    /* 扣减余额（冻结），等审核通过则确认扣减，拒绝则退回 */
    $pdo->prepare('UPDATE users SET balance = balance - ? WHERE id = ?')->execute([$amount, $uid]);

    $ins = $pdo->prepare('INSERT INTO financial_orders (type,user_id,username,amount,status,created_at) VALUES (?,?,?,?,?,?)');
    $ins->execute(['withdraw', $uid, $uname, $amount, 'pending', $now]);
    json_out(0, '提现申请已提交，等待管理员审核', ['id' => $pdo->lastInsertId()]);

} else {
    json_out(1, '未知操作');
}
