import mysql from 'mysql2/promise';

async function checkAudit() {
  const conn = await mysql.createConnection('mysql://phanbon_user:phanbon_secret@localhost:3307/order_db');
  const [rows] = await conn.execute('SELECT action, entityType, entityId, actorRole, createdAt FROM audit_logs ORDER BY createdAt DESC LIMIT 10');
  console.log('Order DB Audit Logs:');
  console.table(rows);
  await conn.end();

  const prodConn = await mysql.createConnection('mysql://phanbon_user:phanbon_secret@localhost:3307/product_db');
  const [prodRows] = await prodConn.execute('SELECT action, entityType, entityId, actorRole, createdAt FROM audit_logs ORDER BY createdAt DESC LIMIT 10');
  console.log('Product DB Audit Logs:');
  console.table(prodRows);
  await prodConn.end();

  const invConn = await mysql.createConnection('mysql://phanbon_user:phanbon_secret@localhost:3307/inventory_db');
  const [invRows] = await invConn.execute('SELECT action, entityType, entityId, actorRole, createdAt FROM audit_logs ORDER BY createdAt DESC LIMIT 10');
  console.log('Inventory DB Audit Logs:');
  console.table(invRows);
  await invConn.end();
}

checkAudit().catch(console.error);
