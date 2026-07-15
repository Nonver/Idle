<?php
/**
 * admin.php — 后台管理接口
 *   GET  ?act=me            当前管理员（用于自动登录态判断）
 *   POST ?act=login         管理员登录   {username, password}
 *   POST ?act=logout        退出后台
 *   GET  ?act=stats         概览统计
 *   GET  ?act=users         用户列表（?kw= 搜索）
 *        ?act=users&op=delete&id=   删除用户
 *        ?act=users&op=ban&id=&v=1|0 封禁/解封
 *   GET  ?act=products      商品列表（?kw= 搜索）
 *        ?act=products&op=delete&id=        删除商品
 *        ?act=products&op=toggle&id=        上下架切换
 *   GET  ?act=orders        订单列表（含商品缩略图 img）
 *        ?act=orders&op=ship&id=         确认发货：托管款打给发布人 → status=completed
 *        ?act=orders&op=reject&id=        驳回：托管款退回买家 + 商品重新上架 → status=rejected
 *
 * 说明：管理员即 users 表中 is_admin=1 的账号，复用 password_hash 校验。
 */
require_once __DIR__ . '/config.php';

$act = $_GET['act'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

/* ---------- 自动登录态 ---------- */
if ($act === 'me') {
    global $session_admin_id, $session_admin_name;
    if ($session_admin_id === null) json_out(401, '未登录');
    json_out(0, '', ['name' => $session_admin_name ?: '']);
}

/* ---------- 登录 ---------- */
if ($act === 'login' && $method === 'POST') {
    session_reopen();
    $b = body();
    $username = trim($b['username'] ?? '');
    $password = $b['password'] ?? '';
    if ($username === '' || $password === '') json_out(1, '账号和密码必填');

    $u = db()->prepare('SELECT id,username,password FROM users WHERE username=? AND is_admin=1');
    $u->execute([$username]);
    $row = $u->fetch();
    if (!$row || !password_verify($password, $row['password'])) {
        json_out(1, '账号或密码错误，或无管理员权限');
    }
    $_SESSION['admin_id'] = $row['id'];
    $_SESSION['admin_name'] = $row['username'];
    json_out(0, '登录成功', ['name' => $row['username']]);
}

/* ---------- 退出 ---------- */
if ($act === 'logout') {
    session_reopen();
    unset($_SESSION['admin_id'], $_SESSION['admin_name']);
    json_out(0, '已退出');
}

/* 以下接口均需管理员登录 */
require_admin();

/* ---------- 概览统计 ---------- */
if ($act === 'stats') {
    $today = strtotime('today');
    $stats = [
        // 用户
        'users'       => db()->query('SELECT COUNT(*) FROM users')->fetchColumn(),
        'banned'      => db()->query('SELECT COUNT(*) FROM users WHERE banned=1')->fetchColumn(),
        // 商品
        'products'    => db()->query('SELECT COUNT(*) FROM products')->fetchColumn(),
        'products_on' => db()->query("SELECT COUNT(*) FROM products WHERE status='on'")->fetchColumn(),
        // 订单
        'orders'      => db()->query('SELECT COUNT(*) FROM orders')->fetchColumn(),
        'pending_orders' => db()->query("SELECT COUNT(*) FROM orders WHERE status='pending'")->fetchColumn(),
        'turnover'    => db()->query("SELECT COALESCE(SUM(price),0) FROM orders WHERE status='completed'")->fetchColumn(),
        // 今日订单
        'today_orders'     => db()->query("SELECT COUNT(*) FROM orders WHERE created_at >= $today")->fetchColumn(),
        'today_turnover'   => db()->query("SELECT COALESCE(SUM(price),0) FROM orders WHERE status='completed' AND created_at >= $today")->fetchColumn(),
        // 充值/提现 —— 基于财务审核表 financial_orders（已通过为准）
        // 充值用 actual_amount（管理员确认的实际到账金额），提现用 amount（申请金额）
        'total_recharge'   => db()->query("SELECT COALESCE(SUM(actual_amount),0) FROM financial_orders WHERE type='recharge' AND status='approved'")->fetchColumn(),
        'today_recharge'   => db()->query("SELECT COALESCE(SUM(actual_amount),0) FROM financial_orders WHERE type='recharge' AND status='approved' AND reviewed_at >= $today")->fetchColumn(),
        'total_withdraw'   => db()->query("SELECT COALESCE(SUM(amount),0) FROM financial_orders WHERE type='withdraw' AND status='approved'")->fetchColumn(),
        'today_withdraw'   => db()->query("SELECT COALESCE(SUM(amount),0) FROM financial_orders WHERE type='withdraw' AND status='approved' AND reviewed_at >= $today")->fetchColumn(),
    ];
    json_out(0, '', $stats);
}

/* ---------- 用户管理 ---------- */
if ($act === 'users') {
    if (isset($_GET['op'])) {
        $id = intval($_GET['id'] ?? 0);
        global $session_admin_id;
        if ($id == $session_admin_id) json_out(1, '不能操作当前管理员账号');

        if ($_GET['op'] === 'delete') {
            db()->prepare('DELETE FROM users WHERE id=?')->execute([$id]);
            json_out(0, '已删除用户');
        }
        if ($_GET['op'] === 'ban') {
            $v = intval($_GET['v'] ?? 0) ? 1 : 0;
            db()->prepare('UPDATE users SET banned=? WHERE id=?')->execute([$v, $id]);
            json_out(0, $v ? '已封禁' : '已解封');
        }
        /* 根据财务审核记录重新计算用户余额 */
        if ($_GET['op'] === 'sync_balance') {
            $pdo = db();
            /* 充值：已通过的实际到账金额 */
            $rIn = $pdo->prepare("SELECT COALESCE(SUM(actual_amount),0) FROM financial_orders WHERE user_id=? AND type='recharge' AND status='approved'");
            $rIn->execute([$id]);
            $rechargeTotal = floatval($rIn->fetchColumn());
            /* 提现：已通过的（已扣）+ 待审的（冻结扣）- 已拒绝的（已退还） */
            $rOut = $pdo->prepare("SELECT COALESCE(SUM(CASE WHEN status='rejected' THEN -amount ELSE amount END),0) FROM financial_orders WHERE user_id=? AND type='withdraw' AND status IN ('pending','approved','rejected')");
            $rOut->execute([$id]);
            $withdrawNet = floatval($rOut->fetchColumn());
            $newBal = round($rechargeTotal - $withdrawNet, 2);
            $upd = $pdo->prepare('UPDATE users SET balance=? WHERE id=?');
            $upd->execute([$newBal, $id]);
            json_out(0, '余额已同步', ['balance' => $newBal]);
        }
        json_out(1, '未知操作');
    }
    $kw = trim($_GET['kw'] ?? '');
    if ($kw !== '') {
        $st = db()->prepare('SELECT id,username,nickname,balance,banned,is_admin,created_at FROM users WHERE username LIKE ? OR nickname LIKE ? ORDER BY id DESC');
        $st->execute(['%' . $kw . '%', '%' . $kw . '%']);
    } else {
        $st = db()->query('SELECT id,username,nickname,balance,banned,is_admin,created_at FROM users ORDER BY id DESC');
    }
    json_out(0, '', $st->fetchAll());
}

/* ---------- 商品管理 ---------- */
if ($act === 'products') {
    if (isset($_GET['op'])) {
        $id = intval($_GET['id'] ?? 0);

        if ($_GET['op'] === 'delete') {
            db()->prepare('DELETE FROM products WHERE id=?')->execute([$id]);
            json_out(0, '已删除商品');
        }
        if ($_GET['op'] === 'toggle') {
            $cur = db()->prepare('SELECT status FROM products WHERE id=?');
            $cur->execute([$id]);
            $r = $cur->fetch();
            $new = ($r && $r['status'] === 'on') ? 'off' : 'on';
            db()->prepare('UPDATE products SET status=? WHERE id=?')->execute([$new, $id]);
            json_out(0, 'ok', ['status' => $new]);
        }
        json_out(1, '未知操作');
    }
    $kw = trim($_GET['kw'] ?? '');
    if ($kw !== '') {
        $st = db()->prepare('SELECT * FROM products WHERE title LIKE ? OR publisher LIKE ? ORDER BY created_at DESC');
        $st->execute(['%' . $kw . '%', '%' . $kw . '%']);
    } else {
        $st = db()->query('SELECT * FROM products ORDER BY created_at DESC');
    }
    json_out(0, '', $st->fetchAll());
}

/* ---------- 订单管理（担保交易：发货打款 / 驳回退款） ---------- */
if ($act === 'orders') {
    if (isset($_GET['op'])) {
        $id = intval($_GET['id'] ?? 0);
        $pdo = db();

        if ($_GET['op'] === 'ship') {
            // 确认发货：把托管款项打给发布人
            try {
                $pdo->beginTransaction();
                $o = $pdo->prepare('SELECT * FROM orders WHERE id=? FOR UPDATE');
                $o->execute([$id]);
                $ord = $o->fetch();
                if (!$ord) { $pdo->rollBack(); json_out(1, '订单不存在'); }
                if ($ord['status'] !== 'pending') { $pdo->rollBack(); json_out(1, '该订单已处理，无需重复发货'); }

                $seller = $pdo->prepare('SELECT id,balance FROM users WHERE nickname=? FOR UPDATE');
                $seller->execute([$ord['publisher']]);
                $sellerRow = $seller->fetch();
                if ($sellerRow) {
                    $pdo->prepare('UPDATE users SET balance = balance + ? WHERE id = ?')
                        ->execute([$ord['price'], $sellerRow['id']]);
                }
                $pdo->prepare('UPDATE orders SET status=\'completed\' WHERE id=?')->execute([$id]);
                $pdo->commit();
                json_out(0, '已确认发货，款项已打给发布人');
            } catch (Exception $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                json_out(1, '操作失败：' . $e->getMessage());
            }
        }

        if ($_GET['op'] === 'reject') {
            // 驳回：把托管款项退回买家，商品重新上架
            try {
                $pdo->beginTransaction();
                $o = $pdo->prepare('SELECT * FROM orders WHERE id=? FOR UPDATE');
                $o->execute([$id]);
                $ord = $o->fetch();
                if (!$ord) { $pdo->rollBack(); json_out(1, '订单不存在'); }
                if ($ord['status'] !== 'pending') { $pdo->rollBack(); json_out(1, '该订单已处理，无需重复驳回'); }

                $buyer = $pdo->prepare('SELECT id,balance FROM users WHERE username=? FOR UPDATE');
                $buyer->execute([$ord['buyer']]);
                $buyerRow = $buyer->fetch();
                if ($buyerRow) {
                    $pdo->prepare('UPDATE users SET balance = balance + ? WHERE id = ?')
                        ->execute([$ord['price'], $buyerRow['id']]);
                }
                // 商品重新上架
                $pdo->prepare('UPDATE products SET status=\'on\' WHERE id=?')->execute([$ord['product_id']]);
                $pdo->prepare('UPDATE orders SET status=\'rejected\' WHERE id=?')->execute([$id]);
                $pdo->commit();
                json_out(0, '已驳回，款项已退回买家');
            } catch (Exception $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                json_out(1, '操作失败：' . $e->getMessage());
            }
        }

        json_out(1, '未知操作');
    }
    $st = db()->query('SELECT o.*, p.img AS img FROM orders o LEFT JOIN products p ON o.product_id=p.id ORDER BY o.created_at DESC');
    json_out(0, '', $st->fetchAll());
}

json_out(1, '未知操作');
