const express = require('express');
const mysql = require('mysql2/promise');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const readline = require('readline');
const dbConfigFactory = require('./db.js');

const app = express();
const upload = multer({ dest: 'public/img/temp/' });

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function prompt(question, defaultValue) {
  return new Promise(resolve => {
    rl.question(`${question}${defaultValue ? `（默认${defaultValue}）` : ''}: `, answer => {
      resolve(answer || defaultValue);
    });
  });
}

(async () => {
  const host = await prompt('请输入数据库主机号', 'localhost');
  const user = await prompt('请输入数据库用户名', 'root');
  const port = parseInt(await prompt('请输入数据库的端口', '3306'), 10);
  const password = await prompt('请输入数据库的密码', '无');

  const dbConfig = dbConfigFactory({ host, user, port, password });
  const pool = mysql.createPool(dbConfig);

  // 注册接口
  app.post('/api/register', async (req, res) => {
    const { lastname, firstname, email, phone, password } = req.body;
    try {
      const connection = await pool.getConnection();
      await connection.execute(
        'INSERT INTO admins (lastname, firstname, email, phone, password) VALUES (?, ?, ?, ?, ?)',
        [lastname, firstname, email, phone, password]
      );
      connection.release();
      res.json({ success: true, message: '注册成功' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '注册失败' });
    }
  });

  // 登录接口
  app.post('/api/login', async (req, res) => {
    const { phone, password, remember } = req.body;
    try {
      const connection = await pool.getConnection();
      const [rows] = await connection.execute(
        'SELECT * FROM admins WHERE phone = ? AND password = ?',
        [phone, password]
      );
      connection.release();
      if (rows.length > 0) {
        res.cookie('phone', phone, { maxAge: 30 * 24 * 60 * 60 * 1000 });
        if (remember) {
          res.cookie('password', password, { maxAge: 30 * 24 * 60 * 60 * 1000 });
        }
        res.json({ success: true, message: '登录成功', user: rows[0] });
      } else {
        res.json({ success: false, message: '手机号或密码错误' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '登录失败' });
    }
  });

  // 获取管理员信息
  app.get('/api/admin', async (req, res) => {
    const phone = req.cookies.phone;
    if (!phone) {
      return res.json({ success: false, message: '未登录' });
    }
    try {
      const connection = await pool.getConnection();
      const [rows] = await connection.execute('SELECT * FROM admins WHERE phone = ?', [phone]);
      connection.release();
      if (rows.length > 0) {
        res.json({ success: true, user: rows[0] });
      } else {
        res.json({ success: false, message: '用户不存在' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '获取信息失败' });
    }
  });

  // 上传头像
  app.post('/api/uploadAvatar', upload.single('avatar'), async (req, res) => {
    const phone = req.cookies.phone;
    if (!phone) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    try {
      const fileExt = path.extname(req.file.originalname);
      const fileName = `avatar_${phone}${fileExt}`;
      const destPath = path.join(__dirname, 'public/img/avatar', fileName);
      
      await fs.rename(req.file.path, destPath);
      
      const connection = await pool.getConnection();
      const [adminRows] = await connection.execute('SELECT email FROM admins WHERE phone = ?', [phone]);
      if (adminRows.length === 0) {
        connection.release();
        return res.status(401).json({ success: false, message: '管理员不存在' });
      }
      const adminEmail = adminRows[0].email;
      
      await connection.execute('UPDATE admins SET avatar = ? WHERE phone = ?', [fileName, phone]);
      
      await connection.execute(
        'INSERT INTO infos (type, action, detail, admin_email) VALUES (?, ?, ?, ?)',
        ['管理员', '更新', '更新了头像', adminEmail]
      );
      
      connection.release();
      res.json({ success: true, avatar: fileName });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '上传失败' });
    }
  });

  // 添加商品
  app.post('/api/addProduct', upload.single('image'), async (req, res) => {
    const phone = req.cookies.phone;
    if (!phone) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    try {
      const { name, info, price, stock } = req.body;
      
      const connection = await pool.getConnection();
      const [adminRows] = await connection.execute('SELECT email FROM admins WHERE phone = ?', [phone]);
      if (adminRows.length === 0) {
        connection.release();
        return res.status(401).json({ success: false, message: '管理员不存在' });
      }
      const adminEmail = adminRows[0].email;
      
      const fileExt = path.extname(req.file.originalname);
      const fileName = `product_${Date.now()}${fileExt}`;
      const destPath = path.join(__dirname, 'public/img/product', fileName);
      await fs.rename(req.file.path, destPath);
      
      await connection.execute(
        'INSERT INTO products (admin_email, name, info, price, stock, image) VALUES (?, ?, ?, ?, ?, ?)',
        [adminEmail, name, info, price, stock, fileName]
      );
      
      await connection.execute(
        'INSERT INTO infos (type, action, detail, admin_email) VALUES (?, ?, ?, ?)',
        ['商品', '添加', `添加了商品: ${name}`, adminEmail]
      );
      
      connection.release();
      res.json({ success: true, message: '添加成功' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '添加失败' });
    }
  });

  // 获取商品列表（按管理员手机号筛选）
  app.get('/api/products', async (req, res) => {
    const adminPhone = req.query.adminPhone;
    let query = 'SELECT p.*, a.shop_name FROM products p JOIN admins a ON p.admin_email = a.email';
    
    if (adminPhone) {
      query += ' WHERE a.phone = ?';
    }
    
    try {
      const [rows] = await pool.execute(query, [adminPhone]);
      res.json({ success: true, products: rows });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '获取商品列表失败' });
    }
  });

  // 获取所有管理员（带商品数量统计）
  app.get('/api/admins', async (req, res) => {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          a.id, 
          a.phone, 
          a.shop_name, 
          a.lastname, 
          a.firstname, 
          (SELECT COUNT(*) FROM products p WHERE p.admin_email = a.email) AS product_count 
        FROM admins a
      `);
      res.json({ success: true, admins: rows });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '获取管理员列表失败' });
    }
  });

  // 更新小店名称
  app.post('/api/updateShopName', async (req, res) => {
    const phone = req.cookies.phone;
    const { shopName } = req.body;
    
    if (!phone) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    
    try {
      const connection = await pool.getConnection();
      const [adminRows] = await connection.execute('SELECT email FROM admins WHERE phone = ?', [phone]);
      if (adminRows.length === 0) {
        connection.release();
        return res.status(401).json({ success: false, message: '管理员不存在' });
      }
      const adminEmail = adminRows[0].email;
      
      await connection.execute('UPDATE admins SET shop_name = ? WHERE phone = ?', [shopName, phone]);
      
      await connection.execute(
        'INSERT INTO infos (type, action, detail, admin_email) VALUES (?, ?, ?, ?)',
        ['管理员', '更新', `更新了小店名称: ${shopName}`, adminEmail]
      );
      
      connection.release();
      res.json({ success: true, message: '小店名称更新成功' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '更新失败' });
    }
  });

  // 获取操作日志
  app.get('/api/infos', async (req, res) => {
    const phone = req.cookies.phone;
    if (!phone) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    
    try {
      const connection = await pool.getConnection();
      // 查询管理员邮箱
      const [adminRows] = await connection.execute('SELECT email FROM admins WHERE phone = ?', [phone]);
      if (adminRows.length === 0) {
        connection.release();
        return res.status(401).json({ success: false, message: '管理员不存在' });
      }
      const adminEmail = adminRows[0].email;
      
      // 查询该管理员的操作日志
      const [rows] = await connection.execute(
        'SELECT * FROM infos WHERE admin_email = ? ORDER BY create_time DESC',
        [adminEmail]
      );
      
      connection.release();
      res.json({ success: true, infos: rows });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '获取日志失败' });
    }
  });

  // 用户注册
  app.post('/api/registerUser', async (req, res) => {
    const { adminPhone, email, password, name, phone } = req.body;
    
    try {
      const connection = await pool.getConnection();
      
      // 查询管理员邮箱
      const [adminRows] = await connection.execute('SELECT email FROM admins WHERE phone = ?', [adminPhone]);
      if (adminRows.length === 0) {
        connection.release();
        return res.status(401).json({ success: false, message: '管理员不存在' });
      }
      const adminEmail = adminRows[0].email;
      
      // 插入用户
      await connection.execute(
        'INSERT INTO users (admin_email, email, password, name, phone) VALUES (?, ?, ?, ?, ?)',
        [adminEmail, email, password, name, phone]
      );
      
      // 记录日志
      await connection.execute(
        'INSERT INTO infos (type, action, detail, admin_email) VALUES (?, ?, ?, ?)',
        ['用户', '注册', `用户${name}(${email})注册成功`, adminEmail]
      );
      
      connection.release();
      res.json({ success: true, message: '用户注册成功' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '注册失败' });
    }
  });

  // 获取用户列表
  app.get('/api/users', async (req, res) => {
    const phone = req.cookies.phone;
    if (!phone) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    
    try {
      const connection = await pool.getConnection();
      
      // 查询管理员邮箱
      const [adminRows] = await connection.execute('SELECT email FROM admins WHERE phone = ?', [phone]);
      if (adminRows.length === 0) {
        connection.release();
        return res.status(401).json({ success: false, message: '管理员不存在' });
      }
      const adminEmail = adminRows[0].email;
      
      // 查询该管理员下的所有用户
      const [rows] = await connection.execute('SELECT * FROM users WHERE admin_email = ?', [adminEmail]);
      
      connection.release();
      res.json({ success: true, users: rows });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '获取用户失败' });
    }
  });

  // 获取订单列表
  app.get('/api/orders', async (req, res) => {
    const phone = req.cookies.phone;
    if (!phone) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    
    try {
      const connection = await pool.getConnection();
      
      // 查询管理员邮箱
      const [adminRows] = await connection.execute('SELECT email FROM admins WHERE phone = ?', [phone]);
      if (adminRows.length === 0) {
        connection.release();
        return res.status(401).json({ success: false, message: '管理员不存在' });
      }
      const adminEmail = adminRows[0].email;
      
      // 查询该管理员下的所有订单，关联用户和商品信息
      const [rows] = await connection.execute(`
        SELECT o.*, u.name AS user_name, p.name AS product_name 
        FROM orders o 
        JOIN users u ON o.user_id = u.id 
        JOIN products p ON o.product_id = p.id 
        WHERE o.admin_email = ?
        ORDER BY o.order_time DESC
      `, [adminEmail]);
      
      connection.release();
      res.json({ success: true, orders: rows });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '获取订单失败' });
    }
  });

  // 更新用户信息
  app.post('/api/updateUser', async (req, res) => {
    const { userId, email, name, phone } = req.body;
    
    try {
      const connection = await pool.getConnection();
      
      // 检查用户是否存在
      const [userRows] = await connection.execute('SELECT * FROM users WHERE id = ?', [userId]);
      if (userRows.length === 0) {
        connection.release();
        return res.status(404).json({ success: false, message: '用户不存在' });
      }
      
      const user = userRows[0];
      
      // 更新用户信息
      await connection.execute(
        'UPDATE users SET email = ?, name = ?, phone = ? WHERE id = ?',
        [email, name, phone, userId]
      );
      
      // 记录日志
      await connection.execute(
        'INSERT INTO infos (type, action, detail, admin_email) VALUES (?, ?, ?, ?)',
        ['用户', '更新', `更新了用户${user.name}(${user.email})的信息`, user.admin_email]
      );
      
      connection.release();
      res.json({ success: true, message: '用户信息更新成功' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '更新失败' });
    }
  });

  // 获取仪表盘数据
  app.get('/api/dashboard', async (req, res) => {
    const phone = req.cookies.phone;
    if (!phone) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    
    try {
      const connection = await pool.getConnection();
      
      // 查询管理员邮箱
      const [adminRows] = await connection.execute('SELECT email FROM admins WHERE phone = ?', [phone]);
      if (adminRows.length === 0) {
        connection.release();
        return res.status(401).json({ success: false, message: '管理员不存在' });
      }
      const adminEmail = adminRows[0].email;
      
      // 查询总销售额
      const [salesRows] = await connection.execute(
        'SELECT SUM(price) as total_sales FROM orders WHERE admin_email = ?',
        [adminEmail]
      );
      const totalSales = salesRows[0].total_sales || 0;
      
      // 查询总订单数
      const [orderCountRows] = await connection.execute(
        'SELECT COUNT(*) as order_count FROM orders WHERE admin_email = ?',
        [adminEmail]
      );
      const orderCount = orderCountRows[0].order_count || 0;
      
      // 查询用户数
      const [userCountRows] = await connection.execute(
        'SELECT COUNT(*) as user_count FROM users WHERE admin_email = ?',
        [adminEmail]
      );
      const userCount = userCountRows[0].user_count || 0;
      
      // 查询库存剩余数
      const [stockRows] = await connection.execute(
        'SELECT SUM(stock) as total_stock FROM products WHERE admin_email = ?',
        [adminEmail]
      );
      const totalStock = stockRows[0].total_stock || 0;
      
      connection.release();
      
      res.json({ 
        success: true, 
        dashboard: {
          totalSales,
          orderCount,
          userCount,
          totalStock
        }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '获取仪表盘数据失败' });
    }
  });

  // 用户登录验证
  app.post('/api/userLogin', async (req, res) => {
    const { adminPhone, email, password } = req.body;
    
    try {
      const connection = await pool.getConnection();
      
      // 查询管理员邮箱
      const [adminRows] = await connection.execute('SELECT email FROM admins WHERE phone = ?', [adminPhone]);
      if (adminRows.length === 0) {
        connection.release();
        return res.status(401).json({ success: false, message: '管理员不存在' });
      }
      const adminEmail = adminRows[0].email;
      
      // 查询用户
      const [userRows] = await connection.execute(
        'SELECT * FROM users WHERE admin_email = ? AND email = ? AND password = ?',
        [adminEmail, email, password]
      );
      
      connection.release();
      
      if (userRows.length > 0) {
        res.json({ success: true, user: userRows[0] });
      } else {
        res.json({ success: false, message: '账号或密码错误' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '登录失败' });
    }
  });

  // 下单购买（包含用户验证和库存扣减）
  app.post('/api/createOrder', async (req, res) => {
    const { adminPhone, email, password, productId } = req.body;
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction(); // 开启事务
      
      // 1. 查询管理员邮箱
      const [adminRows] = await connection.execute(
        'SELECT email FROM admins WHERE phone = ?', 
        [adminPhone]
      );
      if (!adminRows.length) throw new Error('管理员不存在');
      
      // 2. 验证用户身份
      const [userRows] = await connection.execute(
        'SELECT id FROM users WHERE admin_email = ? AND email = ? AND password = ?',
        [adminRows[0].email, email, password]
      );
      if (!userRows.length) throw new Error('用户邮箱或密码错误');
      
      // 3. 检查商品库存
      const [productRows] = await connection.execute(
        'SELECT stock FROM products WHERE id = ?', 
        [productId]
      );
      if (productRows[0].stock <= 0) throw new Error('商品库存不足');
      
      // 4. 创建订单
      await connection.execute(
        'INSERT INTO orders (admin_email, user_id, product_id, price) VALUES (?, ?, ?, (SELECT price FROM products WHERE id = ?))',
        [adminRows[0].email, userRows[0].id, productId, productId]
      );
      
      // 5. 扣减库存
      await connection.execute(
        'UPDATE products SET stock = stock - 1 WHERE id = ?', 
        [productId]
      );
      
      // 6. 记录操作日志
      await connection.execute(
        'INSERT INTO infos (type, action, detail, admin_email) VALUES ("订单", "创建", "用户下单购买商品", ?)',
        [adminRows[0].email]
      );
      
      await connection.commit(); // 提交事务
      res.json({ success: true, message: '订单创建成功' });
      
    } catch (error) {
      await connection.rollback(); // 回滚事务
      res.status(500).json({ success: false, message: error.message || '下单失败' });
    } finally {
      connection.release(); // 释放连接
    }
  });

  // 编辑商品（PUT /api/products/:id）
  app.put('/api/products/:id', upload.single('image'), async (req, res) => {
    const phone = req.cookies.phone;
    const productId = req.params.id;
    
    if (!phone) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    
    try {
      const connection = await pool.getConnection();
      
      // 验证管理员身份
      const [adminRows] = await connection.execute('SELECT email FROM admins WHERE phone = ?', [phone]);
      if (adminRows.length === 0) {
        connection.release();
        return res.status(401).json({ success: false, message: '管理员不存在' });
      }
      const adminEmail = adminRows[0].email;
      
      // 验证商品归属
      const [productRows] = await connection.execute(
        'SELECT * FROM products WHERE id = ? AND admin_email = ?',
        [productId, adminEmail]
      );
      if (productRows.length === 0) {
        connection.release();
        return res.status(404).json({ success: false, message: '商品不存在或无权限' });
      }
      
      const { name, info, price, stock } = req.body;
      const updateFields = [];
      const updateValues = [];
      
      if (name) { updateFields.push('name = ?'); updateValues.push(name); }
      if (info) { updateFields.push('info = ?'); updateValues.push(info); }
      if (price) { updateFields.push('price = ?'); updateValues.push(price); }
      if (stock) { updateFields.push('stock = ?'); updateValues.push(stock); }
      
      // 处理图片更新
      if (req.file) {
        const fileExt = path.extname(req.file.originalname);
        const fileName = `product_${Date.now()}${fileExt}`;
        const destPath = path.join(__dirname, 'public/img/product', fileName);
        await fs.rename(req.file.path, destPath);
        
        updateFields.push('image = ?');
        updateValues.push(fileName);
      }
      
      if (updateFields.length === 0) {
        connection.release();
        return res.json({ success: false, message: '没有需要更新的字段' });
      }
      
      // 构建 SQL
      const updateQuery = `UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`;
      updateValues.push(productId);
      
      await connection.execute(updateQuery, updateValues);
      
      // 记录日志
      await connection.execute(
        'INSERT INTO infos (type, action, detail, admin_email) VALUES (?, ?, ?, ?)',
        ['商品', '更新', `更新了商品: ${name || productRows[0].name}`, adminEmail]
      );
      
      connection.release();
      res.json({ success: true, message: '商品更新成功' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '更新失败' });
    }
  });

  // 删除商品（DELETE /api/products/:id）
  app.delete('/api/products/:id', async (req, res) => {
    const phone = req.cookies.phone;
    const productId = req.params.id;
    
    if (!phone) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    
    try {
      const connection = await pool.getConnection();
      
      // 验证管理员身份
      const [adminRows] = await connection.execute('SELECT email FROM admins WHERE phone = ?', [phone]);
      if (adminRows.length === 0) {
        connection.release();
        return res.status(401).json({ success: false, message: '管理员不存在' });
      }
      const adminEmail = adminRows[0].email;
      
      // 查询商品信息
      const [productRows] = await connection.execute(
        'SELECT name, image FROM products WHERE id = ? AND admin_email = ?',
        [productId, adminEmail]
      );
      
      if (productRows.length === 0) {
        connection.release();
        return res.status(404).json({ success: false, message: '商品不存在或无权限' });
      }
      
      const product = productRows[0];
      
      // 删除商品记录
      await connection.execute('DELETE FROM products WHERE id = ?', [productId]);
      
      // 记录日志
      await connection.execute(
        'INSERT INTO infos (type, action, detail, admin_email) VALUES (?, ?, ?, ?)',
        ['商品', '删除', `删除了商品: ${product.name}`, adminEmail]
      );
      
      // 删除物理文件（可选）
      if (product.image && product.image !== 'default.png') {
        const imagePath = path.join(__dirname, 'public/img/product', product.image);
        await fs.unlink(imagePath).catch(err => console.log('删除图片失败:', err));
      }
      
      connection.release();
      res.json({ success: true, message: '商品删除成功' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '删除失败' });
    }
  });

  // 获取单个商品（GET /api/products/:id）
  app.get('/api/products/:id', async (req, res) => {
    const phone = req.cookies.phone;
    const productId = req.params.id;
    
    if (!phone) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    
    try {
      const connection = await pool.getConnection();
      
      // 验证管理员身份
      const [adminRows] = await connection.execute('SELECT email FROM admins WHERE phone = ?', [phone]);
      if (adminRows.length === 0) {
        connection.release();
        return res.status(401).json({ success: false, message: '管理员不存在' });
      }
      
      // 查询商品
      const [productRows] = await connection.execute(
        'SELECT * FROM products WHERE id = ? AND admin_email = ?',
        [productId, adminRows[0].email]
      );
      
      connection.release();
      
      if (productRows.length === 0) {
        return res.status(404).json({ success: false, message: '商品不存在' });
      }
      
      res.json({ success: true, product: productRows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '获取商品失败' });
    }
  });

  // 获取单个订单（GET /api/orders/:id）
  app.get('/api/orders/:id', async (req, res) => {
    const phone = req.cookies.phone;
    const orderId = req.params.id;
    
    if (!phone) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    
    try {
      const connection = await pool.getConnection();
      
      // 验证管理员身份
      const [adminRows] = await connection.execute('SELECT email FROM admins WHERE phone = ?', [phone]);
      if (adminRows.length === 0) {
        connection.release();
        return res.status(401).json({ success: false, message: '管理员不存在' });
      }
      const adminEmail = adminRows[0].email;
      
      // 查询订单详情
      const [orderRows] = await connection.execute(`
        SELECT o.*, u.name AS user_name, p.name AS product_name 
        FROM orders o 
        JOIN users u ON o.user_id = u.id 
        JOIN products p ON o.product_id = p.id 
        WHERE o.id = ? AND o.admin_email = ?
      `, [orderId, adminEmail]);
      
      connection.release();
      
      if (orderRows.length === 0) {
        return res.status(404).json({ success: false, message: '订单不存在' });
      }
      
      res.json({ success: true, order: orderRows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '获取订单失败' });
    }
  });

  // 更新订单状态（PUT /api/orders/:id）
  app.put('/api/orders/:id', async (req, res) => {
    const phone = req.cookies.phone;
    const orderId = req.params.id;
    const { status } = req.body;
    
    if (!phone || !status) {
      return res.status(400).json({ success: false, message: '缺少参数' });
    }
    
    try {
      const connection = await pool.getConnection();
      
      // 验证管理员身份
      const [adminRows] = await connection.execute('SELECT email FROM admins WHERE phone = ?', [phone]);
      if (adminRows.length === 0) {
        connection.release();
        return res.status(401).json({ success: false, message: '管理员不存在' });
      }
      const adminEmail = adminRows[0].email;
      
      // 查询订单
      const [orderRows] = await connection.execute(
        'SELECT * FROM orders WHERE id = ? AND admin_email = ?',
        [orderId, adminEmail]
      );
      
      if (orderRows.length === 0) {
        connection.release();
        return res.status(404).json({ success: false, message: '订单不存在' });
      }
      
      // 更新订单状态
      await connection.execute(
        'UPDATE orders SET status_info = ?, update_time = NOW() WHERE id = ?',
        [status, orderId]
      );
      
      // 记录日志
      await connection.execute(
        'INSERT INTO infos (type, action, detail, admin_email) VALUES (?, ?, ?, ?)',
        ['订单', '更新状态', `将订单#${orderId}状态更新为: ${status}`, adminEmail]
      );
      
      connection.release();
      res.json({ success: true, message: '订单状态已更新' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '更新失败' });
    }
  });

  // 获取单个用户（GET /api/users/:id）
  app.get('/api/users/:id', async (req, res) => {
    const phone = req.cookies.phone;
    const userId = req.params.id;
    
    if (!phone) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    
    try {
      const connection = await pool.getConnection();
      
      // 验证管理员身份
      const [adminRows] = await connection.execute('SELECT email FROM admins WHERE phone = ?', [phone]);
      if (adminRows.length === 0) {
        connection.release();
        return res.status(401).json({ success: false, message: '管理员不存在' });
      }
      const adminEmail = adminRows[0].email;
      
      // 查询用户
      const [userRows] = await connection.execute(
        'SELECT * FROM users WHERE id = ? AND admin_email = ?',
        [userId, adminEmail]
      );
      
      connection.release();
      
      if (userRows.length === 0) {
        return res.status(404).json({ success: false, message: '用户不存在' });
      }
      
      res.json({ success: true, user: userRows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '获取用户失败' });
    }
  });

  // 删除用户（DELETE /api/users/:id）
  app.delete('/api/users/:id', async (req, res) => {
    const phone = req.cookies.phone;
    const userId = req.params.id;
    
    if (!phone) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    
    try {
      const connection = await pool.getConnection();
      
      // 验证管理员身份
      const [adminRows] = await connection.execute('SELECT email FROM admins WHERE phone = ?', [phone]);
      if (adminRows.length === 0) {
        connection.release();
        return res.status(401).json({ success: false, message: '管理员不存在' });
      }
      const adminEmail = adminRows[0].email;
      
      // 查询用户信息
      const [userRows] = await connection.execute(
        'SELECT name, email FROM users WHERE id = ? AND admin_email = ?',
        [userId, adminEmail]
      );
      
      if (userRows.length === 0) {
        connection.release();
        return res.status(404).json({ success: false, message: '用户不存在或无权限' });
      }
      
      const user = userRows[0];
      
      // 删除用户记录
      await connection.execute('DELETE FROM users WHERE id = ?', [userId]);
      
      // 记录日志
      await connection.execute(
        'INSERT INTO infos (type, action, detail, admin_email) VALUES (?, ?, ?, ?)',
        ['用户', '删除', `删除了用户: ${user.name}(${user.email})`, adminEmail]
      );
      
      connection.release();
      res.json({ success: true, message: '用户删除成功' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '删除失败' });
    }
  });

  // 获取单个日志（GET /api/infos/:id）
  app.get('/api/infos/:id', async (req, res) => {
    const phone = req.cookies.phone;
    const infoId = req.params.id;
    
    if (!phone) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    
    try {
      const connection = await pool.getConnection();
      
      // 验证管理员身份
      const [adminRows] = await connection.execute('SELECT email FROM admins WHERE phone = ?', [phone]);
      if (adminRows.length === 0) {
        connection.release();
        return res.status(401).json({ success: false, message: '管理员不存在' });
      }
      const adminEmail = adminRows[0].email;
      
      // 查询日志
      const [infoRows] = await connection.execute(
        'SELECT * FROM infos WHERE id = ? AND admin_email = ?',
        [infoId, adminEmail]
      );
      
      connection.release();
      
      if (infoRows.length === 0) {
        return res.status(404).json({ success: false, message: '日志不存在' });
      }
      
      res.json({ success: true, info: infoRows[0] });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '获取日志失败' });
    }
  });

  // 获取预设头像列表
  app.get('/api/defaultAvatars', async (req, res) => {
    const phone = req.cookies.phone;
    
    if (!phone) {
      return res.status(401).json({ success: false, message: '未登录' });
    }
    
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const avatarDir = path.join(__dirname, 'public/img/avatar');
      
      // 读取目录下所有以 "default_" 开头的图片文件
      const files = await fs.readdir(avatarDir);
      const defaultAvatars = files.filter(file => 
        file.startsWith('default_') && /\.(png|jpg|jpeg|gif|webp)$/i.test(file)
      );
      
      res.json({ success: true, avatars: defaultAvatars });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '获取预设头像失败' });
    }
  });

  // 设置预设头像
  app.post('/api/setDefaultAvatar', async (req, res) => {
    const phone = req.cookies.phone;
    const { avatar } = req.body;
    
    if (!phone || !avatar) {
      return res.status(400).json({ success: false, message: '参数缺失' });
    }
    
    try {
      const connection = await pool.getConnection();
      
      // 验证管理员身份
      const [adminRows] = await connection.execute('SELECT id, email FROM admins WHERE phone = ?', [phone]);
      if (adminRows.length === 0) {
        connection.release();
        return res.status(401).json({ success: false, message: '管理员不存在' });
      }
      
      const adminId = adminRows[0].id;
      const adminEmail = adminRows[0].email;
      
      // 验证头像是否为预设头像
      const fs = require('fs').promises;
      const path = require('path');
      const avatarDir = path.join(__dirname, 'public/img/avatar');
      const files = await fs.readdir(avatarDir);
      
      if (!files.includes(avatar) || !avatar.startsWith('default_')) {
        connection.release();
        return res.status(400).json({ success: false, message: '无效的预设头像' });
      }
      
      // 更新头像
      await connection.execute(
        'UPDATE admins SET avatar = ? WHERE id = ?',
        [avatar, adminId]
      );
      
      // 记录日志
      await connection.execute(
        'INSERT INTO infos (type, action, detail, admin_email) VALUES (?, ?, ?, ?)',
        ['管理员', '更新头像', '使用预设头像', adminEmail]
      );
      
      connection.release();
      res.json({ success: true, message: '头像更新成功', avatar });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: '更新失败' });
    }
  });

  // 启动服务器
  let PORT = parseInt(await prompt('请输入服务端的端口号', '3000'), 10);
  if (isNaN(PORT) || PORT <= 0 || PORT > 65535) {
    PORT = 3000;
  }
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    rl.close();
  });
})();