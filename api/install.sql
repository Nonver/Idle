-- 闲置微铺 数据库结构（MySQL 5.5 兼容，utf8mb4 / InnoDB）
-- 也可直接访问 api/setup.php 一键建库建表，无需手动执行本文件。

CREATE TABLE IF NOT EXISTS `users` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `username`   VARCHAR(50)  NOT NULL,
  `password`   VARCHAR(255) NOT NULL,
  `nickname`   VARCHAR(50)  NOT NULL DEFAULT '',
  `avatar`     VARCHAR(255) NOT NULL DEFAULT '' COMMENT '头像',
  `balance`    DECIMAL(10,2) NOT NULL DEFAULT 0,
  `is_admin`   TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否管理员',
  `banned`     TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否封禁',
  `created_at` INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `products` (
  `id`          INT          NOT NULL AUTO_INCREMENT,
  `title`       VARCHAR(120) NOT NULL,
  `price`       DECIMAL(10,2) NOT NULL DEFAULT 0,
  `deposit`     DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '押金（可选，随订单金额一起打款给发布人）',
  `publisher`   VARCHAR(50)  NOT NULL,
  `img`         VARCHAR(255) NOT NULL DEFAULT '',
  `description` TEXT,
  `status`      ENUM('on','off') NOT NULL DEFAULT 'on',
  `created_at`  INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_publisher` (`publisher`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `orders` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `product_id` INT          NOT NULL,
  `title`      VARCHAR(120) NOT NULL,
  `price`      DECIMAL(10,2) NOT NULL DEFAULT 0,
  `actual_paid` DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '实际打款金额（后台确认发货时填写，操作不可逆）',
  `publisher`  VARCHAR(50)  NOT NULL,
  `buyer`      VARCHAR(50)  NOT NULL,
  `created_at` INT          NOT NULL DEFAULT 0,
  `status`     VARCHAR(20)  NOT NULL DEFAULT 'paid',
  PRIMARY KEY (`id`),
  KEY `idx_buyer` (`buyer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `pay_configs` (
  `id`          INT          NOT NULL AUTO_INCREMENT,
  `type`        VARCHAR(20)  NOT NULL COMMENT 'recharge=充值账户, withdraw=提现账户',
  `channel`     VARCHAR(20)  NOT NULL DEFAULT 'alipay' COMMENT 'alipay/wechat/bank',
  `account_name` VARCHAR(60) NOT NULL DEFAULT '' COMMENT '账户名称/备注',
  `account_no`  VARCHAR(100) NOT NULL DEFAULT '' COMMENT '账号（支付宝号/微信号/银行卡号）',
  `qrcode`      VARCHAR(255) NOT NULL DEFAULT '' COMMENT '收款码图片路径',
  `sort_order`  INT          NOT NULL DEFAULT 0,
  `status`      TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '0=禁用,1=启用',
  `created_at`  INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `financial_orders` (
  `id`          INT           NOT NULL AUTO_INCREMENT,
  `type`        VARCHAR(20)   NOT NULL COMMENT 'recharge=充值, withdraw=提现',
  `user_id`     INT           NOT NULL COMMENT '申请人用户ID',
  `username`    VARCHAR(50)   NOT NULL DEFAULT '' COMMENT '申请人用户名（冗余，方便列表查询）',
  `amount`      DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '申请金额',
  `actual_amount` DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '实际到账金额（充值通过时由管理员填写）',
  `status`      VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT 'pending=待审核, approved=已通过, rejected=已拒绝',
  `review_note` VARCHAR(200)  NOT NULL DEFAULT '' COMMENT '审核备注',
  `created_at`  INT           NOT NULL DEFAULT 0,
  `reviewed_at` INT           NOT NULL DEFAULT 0 COMMENT '审核时间',
  `reviewer_id` INT           NOT NULL DEFAULT 0 COMMENT '审核人管理员ID',
  `pay_method`  VARCHAR(20)   NOT NULL DEFAULT '' COMMENT '收款方式：alipay=支付宝账号,qrcode=收款码',
  `pay_info`    TEXT          NOT NULL COMMENT '收款信息（JSON: {account, qrcode_base64, remark}）',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type` (`type`),
  KEY `idx_status` (`status`),
  KEY `idx_type_status` (`type`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `banners` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `img`        VARCHAR(255) NOT NULL DEFAULT '' COMMENT '轮播图路径',
  `link`       VARCHAR(255) NOT NULL DEFAULT '' COMMENT '点击跳转链接',
  `title`      VARCHAR(120) NOT NULL DEFAULT '' COMMENT '展示标题（可选）',
  `sort_order` INT          NOT NULL DEFAULT 0 COMMENT '排序，越小越靠前',
  `status`     TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '0=禁用,1=启用',
  `created_at` INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* 系统配置（单行表，id 固定为 1） */
CREATE TABLE IF NOT EXISTS `settings` (
  `id`          TINYINT      NOT NULL DEFAULT 1,
  `site_title`  VARCHAR(80)  NOT NULL DEFAULT '闲置微铺' COMMENT '站点标题',
  `site_icon`   VARCHAR(512) NOT NULL DEFAULT '' COMMENT '站点图标（data:image 或 uploads/ 路径）',
  `contact`     VARCHAR(255) NOT NULL DEFAULT '' COMMENT '客服联系方式',
  `updated_at`  INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `settings` (`id`, `site_title`, `updated_at`) VALUES (1, '闲置微铺', 0)
  ON DUPLICATE KEY UPDATE `id` = 1;

/* ---- 兼容：给已有 financial_orders 表新增收款方式字段 ---- */
ALTER TABLE `financial_orders`
  ADD COLUMN IF NOT EXISTS `pay_method` VARCHAR(20) NOT NULL DEFAULT '' COMMENT '收款方式：alipay=支付宝账号,qrcode=收款码' AFTER `reviewer_id`,
  ADD COLUMN IF NOT EXISTS `pay_info` TEXT NOT NULL COMMENT '收款信息（JSON: {account, qrcode_base64, remark}）' AFTER `pay_method`;

CREATE TABLE IF NOT EXISTS `categories` (
  `id`          INT          NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(50)  NOT NULL COMMENT '分类名称',
  `sort_order`  INT          NOT NULL DEFAULT 0 COMMENT '排序，越小越靠前',
  `created_at`  INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* ---- 兼容：给已有 products 表新增分类外键 ---- */
ALTER TABLE `products`
  ADD COLUMN IF NOT EXISTS `category_id` INT NOT NULL DEFAULT 0 COMMENT '分类ID（0=未分类）' AFTER `status`,
  ADD COLUMN IF NOT EXISTS `deposit` DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '押金（可选，随订单金额一起打款给发布人）' AFTER `price`;

ALTER TABLE `orders`
  ADD COLUMN IF NOT EXISTS `actual_paid` DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '实际打款金额（后台确认发货时填写，操作不可逆）' AFTER `price`;

/* ---- 买家备注与图片（购买时可选填：取件码、代领信息等） ---- */
ALTER TABLE `orders`
  ADD COLUMN `buyer_note` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '买家备注（选填：取件码、代领信息等）' AFTER `actual_paid`,
  ADD COLUMN `buyer_img` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '买家上传图片路径（选填：取件码截图等）' AFTER `buyer_note`;

/* ---- 管理员发布单扩展字段 ---- */
ALTER TABLE `orders`
  ADD COLUMN IF NOT EXISTS `pub_order_id` INT NOT NULL DEFAULT 0 COMMENT '关联的管理员发布单ID（0=非发布单购买）' AFTER `buyer_img`,
  ADD COLUMN IF NOT EXISTS `img` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '商品封面图路径（管理员发布单用）' AFTER `pub_order_id`,
  ADD COLUMN IF NOT EXISTS `custom_price` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否开启自定义价格（0=否,1=是,价格>2000时可自定金额）' AFTER `img`,
  ADD COLUMN IF NOT EXISTS `category_id` INT NOT NULL DEFAULT 0 COMMENT '分类ID（管理员发布单用）' AFTER `custom_price`,
  ADD COLUMN IF NOT EXISTS `description` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '商品描述说明（管理员发布单用）' AFTER `category_id`;
