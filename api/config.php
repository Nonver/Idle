<?php
/**
 * 闲置微铺（Idle / xzwp）
 *
 * ⚠️ 本项目仅用于学习演示，禁止用于真实资金交易。
 *    使用者二次开发必须遵守中华人民共和国法律法规；
 *    若用于非法运营，作者不承担任何法律责任。
 *    后续公安机关核查时可以佐证你开发时就没有违法意图。
 *
 * config.php — 闲置微铺 后端公共配置
 *
 * 用法：各 api/*.php 顶部 require_once __DIR__ . '/config.php';
 *
 * 前端约定（js/common.js 的 API 对象即按此对接，同域 fetch）：
 *   统一返回 JSON：{"code":0,"msg":"","data":{...}}   （code!=0 表示失败）
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

// 会话存储路径兜底：优先用项目内可写目录，避免主机未配置 save_path 时报错
$sp = __DIR__ . '/sessions';
if (!is_dir($sp)) @mkdir($sp, 0755, true);
if (is_writable($sp)) session_save_path($sp);

session_start();

/* ---- 性能优化：立即释放 session 文件锁 ----
 * 默认 session_start() 会持有文件排他锁直到脚本结束。
 * 后台页面并发请求多个 API 时会互相阻塞排队（一个请求做 DB 查询时
 * 其他请求全在等 session 锁），导致本地接口也要 2 秒+。
 *
 * 解决：读取完需要的 session 变量后立刻关闭 session 写入，
 * 后续 DB 查询等耗时操作不再持有锁，并发请求互不阻塞。
 * 注意：关闭后不能再写 $_SESSION（大多数 API 接口不需要写 session）。
 */
$session_uid     = $_SESSION['uid'] ?? null;
$session_admin_id   = $_SESSION['admin_id'] ?? null;
$session_admin_name = $_SESSION['admin_name'] ?? null;
$session_username   = $_SESSION['username'] ?? null;
$session_nickname   = $_SESSION['nickname'] ?? null;
session_write_close();

// ---- 数据库连接配置（按需修改，已填入提供的账号）----
// ⚠️ 主机 / 库名若与实际情况不同，请在此修改；用户名密码已按提供填写。
define('DB_HOST', '127.0.0.1');     // 用 IP 避免 localhost DNS 解析延迟（Windows 上 localhost 可能慢 500ms+）
define('DB_NAME', 'uuuustd');        // 数据库名（与账号同名）
define('DB_USER', 'uuuustd');
define('DB_PASS', 'x2k4NFCAwwRXaLnt');
define('DB_CHAR', 'utf8mb4');

function db(): PDO {
    static $pdo;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHAR,
            DB_USER, DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );
    }
    return $pdo;
}

// 统一 JSON 输出
function json_out($code, $msg = '', $data = null) {
    echo json_encode(['code' => $code, 'msg' => $msg, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

// 读取 JSON 请求体
function body(): array {
    $raw = file_get_contents('php://input');
    $d = json_decode($raw, true);
    return is_array($d) ? $d : [];
}

// 需要登录：未登录直接返回 401 并结束
function require_login() {
    global $session_uid;
    if ($session_uid === null) {
        // 临时诊断：记录请求上下文，便于排查 401
        $dbg = '[' . date('Y-m-d H:i:s') . '] 401 require_login' . PHP_EOL
            . '  METHOD=' . ($_SERVER['REQUEST_METHOD'] ?? '') . PHP_EOL
            . '  URI=' . ($_SERVER['REQUEST_URI'] ?? '') . PHP_EOL
            . '  ORIGIN=' . ($_SERVER['HTTP_ORIGIN'] ?? '(none)') . PHP_EOL
            . '  COOKIE_has_PHPSESSID=' . (isset($_COOKIE[session_name()]) ? 'YES' : 'NO') . PHP_EOL
            . '  PHPSESSID=' . ($_COOKIE[session_name()] ?? '(empty)') . PHP_EOL
            . '  session_uid=' . var_export($session_uid, true) . PHP_EOL
            . '  session_save_path=' . session_save_path() . PHP_EOL;
        @file_put_contents(__DIR__ . '/login_debug.log', $dbg, FILE_APPEND);
        json_out(401, '请先登录');
    }
    return $session_uid;
}

// 需要后台管理员权限：未登录返回 401
function require_admin() {
    global $session_admin_id;
    if ($session_admin_id === null) json_out(401, '请先登录后台');
    return $session_admin_id;
}

// 当前登录用户基础信息
function current_user() {
    global $session_uid, $session_username, $session_nickname;
    return [
        'id'       => $session_uid,
        'username' => $session_username,
        'nickname' => $session_nickname,
    ];
}

// 重新打开 session（仅登录/退出等需要写入 $_SESSION 的操作使用）
function session_reopen() {
    @session_start();
}
