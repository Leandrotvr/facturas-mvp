const express = require('express');
const path = require('path');
const Joi = require('joi');
const dayjs = require('dayjs');
const PDFDocument = require('pdfkit');
const {
  crearCliente, getClientes, getCliente,
  crearFactura, addItem, getFacturas, getFactura, borrarFactura
} = require('./db');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Validación de factura (simple y suficiente)
const facturaSchema = Joi.object({
  numero: Joi.string().trim().min(1).required(),
  fecha: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  año: Joi.number().integer().min(2000).max(2100).required(),
  cliente_id: Joi.number().integer().required(),
  items: Joi.array().items(Joi.object({
    descripcion: Joi.string().trim().min(1).required(),
    cantidad: Joi.number().positive().required(),
    precio_unitario: Joi.number().positive().required()
  })).min(1).required(),
  impuesto_porcentaje: Joi.number().min(0).max(100).required()
});

// Home: listado + búsqueda
app.get('/', (req, res) => {
  const q = req.query.q || '';
  const facturas = getFacturas(q);
  res.render('index', { facturas, q });
});

// Form nueva factura
app.get('/facturas/nueva', (req, res) => {
  const clientes = getClientes();
  res.render('form', { clientes, errores: null, datos: null });
});

// Crear factura
app.post('/facturas', (req, res) => {
  try {
    const { numero, fecha, año, cliente_id, imp, desc = [], cant = [], precio = [] } = req.body;

    const items = [].concat(desc).map((d, i) => ({
      descripcion: d,
      cantidad: Number([].concat(cant)[i]),
      precio_unitario: Number([].concat(precio)[i])
    })).filter(x => x.descripcion);

    const data = {
      numero, fecha, año: Number(año), cliente_id: Number(cliente_id),
      items, impuesto_porcentaje: Number(imp ?? 21)
    };

    const { error, value } = facturaSchema.validate(data, { abortEarly: false });
    if (error) {
      const clientes = getClientes();
      return res.status(400).render('form', {
        clientes,
        errores: error.details.map(e => e.message),
        datos: data
      });
    }

    const subtotal = value.items.reduce((a, it) => a + it.cantidad * it.precio_unitario, 0);
    const impuesto = +(subtotal * (value.impuesto_porcentaje / 100)).toFixed(2);
    const total = +(subtotal + impuesto).toFixed(2);

    const facturaId = crearFactura({
      numero: value.numero,
      fecha: value.fecha,
      año: value.año,
      cliente_id: value.cliente_id,
      subtotal, impuesto, total
    });

    value.items.forEach(it => addItem({
      factura_id: facturaId,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario,
      monto: +(it.cantidad * it.precio_unitario).toFixed(2)
    }));

    res.redirect(`/facturas/${facturaId}`);
  } catch (e) {
    res.status(500).send('Error al crear la factura: ' + e.message);
  }
});

// Ver factura
app.get('/facturas/:id', (req, res) => {
  const f = getFactura(req.params.id);
  if (!f) return res.status(404).send('No existe');
  res.render('show', { f, dayjs });
});

// Descargar PDF
app.get('/facturas/:id/pdf', (req, res) => {
  const f = getFactura(req.params.id);
  if (!f) return res.status(404).send('No existe');
  res.setHeader('Content-Disposition', `attachment; filename=factura_${f.numero}.pdf`);
  res.setHeader('Content-Type', 'application/pdf');
  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);

  doc.fontSize(18).text(`Factura ${f.numero}`, { align: 'right' });
  doc.moveDown()
    .fontSize(12).text(`Fecha: ${dayjs(f.fecha).format('DD/MM/YYYY')}`)
    .text(`Año: ${f.año}`)
    .text(`Cliente: ${f.cliente}  CUIT: ${f.cuit ?? '-'}`)
    .text(`Email: ${f.email ?? '-'}`);
  doc.moveDown().text('Items:');
  f.items.forEach(it => {
    doc.text(`- ${it.descripcion} | ${it.cantidad} x ${it.precio_unitario} = ${it.monto}`);
  });
  doc.moveDown()
    .text(`Subtotal: ${f.subtotal}`)
    .text(`Impuesto: ${f.impuesto}`)
    .text(`TOTAL: ${f.total}`, { underline: true });
  doc.end();
});

// Borrar factura
app.post('/facturas/:id/borrar', (req, res) => {
  borrarFactura(req.params.id);
  res.redirect('/');
});

// Alta de cliente (pantalla simple)
app.get('/clientes/nuevo', (req, res) => {
  res.render('cliente_form', { errores: null, datos: null });
});

app.post('/clientes', (req, res) => {
  const nombre = (req.body.nombre || '').trim();
  if (!nombre) return res.status(400).render('cliente_form', { errores: ['Nombre requerido'], datos: req.body });
  crearCliente(nombre, req.body.cuit || null, req.body.email || null);
  res.redirect('/facturas/nueva');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Abri: http://localhost:' + PORT));
