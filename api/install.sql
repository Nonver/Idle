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
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_type` (`type`),
  KEY `idx_status` (`status`),
  KEY `idx_type_status` (`type`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
