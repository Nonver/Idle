<?php
/**
 * settings.php — 系统配置（站点标题 / 图标 / 客服联系方式）
 *
 * 公开（前端 / 登录页 / 后台 自动获取）：
 *   GET ?act=get   返回 { site_title, site_icon, contact }
 *
 * 后台管理（需管理员登录）：
 *   GET ?act=admin 返回当前配置（用于编辑表单回填）
 *   POST           更新 { site_title, site_icon(base64 或路径或空), contact }
 */
require_once __DIR__ . '/config.php';

// 保存 base64 图片（与轮播图上传共用逻辑）
function save_image($dataUrl) {
    if (!preg_match('/^data:image\/(\w+);base64,/', $dataUrl, $m)) return '';
    $ext = strtolower($m[1]);
    if (!in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) $ext = 'jpg';
    $bin = base64_decode(substr($dataUrl, strpos($dataUrl, ',') + 1), true);
    if ($bin === false) return '';
    $dir = __DIR__ . '/uploads';
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $name = uniqid('cfg_', true) . '.' . $ext;
    if (file_put_contents($dir . '/' . $name, $bin) === false) return '';
    return 'uploads/' . $name;
}

/* ===== 公开：站点配置（无需登录） ===== */
if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['act'] ?? '') === 'get') {
    $row = db()->query('SELECT site_title, site_icon, contact FROM settings WHERE id=1')->fetch();
    if (!$row) $row = ['site_title' => '闲置微铺', 'site_icon' => '', 'contact' => ''];
    json_out(0, '', $row);
}

/* ===== 以下接口均需管理员登录 ===== */
require_admin();

if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['act'] ?? '') === 'admin') {
    $row = db()->query('SELECT site_title, site_icon, contact FROM settings WHERE id=1')->fetch();
    json_out(0, '', $row ?: new stdClass());
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $b = body();
    $title = isset($b['site_title']) ? trim($b['site_title']) : '';
    $contact = isset($b['contact']) ? trim($b['contact']) : '';
    if ($title === '') $title = '闲置微铺';
    if (mb_strlen($title, 'UTF-8') > 80) $title = mb_substr($title, 0, 80, 'UTF-8');
    if (mb_strlen($contact, 'UTF-8') > 255) $contact = mb_substr($contact, 0, 255, 'UTF-8');

    // 图标处理：data: 上传并转存路径；空串 = 清除；已路径 = 保持；null(未传) = 不修改
    $icon = null;
    if (array_key_exists('site_icon', $b)) {
        $ic = $b['site_icon'];
        if ($ic === '' || $ic === 'REMOVE') {
            $icon = '';
        } elseif (strpos($ic, 'data:image') === 0) {
            $saved = save_image($ic);
            $icon = $saved ?: null;
        } else {
            $icon = $ic;
        }
    }

    if ($icon === null) {
        db()->prepare('UPDATE settings SET site_title=?, contact=?, updated_at=? WHERE id=1')
            ->execute([$title, $contact, time()]);
    } else {
        db()->prepare('UPDATE settings SET site_title=?, site_icon=?, contact=?, updated_at=? WHERE id=1')
            ->execute([$title, $icon, $contact, time()]);
    }
    json_out(0, '已保存');
}

json_out(1, '未知操作');
