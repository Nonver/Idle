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
    $st = db()->query('SELECT * FROM products WHERE status=\'on\' ORDER BY created_at DESC');
    json_out(0, '', $st->fetchAll());
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $act = $_GET['act'] ?? '';
    $b = body();

    if ($act === '') { // 发布
        require_login();
        $title = trim($b['title'] ?? '');
        $price = isset($b['price']) ? floatval($b['price']) : 0;
        $desc  = trim($b['desc'] ?? $title);
        if ($title === '') json_out(1, '请填写商品标题');
        if ($price < 0) json_out(1, '价格无效');

        $img = save_image($b['img'] ?? '');
        $ins = db()->prepare('INSERT INTO products (title,price,publisher,img,description,status,created_at) VALUES (?,?,?,?,?,?,?)');
        $ins->execute([$title, $price, $_SESSION['nickname'], $img, $desc, 'on', time()]);
        $id = db()->lastInsertId();
        json_out(0, '发布成功', [
            'id' => $id, 'title' => $title, 'price' => $price,
            'publisher' => $_SESSION['nickname'], 'img' => $img, 'status' => 'on',
        ]);
    }

    if ($act === 'update') { // 上下架
        require_login();
        $id = intval($b['id'] ?? 0);
        $status = $b['status'] === 'on' ? 'on' : 'off';
        $own = db()->prepare('SELECT id FROM products WHERE id=? AND publisher=?');
        $own->execute([$id, $_SESSION['nickname']]);
        if (!$own->fetch()) json_out(1, '无权操作该商品');
        db()->prepare('UPDATE products SET status=? WHERE id=?')->execute([$status, $id]);
        json_out(0, 'ok');
    }

    if ($act === 'delete') { // 删除
        require_login();
        $id = intval($b['id'] ?? 0);
        $own = db()->prepare('SELECT id FROM products WHERE id=? AND publisher=?');
        $own->execute([$id, $_SESSION['nickname']]);
        if (!$own->fetch()) json_out(1, '无权操作该商品');
        db()->prepare('DELETE FROM products WHERE id=?')->execute([$id]);
        json_out(0, '已删除');
    }
}

json_out(1, '未知操作');
