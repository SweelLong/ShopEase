# ShopEase - 基于Node.js的商城管理系统
> 轻量级电商管理解决方案，前后端分离架构，支持商品管理、订单处理及数据可视化分析
> ---
> 大一计科蒟蒻的数据库期末课设的设计与实现

## 项目信息
- **项目名称**：ShopEase
- **团队成员**：SweelLong
- **完成日期**：2025年5月20日  


## 摘要
ShopEase 是基于 **Node.js** 开发的轻量级商城管理系统，面向中小型电商场景，提供商品管理、订单处理、用户数据统计及可视化分析等核心功能。系统采用**前后端分离架构**：  
- **前端**：基于 HTML/CSS/JavaScript，集成 Tailwind CSS（响应式布局）、Font Awesome（图标库）、Live2D Cubism 2（动态交互角色）。  
- **后端**：基于 Node.js + Express 框架，使用 MySQL 数据库存储数据，通过 RESTful API 实现前后端交互。  

**核心优势**：轻量化部署、响应式设计、动态交互体验、高效数据管理。  


## 技术选型
### 前端技术栈
- **基础技术**：HTML/CSS/JavaScript  
- **响应式布局**：Tailwind CSS（CDN引入，支持移动端/桌面端适配）  
- **图标库**：Font Awesome（丰富图标组件）  
- **动态交互**：Live2D Cubism 2（角色动态渲染，支持触摸反馈、眼球跟踪）  

### 后端技术栈
- **运行环境**：Node.js  
- **框架**：Express（RESTful API 构建）  
- **数据库**：MySQL（用户/商品/订单数据存储）  
- **核心文件**：`app.js`（服务入口）、`db.js`（数据库连接）  


## 核心模块设计
### 前端交互模块
1. **首页（index.html）**  
   - 布局：导航栏 + 主内容区 + Live2D角色区域  
   - 技术亮点：Tailwind CSS 渐变背景、卡片阴影；Live2D 角色 idle/触摸反馈动作  

2. **管理后台（admin.html）**  
   - 仪表盘：实时显示销售额、订单数、库存等数据（通过 `/api/infos` 接口获取）  
   - 操作日志：异步加载日志列表，支持操作追溯  


### 后端业务模块
1. **用户管理**  
   - 功能：登录/注册/编辑，基于角色的权限控制  
   - 安全：数据库密码验证，访问权限隔离  

2. **商品管理**  
   - 功能：增删改查，图片上传，库存/价格管理  
   - 技术：Express 路由处理，MySQL 数据持久化  

3. **订单与数据统计**  
   - 订单处理：创建/查询/状态更新，物流跟踪  
   - 数据统计：销售额趋势、热门商品分析（接口驱动）  
   - 日志记录：操作类型、时间戳全量记录  



## 数据库表结构
### 管理员表（admins）
| 字段         | 类型              | 空   | 注释                     |
|--------------|-------------------|------|--------------------------|
| id           | int(11)           | 否   | 管理员编号（主键，自增） |
| lastname     | varchar(50)       | 否   | 姓氏                     |
| firstname    | varchar(50)       | 否   | 名字                     |
| email        | varchar(100)      | 否   | 邮箱（唯一键）           |
| phone        | varchar(20)       | 否   | 电话号码（唯一键）       |
| password     | varchar(100)      | 否   | 密码                     |
| avatar       | varchar(100)      | 是   | 头像（默认值：default.png） |
| shop_name    | varchar(100)      | 是   | 店名                     |

### 产品表（products）
| 字段         | 类型                | 空   | 注释                     |
|--------------|---------------------|------|--------------------------|
| id           | int(11)             | 否   | 产品编号（主键，自增）   |
| admin_email  | varchar(100)        | 否   | 管理员邮箱（外键）       |
| name         | varchar(100)        | 否   | 产品名称                 |
| info         | text                | 是   | 产品详情                 |
| price        | decimal(10,2)       | 否   | 价格（精确到分）         |
| stock        | int(11)             | 否   | 库存数量                 |
| image        | varchar(100)        | 否   | 产品图片路径             |

### 用户表（users）
| 字段         | 类型                | 空   | 注释                     |
|--------------|---------------------|------|--------------------------|
| id           | int(11)             | 否   | 用户ID（主键，自增）     |
| admin_email  | varchar(100)        | 否   | 管理员邮箱（外键）       |
| email        | varchar(100)        | 否   | 用户邮箱                 |
| password     | varchar(100)        | 否   | 密码                     |
| name         | varchar(100)        | 否   | 用户姓名                 |
| phone        | varchar(20)         | 否   | 电话号码                 |

