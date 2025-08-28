const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Ruta de la base: en Render usar /data (persistente), local usa facturas.db
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'facturas.db');

// Asegura que exista la carpeta destino (importante si DATABASE_PATH apunta a /data)
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// Inicializa DB y esquema
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // mejor estabilidad y rendimiento

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Funciones de acceso simples y síncronas (MVP)
function crearCliente(nombre, cuit, email) {
  const info = db
    .prepare('INSERT INTO clientes (nombre,cuit,email) VALUES (?,?,?)')
    .run(nombre, cuit, email);
  return info.lastInsertRowid;
}

function getClientes() {
  return db.prepare('SELECT * FROM clientes ORDER BY id DESC').all();
}

function getCliente(id) {
  return db.prepare('SELECT * FROM clientes WHERE id=?').get(id);
}

function crearFactura(data) {
  const stmt = db.prepare(`
    INSERT INTO facturas (numero,fecha,año,cliente_id,subtotal,impuesto,total)
    VALUES (@numero,@fecha,@año,@cliente_id,@subtotal,@impuesto,@total)
  `);
  const info = stmt.run(data);
  return info.lastInsertRowid;
}

function addItem(it) {
  db.prepare(`
    INSERT INTO items (factura_id,descripcion,cantidad,precio_unitario,monto)
    VALUES (@factura_id,@descripcion,@cantidad,@precio_unitario,@monto)
  `).run(it);
}

function getFacturas(q) {
  if (q) {
    return db.prepare(`
      SELECT f.*, c.nombre AS cliente
      FROM facturas f
      JOIN clientes c ON c.id = f.cliente_id
      WHERE f.numero LIKE ? OR c.nombre LIKE ?
      ORDER BY f.id DESC
    `).all(`%${q}%`, `%${q}%`);
  }
  return db.prepare(`
    SELECT f.*, c.nombre AS cliente
    FROM facturas f
    JOIN clientes c ON c.id = f.cliente_id
    ORDER BY f.id DESC
  `).all();
}

function getFactura(id) {
  const f = db.prepare(`
    SELECT f.*, c.nombre AS cliente, c.cuit, c.email
    FROM facturas f
    JOIN clientes c ON c.id = f.cliente_id
    WHERE f.id = ?
  `).get(id);
  if (!f) return null;

  const items = db.prepare('SELECT * FROM items WHERE factura_id = ?').all(id);
  return { ...f, items };
}

function borrarFactura(id) {
  const tx = db.transaction((fid) => {
    db.prepare('DELETE FROM items WHERE factura_id = ?').run(fid);
    db.prepare('DELETE FROM facturas WHERE id = ?').run(fid);
  });
  tx(id);
}

module.exports = {
  crearCliente,
  getClientes,
  getCliente,
  crearFactura,
  addItem,
  getFacturas,
  getFactura,
  borrarFactura,
};
