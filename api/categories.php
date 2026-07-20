<?php
/**
 * categories.php — 商品分类
 *   GET          分类列表（按排序，前端/后台共用）
 *   POST ?act=add    新增分类  {name, sort_order?}
 *   POST ?act=delete 删除分类  {id}（需管理员）
 */
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $st = db()->query('SELECT * FROM categories ORDER BY sort_order ASC, id ASC');
    json_out(0, '', $st->fetchAll());
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $act = $_GET['act'] ?? '';
    $b = body();

    if ($act === 'add') {
        require_admin();

        $name = trim($b['name'] ?? '');
        if ($name === '') json_out(1, '请填写分类名称');
        if (mb_strlen($name) > 50) json_out(1, '分类名称不能超过50字');
        $sort = intval($b['sort_order'] ?? 0);

        // 检查重名
        $chk = db()->prepare('SELECT id FROM categories WHERE name=?');
        $chk->execute([$name]);
        if ($chk->fetch()) json_out(1, '该分类名称已存在');

        $ins = db()->prepare('INSERT INTO categories (name, sort_order, created_at) VALUES (?,?,?)');
        $ins->execute([$name, $sort, time()]);
        json_out(0, '添加成功', ['id' => db()->lastInsertId(), 'name' => $name, 'sort_order' => $sort]);
    }

    if ($act === 'delete') {
        require_admin();
        $id = intval($b['id'] ?? 0);
        if ($id <= 0) json_out(1, '无效ID');

        // 检查是否有商品使用此分类
        $cnt = db()->prepare('SELECT COUNT(*) FROM products WHERE category_id=?');
        $cnt->execute([$id]);
        if ($cnt->fetchColumn() > 0) json_out(1, '该分类下还有商品，请先移动或删除商品后再删除分类');

        db()->prepare('DELETE FROM categories WHERE id=?')->execute([$id]);
        json_out(0, '已删除');
    }
}

json_out(1, '未知操作');
