<?php
/**
 * pay_config.php — 支付配置管理接口
 *
 *   GET  ?act=list&type=recharge|withdraw    获取配置列表（前端/后台共用）
 *   POST ?act=add                             新增配置 {type, channel, account_name, account_no, qrcode, sort_order}
 *   GET  ?act=delete&id=                      删除配置
 *   POST ?act=update&id=                      更新配置 {channel, account_name, account_no, qrcode, sort_order, status}
 *
 * 前端充值页用 GET list?type=recharge 读取可用的充值账户
 * 后台支付配置页用全部接口
 */
require_once __DIR__ . '/config.php';

$act = $_GET['act'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

/* ---------- 列表（公开，无需登录；all=1 时需管理员）---------- */
if ($act === 'list') {
    $type = trim($_GET['type'] ?? '');
    if (!in_array($type, ['recharge', 'withdraw'], true)) json_out(1, 'type 参数非法');
    $all = isset($_GET['all']) && $_GET['all'] === '1';
    if ($all) require_admin();
    if ($all) {
        $st = db()->prepare('SELECT * FROM pay_configs WHERE type=? ORDER BY sort_order ASC, id ASC');
    } else {
        $st = db()->prepare('SELECT id,channel,account_name,account_no,qrcode,sort_order FROM pay_configs WHERE type=? AND status=1 ORDER BY sort_order ASC, id ASC');
    }
    $st->execute([$type]);
    json_out(0, '', $st->fetchAll());
}

/* 以下操作需后台管理员权限 */
require_admin();

/* ---------- 新增 ---------- */
if ($act === 'add' && $method === 'POST') {
    $b = body();
    $type   = trim($b['type'] ?? '');
    $channel = trim($b['channel'] ?? 'alipay');
    $name   = trim($b['account_name'] ?? '');
    $no     = trim($b['account_no'] ?? '');
    $qrcode = trim($b['qrcode'] ?? '');
    $sort   = intval($b['sort_order'] ?? 0);

    if (!in_array($type, ['recharge', 'withdraw'])) json_out(1, '类型非法');
    if (!in_array($channel, ['alipay', 'wechat', 'bank'])) json_out(1, '渠道非法');
    if ($no === '') json_out(1, '账号不能为空');

    $st = db()->prepare('INSERT INTO pay_configs (type,channel,account_name,account_no,qrcode,sort_order,status,created_at) VALUES (?,?,?,?,?,?,1,?)');
    $st->execute([$type, $channel, $name, $no, $qrcode, $sort, time()]);
    json_out(0, '已添加', ['id' => (int)db()->lastInsertId()]);
}

/* ---------- 更新 ---------- */
if ($act === 'update' && $method === 'POST') {
    $id = intval($_GET['id'] ?? 0);
    if ($id <= 0) json_out(1, 'ID 非法');
    $b = body();
    $channel = trim($b['channel'] ?? '');
    $name    = trim($b['account_name'] ?? '');
    $no      = trim($b['account_no'] ?? '');
    $qrcode  = trim($b['qrcode'] ?? '');
    $sort    = intval($b['sort_order'] ?? 0);
    $status  = isset($b['status']) ? (intval($b['status']) ? 1 : 0) : null;

    $st = db()->prepare('UPDATE pay_configs SET channel=?,account_name=?,account_no=?,qrcode=?,sort_order=?' . ($status !== null ? ',status=?' : '') . ' WHERE id=?');
    $params = [$channel, $name, $no, $qrcode, $sort];
    if ($status !== null) $params[] = $status;
    $params[] = $id;
    $st->execute($params);
    json_out(0, '已更新');
}

/* ---------- 删除 ---------- */
if ($act === 'delete') {
    $id = intval($_GET['id'] ?? 0);
    if ($id <= 0) json_out(1, 'ID 非法');
    db()->prepare('DELETE FROM pay_configs WHERE id=?')->execute([$id]);
    json_out(0, '已删除');
}

json_out(1, '未知操作');
