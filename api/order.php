<?php
/**
 * order.php — 订单（担保交易 / 平台托管）
 *   GET           我的订单（buyer = 当前账号）
 *   POST          购买    {productId}
 *                  扣买家余额（款项进入平台托管）→ 插入订单(pending) → 商品下架（事务）
 *                  注意：下单只扣买家，款项暂不打给卖家；由后台“确认发货”才打款、“驳回”才退款。
 */
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    require_login();
    $st = db()->prepare('SELECT o.*, p.img FROM orders o LEFT JOIN products p ON o.product_id = p.id WHERE o.buyer=? ORDER BY o.created_at DESC');
    $st->execute([$_SESSION['username']]);
    json_out(0, '', $st->fetchAll());
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_login();
    $b = body();
    $pid = intval($b['productId'] ?? 0);
    $pdo = db();

    try {
        $pdo->beginTransaction();

        $p = $pdo->prepare('SELECT * FROM products WHERE id=? AND status=\'on\' FOR UPDATE');
        $p->execute([$pid]);
        $prod = $p->fetch();
        if (!$prod) { $pdo->rollBack(); json_out(1, '商品不存在或已下架'); }

        /* 发布人不可购买自己发布的商品（publisher 存的是昵称，与 $_SESSION['nickname'] 一致） */
        if (($prod['publisher'] ?? '') === ($_SESSION['nickname'] ?? '')) {
            $pdo->rollBack(); json_out(1, '不能购买自己发布的商品');
        }

        $buyer = $pdo->prepare('SELECT id,balance,username FROM users WHERE id=? FOR UPDATE');
        $buyer->execute([$_SESSION['uid']]);
        $buyerRow = $buyer->fetch();
        if (($buyerRow['balance'] ?? 0) < $prod['price']) {
            $pdo->rollBack(); json_out(1, '余额不足，请先充值');
        }

        // 扣买家余额（款项进入平台托管，暂不打给卖家）
        $pdo->prepare('UPDATE users SET balance = balance - ? WHERE id = ?')
            ->execute([$prod['price'], $buyerRow['id']]);

        // 插入订单：pending = 平台托管中（已扣买家款，未打给卖家）
        $ins = $pdo->prepare('INSERT INTO orders (product_id,title,price,publisher,buyer,created_at,status) VALUES (?,?,?,?,?,?,?)');
        $ins->execute([$prod['id'], $prod['title'], $prod['price'], $prod['publisher'], $buyerRow['username'], time(), 'pending']);
        $oid = $pdo->lastInsertId();

        // 商品标记为已售（区别于发布人主动下架：不触发发布保证金退回，由后台统一打款）
        $pdo->prepare('UPDATE products SET status=\'sold\' WHERE id=?')->execute([$pid]);

        $pdo->commit();

        $me = $pdo->prepare('SELECT id,username,nickname,balance FROM users WHERE id=?');
        $me->execute([$_SESSION['uid']]);
        json_out(0, '购买成功，款项已由平台托管', [
            'order' => ['id' => $oid, 'title' => $prod['title'], 'price' => $prod['price'], 'status' => 'pending'],
            'user'  => $me->fetch(),
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        json_out(1, '下单失败：' . $e->getMessage());
    }
}

json_out(1, '未知操作');
