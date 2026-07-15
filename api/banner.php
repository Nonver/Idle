<?php
/**
 * banner.php — 首页轮播图
 *
 * 公开（前端获取）：
 *   GET ?act=list   返回启用中的轮播图（status=1），按 sort_order 升序、id 降序
 *
 * 后台管理（需管理员登录）：
 *   GET ?act=admin           返回全部（含禁用）
 *   POST                     新增 { img(base64), link, title, sort_order }
 *   GET ?act=delete&id=      删除
 *   GET ?act=toggle&id=       启用 / 禁用 切换
 */
require_once __DIR__ . '/config.php';

// 保存 base64 图片（与商品上传共用逻辑）
function save_image($dataUrl) {
    if (!preg_match('/^data:image\/(\w+);base64,/', $dataUrl, $m)) return '';
    $ext = strtolower($m[1]);
    if (!in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) $ext = 'jpg';
    $bin = base64_decode(substr($dataUrl, strpos($dataUrl, ',') + 1), true);
    if ($bin === false) return '';
    $dir = __DIR__ . '/uploads';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $name = uniqid('b_', true) . '.' . $ext;
    if (file_put_contents($dir . '/' . $name, $bin) === false) return '';
    return 'uploads/' . $name;
}

/* ===== 公开：前端轮播列表（无需登录） ===== */
if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['act'] ?? '') === 'list') {
    $st = db()->query("SELECT id,img,link,title FROM banners WHERE status=1 ORDER BY sort_order ASC, id DESC");
    json_out(0, '', $st->fetchAll());
}

/* ===== 以下接口均需管理员登录 ===== */
require_admin();

/* 后台：列表 / 删除 / 切换 */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $act = $_GET['act'] ?? '';
    if ($act === 'admin') {
        $st = db()->query('SELECT * FROM banners ORDER BY sort_order ASC, id DESC');
        json_out(0, '', $st->fetchAll());
    }
    $op = $_GET['op'] ?? '';
    $id = intval($_GET['id'] ?? 0);

    if ($op === 'delete') {
        db()->prepare('DELETE FROM banners WHERE id=?')->execute([$id]);
        json_out(0, '已删除');
    }
    if ($op === 'toggle') {
        $cur = db()->prepare('SELECT status FROM banners WHERE id=?');
        $cur->execute([$id]);
        $r = $cur->fetch();
        $new = ($r && $r['status'] == 1) ? 0 : 1;
        db()->prepare('UPDATE banners SET status=? WHERE id=?')->execute([$new, $id]);
        json_out(0, $new ? '已启用' : '已禁用', ['status' => $new]);
    }
    json_out(1, '未知操作');
}

/* 后台：新增 */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $b = body();
    $img = save_image($b['img'] ?? '');
    if (!$img) json_out(1, '图片上传失败，请选择图片');
    $link  = trim($b['link'] ?? '');
    $title = trim($b['title'] ?? '');
    $sort  = isset($b['sort_order']) ? intval($b['sort_order']) : 0;
    if (strlen($link) > 255)  $link = substr($link, 0, 255);
    if (strlen($title) > 120) $title = substr($title, 0, 120);
    db()->prepare('INSERT INTO banners (img,link,title,sort_order,status,created_at) VALUES (?,?,?,?,1,?)')
        ->execute([$img, $link, $title, $sort, time()]);
    json_out(0, '已添加轮播图');
}

json_out(1, '未知操作');