### 订单表（orders）
| 字段         | 类型                | 空   | 注释                     |
|--------------|---------------------|------|--------------------------|
| id           | int(11)             | 否   | 订单编号（主键，自增）   |
| admin_email  | varchar(100)        | 否   | 管理员邮箱（外键）       |
| user_id      | int(11)             | 否   | 用户ID（外键）           |
| product_id   | int(11)             | 否   | 产品ID（外键）           |
| price        | decimal(10,2)       | 否   | 订单金额（精确到分）     |
| order_time   | timestamp           | 否   | 下单时间（默认当前时间） |
| update_time  | timestamp           | 否   | 更新时间（默认当前时间） |
| status_info  | varchar(20)         | 否   | 订单状态（默认：已下单） |

### 信息表（infos）
| 字段         | 类型                | 空   | 注释                     |
|--------------|---------------------|------|--------------------------|
| id           | int(11)             | 否   | 日志编号（主键，自增）   |
| type         | varchar(50)         | 否   | 操作类型                 |
| action       | varchar(50)         | 否   | 操作行为                 |
| detail       | text                | 是   | 操作详情                 |
| admin_email  | varchar(100)        | 否   | 管理员邮箱（外键）       |
| create_time  | timestamp           | 否   | 记录时间（默认当前时间） |


## 交互与视觉设计
1. **响应式布局**  
   - Tailwind CSS 类实现动态布局切换：  
     - 移动端：`grid-cols-1`（单列）  【未完善】（可能会有意料之外的问题）
     - 桌面端：`md:grid-cols-2` / `lg:grid-cols-4`（多列）  

2. **动态反馈**  
   - 按钮悬停动画：`transform: translateY(-2px)`  
   - 加载提示：表单提交/数据加载时显示状态反馈  

3. **Live2D 角色互动**  
   - 动作库：Idle、Touch Dere、WakeUp 等  
   - 交互逻辑：点击屏幕触发角色动作，参数通过 `.mtn` 文件控制  

## 效果展示 
![BE7B32912C0123675CA48F770739E825](https://github.com/user-attachments/assets/92ec7a35-f9be-4a5b-92d1-8e4afe39a5ac)
![91813516251A5071A0F2D4074949D2BF](https://github.com/user-attachments/assets/f990601c-a896-42eb-8c6d-83da94c99c4c)
![01025DD038BF49EDFAE2DC5CDC031937](https://github.com/user-attachments/assets/6ea3a166-2a55-4151-a859-81f5892c50e9)
![D90EC01866E0125ED563481CA4F9EBB2](https://github.com/user-attachments/assets/cd270009-72fe-4d4e-888a-5589aa8ce958)
![68347BC294BA7237D11FD7EF614DD9D7](https://github.com/user-attachments/assets/5a1c5696-f506-4346-84b3-db69120971a4)
![FD4AEA339B6FFF0DF98EEC4FBFA34D4D](https://github.com/user-attachments/assets/2bc317da-9934-4c3e-8942-7d421715b699)
![1DCFD15A3F6C6613502BDB218616C3EC](https://github.com/user-attachments/assets/946b526f-1bc0-4ac1-9b7b-9b42ef444082)
![ACE5D2B4B610BC3B167BA9AE782FA33D](https://github.com/user-attachments/assets/8590efe6-aa8e-4ffb-815b-a1a89dd6ed7a)
![C7B70C1135512AE7743A6839673CB459](https://github.com/user-attachments/assets/b423a16c-1aa9-4b6b-8fd5-e652f27a4d0d)
![2973E293974726E4D74611F30F0553ED](https://github.com/user-attachments/assets/14b478d6-b506-4bc2-bb2e-bcfc45c23ea6)
![715BA2913C8BD5CF8EBC2139C4C85A99](https://github.com/user-attachments/assets/1dc31b97-937e-4768-a54d-3990e1244b9a)
![2AE24B39B12D0A3079A907A144B991E4](https://github.com/user-attachments/assets/99fc56e8-f8e8-4426-9497-26aca880bb1c)
![4649D6C1A0A97641B321A219B31DC0C6](https://github.com/user-attachments/assets/ab665523-f1b6-48c4-8ddb-4932c2660c3a)
![EF9C2EC0054D3329CF7E7BFCBD160FA6](https://github.com/user-attachments/assets/b021bb60-dba0-4a44-b7a1-988d2774ee21)


## 部署指南
1. **环境要求**  
   - Node.js ≥ 14.x  
   - MySQL ≥ 8.0  
   - 服务器系统：Ubuntu/CentOS/Windows Server  

2. **步骤**  
   ```bash
   # 1. 克隆项目
   git clone https://github.com/SweelLong/ShopEase.git

   # 2. 安装依赖
   cd ShopEase
   npm install express mysql2 multer cookie-parser body-parser

   # 3. 初始化数据库
   mysql -u root -p < db.sql  # 执行数据库脚本

   # 4. 配置数据库连接（修改 db.js 中的账号密码）
   const mysql = require('mysql2');
   const connection = mysql.createConnection({
     host: 'localhost',
     user: 'your_username',
     password: 'your_password',
     database: 'shopease_db'
   });

   # 5. 启动服务
   node app.js
