<?php
/**
 * order.php — 订单（担保交易 / 平台托管 / 管理员发布订单）
 *   GET           我的订单（buyer = 当前账号）
 *   POST          购买    {productId, buyerNote?, buyerImg?(base64)}  普通商品购买
 *                  购买    {orderId, buyerNote?, buyerImg?(base64)}   管理员发布订单购买
 *                  两者流程完全一致：扣买家余额 → 款项进入平台托管 → 插入订单(pending) → 等待后台审核
 *                    · 普通商品：商品下架（status=sold）
 *                    · 管理员发布单：发布单标记 sold，由后台"确认发货"打款给管理员 / "驳回"退款
 *                  唯一区别：管理员发布单无需冻结发布保证金（发布时即免押）
 */
require_once __DIR__ . '/config.php';

// 保存 base64 图片到 uploads/（与 products.php 共用逻辑）
function save_image($dataUrl) {
    if (!preg_match('/^data:image\/(\w+);base64,/', $dataUrl, $m)) return '';
    $ext = strtolower($m[1]);
    if (!in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) $ext = 'jpg';
    $bin = base64_decode(substr($dataUrl, strpos($dataUrl, ',') + 1), true);
    if ($bin === false) return '';
    $dir = __DIR__ . '/uploads';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $name = uniqid('o_', true) . '.' . $ext;
    if (file_put_contents($dir . '/' . $name, $bin) === false) return '';
    return 'uploads/' . $name;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    require_login();
    $st = db()->prepare('SELECT o.*, COALESCE(p.img, o.img) AS img FROM orders o LEFT JOIN products p ON o.product_id = p.id WHERE o.buyer=? ORDER BY o.created_at DESC');
    $st->execute([$_SESSION['username']]);
    json_out(0, '', $st->fetchAll());
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_login();
    $b = body();
    $pid = intval($b['productId'] ?? 0);
    $oid = intval($b['orderId'] ?? 0);
    /* 自定义购买金额（仅当发布单开启了 custom_price 且价格 >2000 时有效） */
    $customAmt = isset($b['customAmount']) ? floatval($b['customAmount']) : 0;
    /* 买家备注与图片（选填） */
    $buyerNote = mb_substr(trim($b['buyerNote'] ?? ''), 0, 500);
    $buyerImg  = '';
    if (!empty($b['buyerImg']) && is_string($b['buyerImg'])) {
        $buyerImg = save_image($b['buyerImg']);
    }
    $pdo = db();

    /* ========== 购买管理员发布的订单（orderId）—— 与普通商品一致：款项进平台托管，等待后台审核 ========== */
    if ($oid > 0 && $pid === 0) {
        try {
            $pdo->beginTransaction();

            // 锁定发布单（listing）
            $o = $pdo->prepare('SELECT * FROM orders WHERE id=? AND status=\'available\' FOR UPDATE');
            $o->execute([$oid]);
            $listing = $o->fetch();
            if (!$listing) { $pdo->rollBack(); json_out(1, '该商品不存在或已被购买'); }

            // 计算实际支付金额
            $payPrice = (float)$listing['price'];
            if (!empty($listing['custom_price']) && $payPrice > 2000 && $customAmt > 0) {
                // 自定义金额：允许 0.01 ~ payPrice*2（防止过低或异常）
                $payPrice = min(max($customAmt, 0.01), $payPrice * 2);
            }

            // 检查买家余额
            $buyer = $pdo->prepare('SELECT id,balance,username FROM users WHERE id=? FOR UPDATE');
            $buyer->execute([$_SESSION['uid']]);
            $buyerRow = $buyer->fetch();
            if (!$buyerRow || (float)($buyerRow['balance'] ?? 0) < $payPrice) {
                $pdo->rollBack(); json_out(1, '余额不足，请先充值（需 ¥' . number_format($payPrice, 2) . '）');
            }

            // 扣买家余额，进入平台托管
            $pdo->prepare('UPDATE users SET balance = balance - ? WHERE id = ?')
                ->execute([$payPrice, $buyerRow['id']]);

            // 生成交易订单（pending = 平台托管中）
            $ins = $pdo->prepare('INSERT INTO orders (product_id,pub_order_id,title,price,actual_paid,publisher,buyer,buyer_note,buyer_img,img,custom_price,created_at,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
            $ins->execute([
                0, $oid, $listing['title'], $listing['price'], 0,
                $listing['publisher'], $buyerRow['username'], $buyerNote, $buyerImg, $listing['buyer_img'],
                !empty($listing['custom_price']) ? 1 : 0,
                time(), 'pending'
            ]);
            $newId = $pdo->lastInsertId();

            // 如果用了自定义金额，更新订单的 price 为实际支付额
            if ($payPrice !== (float)$listing['price']) {
                $pdo->prepare('UPDATE orders SET price=? WHERE id=?')->execute([$payPrice, $newId]);
            }

            // 发布单标记为已售
            $pdo->prepare('UPDATE orders SET status=\'sold\' WHERE id=?')->execute([$oid]);

            $pdo->commit();

            $me = $pdo->prepare('SELECT id,username,nickname,balance FROM users WHERE id=?');
            $me->execute([$_SESSION['uid']]);
            json_out(0, '购买成功，款项已由平台托管', [
                'order' => ['id' => $newId, 'title' => $listing['title'], 'price' => $payPrice, 'status' => 'pending'],
                'user'  => $me->fetch(),
            ]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            json_out(1, '下单失败：' . $e->getMessage());
        }
    }

    /* ========== 购买普通商品（productId，原有逻辑）========== */
    if ($pid > 0 && $oid === 0) {

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
        $ins = $pdo->prepare('INSERT INTO orders (product_id,title,price,actual_paid,publisher,buyer,buyer_note,buyer_img,created_at,status) VALUES (?,?,?,?,?,?,?,?,?,?)');
        $ins->execute([$prod['id'], $prod['title'], $prod['price'], 0, $prod['publisher'], $buyerRow['username'], $buyerNote, $buyerImg, time(), 'pending']);
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
    } // end if productId
}

json_out(1, '未知操作');
