CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  cuit TEXT,
  email TEXT
);

CREATE TABLE IF NOT EXISTS facturas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT NOT NULL UNIQUE,
  fecha TEXT NOT NULL,          -- YYYY-MM-DD
  año INTEGER NOT NULL,
  cliente_id INTEGER NOT NULL,
  subtotal REAL NOT NULL,
  impuesto REAL NOT NULL,
  total REAL NOT NULL,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  factura_id INTEGER NOT NULL,
  descripcion TEXT NOT NULL,
  cantidad REAL NOT NULL,
  precio_unitario REAL NOT NULL,
  monto REAL NOT NULL,
  FOREIGN KEY (factura_id) REFERENCES facturas(id)
);
