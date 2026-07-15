<?php
/**
 * finance.php — 后台财务管理（充值审核 / 提现审核）
 *   GET  ?act=records&type=recharge|withdraw&status=  列表（支持按类型和状态筛选）
 *   POST ?act=review                              审核（通过/拒绝）{id, action: approve|reject, note}
 * 统计信息：
 *   GET  ?act=stats                               充值/提现 各状态计数
 */
require_once __DIR__ . '/config.php';
require_admin();

$method = $_SERVER['REQUEST_METHOD'];
$act = $_GET['act'] ?? '';
$pdo = db();

/* ---- 记录列表（含统计） ---- */
if ($act === 'records' && $method === 'GET') {
    $type = trim($_GET['type'] ?? '');
    $status = trim($_GET['status'] ?? '');
    if (!in_array($type, ['recharge', 'withdraw', '', 'all'], true)) json_out(1, 'type 参数非法');
    $sql = 'SELECT fo.id, fo.type, fo.user_id, fo.username, fo.amount, fo.actual_amount, fo.status, fo.review_note, fo.created_at, fo.reviewed_at, fo.pay_method, fo.pay_info, u.nickname FROM financial_orders fo LEFT JOIN users u ON fo.user_id=u.id WHERE 1=1';
    $params = [];
    if ($type && $type !== 'all') { $sql .= ' AND fo.type=?'; $params[] = $type; }
    if ($status) { $sql .= ' AND fo.status=?'; $params[] = $status; }
    $sql .= ' ORDER BY fo.id DESC LIMIT 200';
    $st = $pdo->prepare($sql);
    $st->execute($params);
    $list = $st->fetchAll();

    /* 附带统计信息（避免前端二次请求） */
    $stats = [];
    $types = ($type && $type !== 'all') ? [$type] : ['recharge','withdraw'];
    foreach ($types as $t) {
        foreach (['pending','approved','rejected'] as $s) {
            /* 充值类：已审核记录以 actual_amount 为准（管理员确认的实际到账金额） */
            /* 提现类：以申请金额为准 */
            if ($t === 'recharge' && $s !== 'pending') {
                $sqlAmt = 'SELECT COUNT(*) AS cnt, COALESCE(SUM(actual_amount),0) AS amt FROM financial_orders WHERE type=? AND status=?';
            } else {
                $sqlAmt = 'SELECT COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS amt FROM financial_orders WHERE type=? AND status=?';
            }
            $r = $pdo->prepare($sqlAmt);
            $r->execute([$t, $s]);
            $row = $r->fetch();
            $stats[$t . '_' . $s]           = intval($row['cnt']);
            $stats[$t . '_' . $s . '_amount'] = floatval($row['amt']);
        }
    }

    json_out(0, '', ['list' => $list, 'stats' => $stats]);
}

/* ---- 审核操作 ---- */
if ($act === 'review' && $method === 'POST') {
    $b = body();
    $id = isset($b['id']) ? intval($b['id']) : 0;
    $action = trim($b['action'] ?? '');
    $note = trim($b['note'] ?? '');
    /* 充值通过时可由管理员指定实际到账金额（默认用申请金额） */
    $actualAmt = isset($b['actual_amount']) ? floatval($b['actual_amount']) : 0;

    if (!$id) json_out(1, '缺少记录ID');
    if (!in_array($action, ['approve', 'reject'], true)) json_out(1, 'action 参数非法');

    /* 查找记录 */
    $row = $pdo->prepare('SELECT id,type,user_id,amount,status FROM financial_orders WHERE id=? FOR UPDATE');
    $row->execute([$id]);
    $rec = $row->fetch();
    if (!$rec) json_out(1, '记录不存在');
    if ($rec['status'] !== 'pending') json_out(1, '该记录已审核过');

    $now = time();
    $adminId = require_admin();  // 用缓存变量
    $finalAmt = 0; // 实际到账/操作金额，用于写入 actual_amount

    if ($action === 'approve') {
        /* 通过 */
        if ($rec['type'] === 'recharge') {
            /* 充值通过 —— 用管理员确认的实际金额加余额（未填或≤0则用申请金额） */
            $finalAmt = ($actualAmt > 0) ? $actualAmt : floatval($rec['amount']);
            $updBalance = $pdo->prepare('UPDATE users SET balance = balance + ? WHERE id = ?');
            $updBalance->execute([$finalAmt, $rec['user_id']]);
            if ($updBalance->rowCount() === 0) json_out(1, '余额更新失败：用户不存在');
        } else {
            /* 提现通过 —— 余额已在申请时扣减，实际金额=申请金额 */
            $finalAmt = floatval($rec['amount']);
        }
        $newStatus = 'approved';
    } else {
        /* 拒绝 */
        if ($rec['type'] === 'withdraw') {
            /* 提现拒绝 —— 退还余额 */
            $finalAmt = floatval($rec['amount']);
            $pdo->prepare('UPDATE users SET balance = balance + ? WHERE id = ?')->execute([$finalAmt, $rec['user_id']]);
        }
        /* 充值拒绝 —— 未加余额，实际金额=0 */
        $finalAmt = 0;
        $newStatus = 'rejected';
    }

    /* 更新记录状态 + 写入实际到账金额 */
    $upd = $pdo->prepare('UPDATE financial_orders SET status=?, actual_amount=?, review_note=?, reviewed_at=?, reviewer_id=? WHERE id=?');
    $upd->execute([$newStatus, $finalAmt, $note, $now, $adminId, $id]);

    json_out(0, $action === 'approve' ? '已通过（到账 ¥' . number_format($finalAmt, 2) . '）' : '已拒绝');
}

json_out(1, '未知操作');
