<?php
/**
 * products.php — 商品
 *   GET              在售商品列表（首页）
 *   GET  ?mine=1     我的商品（需登录，按发布人=当前昵称）
 *   POST             发布商品   {title, price, img(base64), desc}
 *   POST ?act=update 上下架      {id, status}
 *   POST ?act=delete 删除        {id}
 */
require_once __DIR__ . '/config.php';

// 保存 base64 图片到 uploads/，返回可访问路径（相对站点根）
function save_image($dataUrl) {
    if (!preg_match('/^data:image\/(\w+);base64,/', $dataUrl, $m)) return '';
    $ext = strtolower($m[1]);
    if (!in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) $ext = 'jpg';
    $bin = base64_decode(substr($dataUrl, strpos($dataUrl, ',') + 1), true);
    if ($bin === false) return '';
    $dir = __DIR__ . '/uploads';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $name = uniqid('p_', true) . '.' . $ext;
    if (file_put_contents($dir . '/' . $name, $bin) === false) return '';
    return 'uploads/' . $name;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (isset($_GET['mine'])) {
        require_login();
        $st = db()->prepare('SELECT * FROM products WHERE publisher=? ORDER BY created_at DESC');
        $st->execute([$_SESSION['nickname']]);
        json_out(0, '', $st->fetchAll());
    }
    /* 前端商品列表：支持 limit（首页4个）、kw（搜索）、cat_id（分类筛选） */
    $limit  = min(intval($_GET['limit'] ?? 0), 50) ?: null;   /* 0 = 不限制 */
    $kw     = trim($_GET['kw'] ?? '');
    $catId  = intval($_GET['cat_id'] ?? -1);                   /* -1 = 不限分类 */
    $sql    = "SELECT * FROM products WHERE status='on'";
    $params = [];
    if ($catId >= 0) { $sql .= " AND category_id=?"; $params[] = $catId; }
    if ($kw !== '')      { $sql .= " AND title LIKE ?";     $params[] = '%' . addcslashes($kw, '%_') . '%'; }
    $sql .= " ORDER BY created_at DESC";
    if ($limit) $sql .= " LIMIT " . intval($limit);
    $st = db()->prepare($sql);
    $st->execute($params);
    $products = $st->fetchAll();
    // 标记类型
    foreach ($products as &$p) { $p['_type'] = 'product'; }
    unset($p);

    // 同时返回管理员发布的可购买订单（available），合并到结果中
    $pubSql = "SELECT id AS order_id, title, price, img, publisher, description, buyer_note, status, custom_price, category_id, created_at FROM orders WHERE status='available'";
    $pubParams = [];
    if ($catId >= 0) { $pubSql .= " AND category_id=?"; $pubParams[] = $catId; }
    if ($kw !== '') {
        $pubSql .= " AND title LIKE ?";
        $pubParams[] = '%' . addcslashes($kw, '%_') . '%';
    }
    $pubSql .= " ORDER BY created_at DESC";
    if ($limit) $pubSql .= " LIMIT " . intval($limit);
    $pubSt = db()->prepare($pubSql);
    $pubSt->execute($pubParams);
    $published = $pubSt->fetchAll();
    foreach ($published as &$pp) { $pp['_type'] = 'admin_order'; }
    unset($pp);

    json_out(0, '', array_merge($products, $published));
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $act = $_GET['act'] ?? '';
    $b = body();

    if ($act === '') { // 发布
        require_login();
        $title = trim($b['title'] ?? '');
        $price = isset($b['price']) ? floatval($b['price']) : 0;
        $deposit = isset($b['deposit']) ? floatval($b['deposit']) : 0;
        $catId = isset($b['category_id']) ? intval($b['category_id']) : 0;   /* 分类ID */
        $desc  = trim($b['desc'] ?? $title);
        if ($title === '') json_out(1, '请填写商品标题');
        if ($price < 0) json_out(1, '价格无效');
        if ($deposit < 0) json_out(1, '押金无效');

        $pdo = db();
        try {
            $pdo->beginTransaction();
            // 发布保证金：从发布人余额冻结 price（押金随订单一起打款给发布人）
            if ($price > 0) {
                $bal = $pdo->prepare('SELECT balance FROM users WHERE id=? FOR UPDATE');
                $bal->execute([$_SESSION['uid']]);
                $cur = floatval(($bal->fetch() ?: ['balance' => 0])['balance']);
                if ($cur < $price) {
                    $pdo->rollBack();
                    json_out(1, '余额不足，发布需冻结发布保证金 ¥' . number_format($price, 2) . '，当前余额 ¥' . number_format($cur, 2));
                }
                $pdo->prepare('UPDATE users SET balance = balance - ? WHERE id=?')->execute([$price, $_SESSION['uid']]);
            }
            $img = save_image($b['img'] ?? '');
            $ins = $pdo->prepare('INSERT INTO products (title,price,deposit,publisher,img,description,status,category_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)');
            $ins->execute([$title, $price, $deposit, $_SESSION['nickname'], $img, $desc, 'on', $catId, time()]);
            $id = $pdo->lastInsertId();
            $me = $pdo->prepare('SELECT id,username,nickname,balance FROM users WHERE id=?');
            $me->execute([$_SESSION['uid']]);
            $pdo->commit();
            json_out(0, '发布成功' . ($price > 0 ? '，已冻结发布保证金 ¥' . number_format($price, 2) : ''), [
                'id' => $id, 'title' => $title, 'price' => $price, 'deposit' => $deposit,
                'publisher' => $_SESSION['nickname'], 'img' => $img, 'status' => 'on',
                'category_id' => $catId,
                'user' => $me->fetch(),
            ]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            json_out(1, '发布失败：' . $e->getMessage());
        }
    }

    if ($act === 'update') { // 上下架（仅发布人自己控制保证金冻结/退回）
        require_login();
        $id = intval($b['id'] ?? 0);
        $status = $b['status'] === 'on' ? 'on' : 'off';
        $pdo = db();
        $own = $pdo->prepare('SELECT * FROM products WHERE id=? AND publisher=?');
        $own->execute([$id, $_SESSION['nickname']]);
        $prod = $own->fetch();
        if (!$prod) json_out(1, '无权操作该商品');
        if ($prod['status'] === 'sold') json_out(1, '该商品已售出，不可上下架');
        if ($prod['status'] === $status) json_out(0, '状态未变化');

        try {
            $pdo->beginTransaction();
            if ($status === 'off') {
                // 下架：退回发布保证金
                if ($prod['price'] > 0) {
                    $pdo->prepare('UPDATE users SET balance = balance + ? WHERE id=?')->execute([$prod['price'], $_SESSION['uid']]);
                }
            } else {
                // 重新上架：重新扣取发布保证金
                if ($prod['price'] > 0) {
                    $bal = $pdo->prepare('SELECT balance FROM users WHERE id=? FOR UPDATE');
                    $bal->execute([$_SESSION['uid']]);
                    $cur = floatval(($bal->fetch() ?: ['balance' => 0])['balance']);
                    if ($cur < $prod['price']) {
                        $pdo->rollBack();
                        json_out(1, '余额不足，上架需冻结发布保证金 ¥' . number_format($prod['price'], 2) . '，当前余额 ¥' . number_format($cur, 2));
                    }
                    $pdo->prepare('UPDATE users SET balance = balance - ? WHERE id=?')->execute([$prod['price'], $_SESSION['uid']]);
                }
            }
            $pdo->prepare('UPDATE products SET status=? WHERE id=?')->execute([$status, $id]);
            $me = $pdo->prepare('SELECT id,username,nickname,balance FROM users WHERE id=?');
            $me->execute([$_SESSION['uid']]);
            $pdo->commit();
            json_out(0, $status === 'off' ? '已下架，发布保证金已退回' : '已上架，已冻结发布保证金 ¥' . number_format($prod['price'], 2), [
                'status' => $status, 'user' => $me->fetch(),
            ]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            json_out(1, '操作失败：' . $e->getMessage());
        }
    }

    if ($act === 'delete') { // 删除（若在售则先退回保证金）
        require_login();
        $id = intval($b['id'] ?? 0);
        $pdo = db();
        $own = $pdo->prepare('SELECT * FROM products WHERE id=? AND publisher=?');
        $own->execute([$id, $_SESSION['nickname']]);
        $prod = $own->fetch();
        if (!$prod) json_out(1, '无权操作该商品');
        try {
            $pdo->beginTransaction();
            if ($prod['status'] === 'on' && $prod['price'] > 0) {
                // 在售中被删除：退回发布保证金
                $pdo->prepare('UPDATE users SET balance = balance + ? WHERE id=?')->execute([$prod['price'], $_SESSION['uid']]);
            }
            $pdo->prepare('DELETE FROM products WHERE id=?')->execute([$id]);
            $me = $pdo->prepare('SELECT id,username,nickname,balance FROM users WHERE id=?');
            $me->execute([$_SESSION['uid']]);
            $pdo->commit();
            json_out(0, '已删除', ['user' => $me->fetch()]);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            json_out(1, '删除失败：' . $e->getMessage());
        }
    }
}

json_out(1, '未知操作');
