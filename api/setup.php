<?php
/**
 * setup.php — 一键建库建表（仅初始化时访问一次）
 * 访问方式：浏览器打开  http://你的域名/api/setup.php
 * 成功后删除本文件或限制访问，避免被重复调用/泄露结构。
 */
require_once __DIR__ . '/config.php';

$steps = [];

// 1) 确保数据库存在（先用无库连接创建）
try {
    db();
    $steps[] = '数据库连接成功';
} catch (PDOException $e) {
    try {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';charset=' . DB_CHAR,
            DB_USER, DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
        $pdo->exec('CREATE DATABASE IF NOT EXISTS `' . DB_NAME . '` DEFAULT CHARACTER SET utf8mb4');
        $steps[] = '已创建数据库 `' . DB_NAME . '`';
    } catch (PDOException $e2) {
        json_out(1, '无法连接数据库：' . $e2->getMessage());
    }
}

// 2) 建表 + 增量字段补齐
try {
    $pdo = db();
    $pdo->exec(file_get_contents(__DIR__ . '/install.sql'));
    $steps[] = '数据表 users / products / orders / pay_configs / financial_orders 已就绪';
} catch (PDOException $e) {
    json_out(1, '建表失败：' . $e->getMessage(), $steps);
}

// 2.5) 补充 financial_orders.actual_amount 字段（旧表可能缺少）
try {
    $pdo = db();
    $cols = $pdo->query("SHOW COLUMNS FROM financial_orders LIKE 'actual_amount'")->fetchAll();
    if (empty($cols)) {
        $pdo->exec("ALTER TABLE financial_orders ADD COLUMN `actual_amount` DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '实际到账金额' AFTER `amount`");
        $steps[] = '已补充 financial_orders.actual_amount 字段';
    }
} catch (PDOException $e) {
    $steps[] = 'actual_amount 字段检查跳过：' . $e->getMessage();
}

// 2.6) 补充联合索引（统计查询加速）
try {
    $pdo = db();
    $idxs = $pdo->query("SHOW INDEX FROM financial_orders WHERE Key_name='idx_type_status'")->fetchAll();
    if (empty($idxs)) {
        $pdo->exec("ALTER TABLE financial_orders ADD INDEX idx_type_status (`type`, `status`)");
        $steps[] = '已补充 financial_orders 联合索引 idx_type_status(type,status)';
    }
} catch (PDOException $e) {
    $steps[] = '索引检查跳过：' . $e->getMessage();
}

// 2.7) 补充前端查询索引（首页列表 / 我的商品 / 我的订单 / 登录 加速，数据量大时避免全表扫描）
try {
    $pdo = db();
    $ensures = [
        'products' => [
            'idx_publisher'      => 'ADD INDEX idx_publisher (`publisher`)',
            'idx_status_created' => 'ADD INDEX idx_status_created (`status`, `created_at`)',
        ],
        'orders' => [
            'idx_buyer' => 'ADD INDEX idx_buyer (`buyer`)',
        ],
        'users' => [
            'idx_username' => 'ADD INDEX idx_username (`username`)',
            'idx_nickname' => 'ADD INDEX idx_nickname (`nickname`)',
        ],
    ];
    foreach ($ensures as $tbl => $idxs) {
        foreach ($idxs as $name => $sql) {
            $has = $pdo->query("SHOW INDEX FROM `$tbl` WHERE Key_name='$name'")->fetchAll();
            if (empty($has)) {
                $pdo->exec("ALTER TABLE `$tbl` $sql");
                $steps[] = "已补充索引 $tbl.$name";
            }
        }
    }
} catch (PDOException $e) {
    $steps[] = '前端索引检查跳过：' . $e->getMessage();
}

// 3) 种子管理员（仅当不存在时插入）
try {
    $pdo = db();
    $check = $pdo->prepare('SELECT id FROM users WHERE username="admin" LIMIT 1');
    $check->execute();
    if (!$check->fetch()) {
        $hash = password_hash('admin123', PASSWORD_DEFAULT);
        $time = time();
        $pdo->prepare('INSERT INTO users (username,password,nickname,is_admin,created_at) VALUES(?,?,?,?,?)')
            ->execute(['admin', $hash, '管理员', 1, $time]);
        $steps[] = '已创建种子管理员：admin / admin123';
    } else {
        // 确保 admin 账号有管理员权限
        $pdo->prepare('UPDATE users SET is_admin=1 WHERE username="admin"')->execute();
        $steps[] = '管理员账号已就绪（admin）';
    }
} catch (PDOException $e) {
    $steps[] = '种子管理员创建跳过：' . $e->getMessage();
}

json_out(0, '初始化完成', $steps);
