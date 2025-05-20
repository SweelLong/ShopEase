module.exports = function({ host, user, port, password }) {
  return {
    host,
    user,
    port,
    password,
    database: 'ShopEase',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };
};