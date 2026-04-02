document.getElementById('fecha').valueAsDate = new Date();

const PRODUCTOS = [
  'Hígado','Corazón','Lengua','Riñón','Sesos',
  'Chinchulin','Tripas rueda','Molleja','Rabo',
  'C. de entraña','Quijada','Mondongo','Carne chica','Otros'
];

const formatMoney = (n) => '$ ' + n.toLocaleString('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const tbody       = document.getElementById('tbody');
const preciosBody = document.getElementById('precios-body');
const stockBody   = document.getElementById('stock-body');

const STORAGE_PRECIOS_KEY  = 'lara_menudencias_precios';
const STORAGE_BOLETAS_KEY  = 'lara_menudencias_boletas';
const STORAGE_COMPRAS_KEY  = 'lara_menudencias_compras';

const PRECIOS = {};
PRODUCTOS.forEach((nombre) => { PRECIOS[nombre] = 0; });

let EDITANDO_ID = null;

/*
  SALDO_MANUAL_FLAG
  ─────────────────
  Tracks whether the user has manually modified saldo-ant
  AFTER the auto-fill happened. If true, we do NOT re-fill
  on subsequent changes to cliente.
  Resets on limpiarForm() and on cargarBoleta().
*/
let SALDO_MANUAL = false;

if (PRECIOS['Hígado'] !== undefined) PRECIOS['Hígado'] = 2000;
if (PRECIOS['Riñón']  !== undefined) PRECIOS['Riñón']  = 1800;

cargarPrecios();

/* ─── PRECIOS ─────────────────────────────────────────────── */

function cargarPrecios() {
  try {
    const stored = localStorage.getItem(STORAGE_PRECIOS_KEY);
    if (!stored) return;
    const parsed = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) return;
    PRODUCTOS.forEach((nombre) => {
      if (parsed[nombre] !== undefined && !isNaN(parseFloat(parsed[nombre]))) {
        PRECIOS[nombre] = Number(parsed[nombre]);
      }
    });
  } catch (error) {
    console.warn('No se pudo cargar precios guardados:', error);
  }
}

function guardarPrecios() {
  const btn = document.querySelector('#config-productos .btn-primary');
  btn.textContent = 'Guardando...';
  try {
    localStorage.setItem(STORAGE_PRECIOS_KEY, JSON.stringify(PRECIOS));
  } catch (error) {
    console.warn('No se pudo guardar precios:', error);
  }
  setTimeout(() => {
    btn.textContent = '✔ Guardado';
    btn.style.background = '#5DCAA5';
    setTimeout(() => {
      btn.textContent = 'Guardar precios';
      btn.style.background = '';
    }, 2000);
  }, 800);
}

/* ─── PRICE ARCHITECTURE ──────────────────────────────────── */

function getPrecioProducto(nombre, cliente) {
  // Hook point for future per-client pricing
  return PRECIOS[nombre] || 0;
}

/* ─── BOLETAS STORAGE ─────────────────────────────────────── */

function obtenerBoletas() {
  try {
    const raw = localStorage.getItem(STORAGE_BOLETAS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map(b => ({ ...b, id: String(b.id) }))
      : [];
  } catch {
    return [];
  }
}

function guardarBoletas(boletas) {
  localStorage.setItem(STORAGE_BOLETAS_KEY, JSON.stringify(boletas));
}

/* ─── SALDO ANTERIOR ──────────────────────────────────────── */

/*
  calcularSaldoCliente(cliente)
  ─────────────────────────────
  Sums "debe" across ALL boletas for a given cliente.
  This is a derived read — never written to storage.
*/
function calcularSaldoCliente(cliente) {
  return obtenerBoletas()
    .filter(b => b.cliente === cliente)
    .reduce((acc, b) => acc + (b.debe || 0), 0);
}

/*
  autoFillSaldoAnterior(cliente)
  ──────────────────────────────
  Called when cliente field changes.
  Conditions to apply:
    1. Must be in CREATE mode (EDITANDO_ID === null)
    2. User has NOT manually overridden saldo-ant (SALDO_MANUAL === false)
*/
function autoFillSaldoAnterior(cliente) {
  if (EDITANDO_ID !== null) return;
  if (SALDO_MANUAL) return;
  if (!cliente) return;

  const saldo = calcularSaldoCliente(cliente);
  document.getElementById('saldo-ant').value = saldo.toFixed(2);
  calcTotales();
}

/* ─── ID GENERATION ───────────────────────────────────────── */

function sanitizarCliente(nombre) {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '');
}

function generarIdBoleta(fecha, locacion, cliente) {
  const base    = `${fecha}_${locacion}_${sanitizarCliente(cliente)}`;
  const boletas = obtenerBoletas();
  const ids     = new Set(boletas.map(b => b.id));

  if (!ids.has(base)) return base;

  let sufijo = 1;
  while (ids.has(`${base}_${sufijo}`)) sufijo++;
  return `${base}_${sufijo}`;
}

/* ─── BUILD ROWS ──────────────────────────────────────────── */

PRODUCTOS.forEach((nombre, i) => {

  /* Boleta row */
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="number" min="0" step="1"   placeholder="0"   class="cant" id="cant-${i}" oninput="calcFila(${i})"></td>
    <td class="prod-name">${nombre}</td>
    <td><input type="number" min="0" step="any" placeholder="0.0" id="kg-${i}"  oninput="calcFila(${i})"></td>
    <td><input type="number" min="0" step="1"   placeholder="0"   id="px-${i}"  oninput="calcFila(${i})"></td>
    <td class="subtotal-cell" id="sub-${i}">—</td>
  `;
  tr.addEventListener('click', () => {
    document.querySelectorAll('#tbody tr').forEach(r => r.classList.remove('active-row'));
    tr.classList.add('active-row');
  });
  tbody.appendChild(tr);

  /* Precios row */
  const precioInicial = PRECIOS[nombre] || 0;
  const row = document.createElement('tr');
  row.innerHTML = `
    <td class="prod-name">${nombre}</td>
    <td><input type="number" min="0" step="1" placeholder="0" id="precio-${i}" value="${precioInicial}" oninput="updatePrecio(${i})"></td>
  `;
  preciosBody.appendChild(row);

  /* Stock row */
  const stockRow = document.createElement('tr');
  stockRow.innerHTML = `
    <td class="prod-name">${nombre}</td>
    <td><input type="number" min="0" step="1"   placeholder="0"   id="stock-cant-${i}" oninput="calcStockFila(${i})"></td>
    <td><input type="number" min="0" step="0.1" placeholder="0.0" id="stock-kg-${i}"   oninput="calcStockFila(${i})"></td>
    <td><input type="number" min="0" step="0.1" placeholder="0.0" id="stock-pp-${i}"   value="${precioInicial}" oninput="calcStockFila(${i})"></td>
    <td class="subtotal-cell" id="stock-total-${i}">—</td>
  `;
  stockBody.appendChild(stockRow);
});

/* ─── BOLETA CALCULATIONS ─────────────────────────────────── */

function calcFila(i) {
  const kgInput = document.getElementById('kg-' + i);
  const pxInput = document.getElementById('px-' + i);
  const kg      = parseFloat(kgInput.value) || 0;
  let   px      = parseFloat(pxInput.value) || 0;

  if (kg > 0 && (!pxInput.value || px <= 0)) {
    const cliente = document.getElementById('cliente').value.trim();
    const precio  = getPrecioProducto(PRODUCTOS[i], cliente);
    if (precio > 0) {
      px            = precio;
      pxInput.value = precio;
    }
  }

  const sub = kg * px;
  document.getElementById('sub-' + i).textContent = sub > 0 ? formatMoney(sub) : '—';
  calcTotales();
}

function calcTotales() {
  let total = 0;
  PRODUCTOS.forEach((_, i) => {
    const kg = parseFloat(document.getElementById('kg-' + i).value) || 0;
    const px = parseFloat(document.getElementById('px-' + i).value) || 0;
    total += kg * px;
  });
  const saldo   = parseFloat(document.getElementById('saldo-ant').value) || 0;
  const entrega = parseFloat(document.getElementById('entrega').value)   || 0;
  const debe    = (total + saldo) - entrega;

  document.getElementById('total-boleta').textContent = formatMoney(total);
  const debeEl = document.getElementById('debe');
  debeEl.textContent = formatMoney(debe);
  debeEl.style.color = debe > 0 ? '#f09595' : '#5DCAA5';
}

function updatePrecio(i) {
  const value = parseFloat(document.getElementById('precio-' + i).value) || 0;
  PRECIOS[PRODUCTOS[i]] = value;
  const pxInput = document.getElementById('px-' + i);
  if (pxInput) {
    pxInput.value = value > 0 ? value : '';
    calcFila(i);
  }
}

function calcStockFila(i) {
  const kilos  = parseFloat(document.getElementById('stock-kg-' + i).value) || 0;
  const precio = parseFloat(document.getElementById('stock-pp-' + i).value) || 0;
  document.getElementById('stock-total-' + i).textContent =
    (kilos * precio) > 0 ? formatMoney(kilos * precio) : '—';
}

/* ─── GUARDAR BOLETA ──────────────────────────────────────── */

function guardarBoleta() {
  const btn = document.querySelector('#ventas .btn-primary');

  const fecha    = document.getElementById('fecha').value;
  const locacion = document.getElementById('locacion').value;
  const cliente  = document.getElementById('cliente').value.trim();
  const achurero = document.getElementById('achurero').value;
  const saldoAnt = parseFloat(document.getElementById('saldo-ant').value) || 0;
  const entrega  = parseFloat(document.getElementById('entrega').value)   || 0;

  if (!cliente)  { alert('Seleccioná un cliente');    return; }
  if (!locacion) { alert('Seleccioná una localidad'); return; }

  const productos = [];
  PRODUCTOS.forEach((nombre, i) => {
    const kg = parseFloat(document.getElementById('kg-' + i).value) || 0;
    const px = parseFloat(document.getElementById('px-' + i).value) || 0;
    if (kg > 0 && px > 0) {
      productos.push({ nombre, kg, precio: px, subtotal: kg * px });
    }
  });

  if (productos.length === 0) { alert('Ingresá al menos un producto'); return; }

  btn.innerHTML = '<span class="loader"></span>Guardando...';
  btn.disabled  = true;

  const total   = productos.reduce((acc, p) => acc + p.subtotal, 0);
  const debe    = (total + saldoAnt) - entrega;
  const boletas = obtenerBoletas();

  if (EDITANDO_ID !== null) {
    const editandoIdStr = String(EDITANDO_ID);
    const index = boletas.findIndex(b => String(b.id) === editandoIdStr);

    if (index === -1) {
      console.error('guardarBoleta: ID no encontrado:', EDITANDO_ID);
      alert('Error: no se encontró la boleta a editar.');
      btn.innerHTML = 'Guardar boleta';
      btn.disabled  = false;
      return;
    }

    boletas[index] = {
      ...boletas[index],
      fecha, locacion, cliente, achurero,
      productos, total, saldoAnterior: saldoAnt, entrega, debe
    };

    guardarBoletas(boletas);
    console.log('✔ Boleta editada, ID:', EDITANDO_ID);

  } else {
    const nuevoId = generarIdBoleta(fecha, locacion, cliente);
    boletas.push({
      id: nuevoId,
      fecha, locacion, cliente, achurero,
      productos, total, saldoAnterior: saldoAnt, entrega, debe
    });
    guardarBoletas(boletas);
    console.log('✔ Boleta nueva guardada, ID:', nuevoId);
  }

  EDITANDO_ID   = null;
  SALDO_MANUAL  = false;

  setTimeout(() => {
    btn.innerHTML = '✔ Guardado';
    btn.style.background = '#5DCAA5';
    setTimeout(() => {
      btn.innerHTML = 'Guardar boleta';
      btn.style.background = '';
      btn.disabled  = false;
      limpiarForm();
    }, 1200);
  }, 500);
}

/* ─── HISTORIAL ───────────────────────────────────────────── */

function renderHistorial() {
  const contenedor = document.getElementById('ventas-historial');
  const boletas    = obtenerBoletas();

  if (!boletas || boletas.length === 0) {
    contenedor.innerHTML = `
      <div class="section-body">
        <div class="section-panel-inner" style="text-align:center; padding: 48px 24px;">
          <div style="font-size: 32px; margin-bottom: 16px;">📋</div>
          <div style="font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 8px;">Sin boletas</div>
          <div style="font-size: 14px; color: rgba(255,255,255,0.4);">No hay boletas guardadas aún</div>
        </div>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = `
    <div class="section-body">
      <div style="display:flex; justify-content:flex-end; margin-bottom: 12px;">
        <button
          id="btn-borrar-historial"
          class="btn-secondary"
          style="width:auto; padding: 8px 16px; font-size:13px; color:#f09595; border-color:rgba(240,149,149,0.3);"
        >🗑️ Borrar todo el historial</button>
      </div>
      <div class="section-panel-inner" style="padding: 0; overflow: hidden;">
        <table class="lara-table" style="table-layout: auto;">
          <thead>
            <tr>
              <th style="width:40%;">ID</th>
              <th style="width:18%;">Fecha</th>
              <th style="width:22%;">Cliente</th>
              <th style="width:12%; text-align:right;">Total</th>
              <th style="width:8%; text-align:center;">⚙</th>
            </tr>
          </thead>
          <tbody id="historial-body"></tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('btn-borrar-historial')
    .addEventListener('click', borrarHistorial);

  const tbodyEl = document.getElementById('historial-body');

  boletas.slice().reverse().forEach((b) => {
    const idStr = String(b.id);
    const total = b.productos.reduce((acc, p) => acc + p.subtotal, 0);

    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.innerHTML = `
      <td style="font-size:11px; color:rgba(255,255,255,0.6); font-family:monospace; word-break:break-all;">${idStr}</td>
      <td>${b.fecha}</td>
      <td>${b.cliente}</td>
      <td style="text-align:right;">${formatMoney(total)}</td>
      <td style="text-align:center;">
        <button
          class="btn-delete-boleta"
          data-id="${idStr}"
          style="
            background: transparent;
            border: 1px solid rgba(240,149,149,0.3);
            border-radius: 6px;
            color: #f09595;
            font-size: 14px;
            cursor: pointer;
            padding: 4px 8px;
            transition: all 0.2s ease;
          "
          title="Eliminar boleta"
        >🗑️</button>
      </td>
    `;

    tr.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-delete-boleta')) return;
      cargarBoleta(idStr);
    });

    tr.querySelector('.btn-delete-boleta').addEventListener('click', (e) => {
      e.stopPropagation();
      eliminarBoleta(idStr);
    });

    tbodyEl.appendChild(tr);
  });
}

function borrarHistorial() {
  const c1 = confirm('¿Estás seguro que querés borrar todo el historial?');
  if (!c1) return;
  const c2 = confirm('⚠️ Esta acción no se puede deshacer. ¿Querés continuar?');
  if (!c2) return;

  localStorage.removeItem(STORAGE_BOLETAS_KEY);
  EDITANDO_ID  = null;
  SALDO_MANUAL = false;
  limpiarForm();
  renderHistorial();
}

function eliminarBoleta(id) {
  const idStr = String(id);
  const confirmacion = confirm(`¿Eliminar la boleta?\n${idStr}`);
  if (!confirmacion) return;

  const boletas      = obtenerBoletas();
  const actualizadas = boletas.filter(b => String(b.id) !== idStr);

  if (actualizadas.length === boletas.length) {
    console.error('eliminarBoleta: ID no encontrado:', idStr);
    return;
  }

  guardarBoletas(actualizadas);

  if (String(EDITANDO_ID) === idStr) {
    EDITANDO_ID  = null;
    SALDO_MANUAL = false;
    limpiarForm();
  }

  renderHistorial();
}

/* ─── CUENTAS CORRIENTES ──────────────────────────────────── */

/*
  renderCuentasCorrientes()
  ─────────────────────────
  Derived view only — reads boletas, never writes.
  Groups: cliente → locacion → suma de debe
  Shows a row per locacion + a TOTAL row per cliente.

  Location display names:
    M   → Miramar
    MDP → Mar del Plata
    O   → Otamendi
    B   → Balcarce
*/

const LOC_NOMBRES = { M: 'Miramar', MDP: 'Mar del Plata', O: 'Otamendi', B: 'Balcarce' };

function renderCuentasCorrientes() {
  const contenedor = document.getElementById('ventas-cc');
  const boletas    = obtenerBoletas();

  if (!boletas || boletas.length === 0) {
    contenedor.innerHTML = `
      <div class="section-body">
        <div class="section-panel-inner" style="text-align:center; padding: 48px 24px;">
          <div style="font-size: 32px; margin-bottom: 16px;">📒</div>
          <div style="font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 8px;">Sin datos</div>
          <div style="font-size: 14px; color: rgba(255,255,255,0.4);">No hay boletas registradas aún</div>
        </div>
      </div>
    `;
    return;
  }

  // Build: { cliente: { locacion: saldo } }
  const agrupado = {};
  boletas.forEach(b => {
    const cli = b.cliente  || '(sin nombre)';
    const loc = b.locacion || '?';
    if (!agrupado[cli]) agrupado[cli] = {};
    if (!agrupado[cli][loc]) agrupado[cli][loc] = 0;
    agrupado[cli][loc] += b.debe || 0;
  });

  // Sort clients by total debe descending
  const clientesOrdenados = Object.entries(agrupado)
    .map(([cli, locs]) => ({
      cliente: cli,
      locs,
      total: Object.values(locs).reduce((a, v) => a + v, 0)
    }))
    .sort((a, b) => b.total - a.total);

  contenedor.innerHTML = `
    <div class="section-body">
      <div class="section-panel-inner" style="padding: 0; overflow: hidden;">
        <table class="lara-table" style="table-layout: fixed;">
          <thead>
            <tr>
              <th style="width:55%;">Cliente / Localidad</th>
              <th style="width:45%; text-align:right;">Saldo</th>
            </tr>
          </thead>
          <tbody id="cc-body"></tbody>
        </table>
      </div>
    </div>
  `;

  const tbodyEl = document.getElementById('cc-body');

  clientesOrdenados.forEach(({ cliente, locs, total }) => {
    // ── Cliente header row ──
    const trCliente = document.createElement('tr');
    trCliente.style.background = 'rgba(127,119,221,0.12)';
    trCliente.innerHTML = `
      <td style="
        font-size: 13px;
        font-weight: 700;
        color: #fff;
        padding: 10px 8px 6px;
        letter-spacing: 0.02em;
      ">👤 ${cliente}</td>
      <td></td>
    `;
    tbodyEl.appendChild(trCliente);

    // ── Locacion rows ──
    Object.entries(locs).forEach(([loc, saldo]) => {
      const trLoc = document.createElement('tr');
      trLoc.innerHTML = `
        <td style="
          font-size: 13px;
          color: rgba(255,255,255,0.6);
          padding: 5px 8px 5px 22px;
        ">📍 ${LOC_NOMBRES[loc] || loc}</td>
        <td style="
          text-align: right;
          font-size: 13px;
          font-weight: 600;
          color: ${saldo > 0 ? '#f09595' : '#5DCAA5'};
          padding: 5px 8px;
        ">${formatMoney(saldo)}</td>
      `;
      tbodyEl.appendChild(trLoc);
    });

    // ── Total row per cliente ──
    const trTotal = document.createElement('tr');
    trTotal.style.borderBottom = '1px solid rgba(127,119,221,0.2)';
    trTotal.innerHTML = `
      <td style="
        font-size: 12px;
        font-weight: 700;
        color: rgba(255,255,255,0.4);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: 5px 8px 10px 22px;
      ">Total</td>
      <td style="
        text-align: right;
        font-size: 15px;
        font-weight: 700;
        color: ${total > 0 ? '#f09595' : '#5DCAA5'};
        padding: 5px 8px 10px;
      ">${formatMoney(total)}</td>
    `;
    tbodyEl.appendChild(trTotal);
  });
}

/* ─── COMPRAS PERSISTENCE ─────────────────────────────────── */

/*
  Compra structure:
  {
    fecha:    string (YYYY-MM-DD),
    productos: [{ nombre, cant, kg, precioPP, subtotal }],
    total:    number
  }

  Completely isolated from boletas.
  Key: STORAGE_COMPRAS_KEY
*/

function obtenerCompras() {
  try {
    const raw = localStorage.getItem(STORAGE_COMPRAS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function guardarCompras(compras) {
  localStorage.setItem(STORAGE_COMPRAS_KEY, JSON.stringify(compras));
}

function guardarCompra() {
  // Find button — it's inside #compras section
  const btn = document.querySelector('#compras-cargar .btn-primary')
           || document.querySelector('#compras .btn-primary');

  const fecha = (() => {
    // Try to get fecha from a compras-specific date input if added;
    // fall back to today
    const el = document.getElementById('fecha-compra');
    return el ? el.value : new Date().toISOString().slice(0, 10);
  })();

  const productos = [];
  PRODUCTOS.forEach((nombre, i) => {
    const cant   = parseFloat(document.getElementById('stock-cant-' + i).value) || 0;
    const kg     = parseFloat(document.getElementById('stock-kg-'   + i).value) || 0;
    const precioPP = parseFloat(document.getElementById('stock-pp-' + i).value) || 0;

    if (kg > 0 && precioPP > 0) {
      productos.push({
        nombre,
        cant,
        kg,
        precioPP,
        subtotal: kg * precioPP
      });
    }
  });

  if (productos.length === 0) {
    alert('Ingresá al menos un producto en la compra');
    return;
  }

  const total = productos.reduce((acc, p) => acc + p.subtotal, 0);

  const compra = { fecha, productos, total };

  const compras = obtenerCompras();
  compras.push(compra);
  guardarCompras(compras);

  console.log('✔ Compra guardada:', compra);

  // Feedback
  if (btn) {
    btn.innerHTML = '<span class="loader"></span>Guardando...';
    btn.disabled  = true;
    setTimeout(() => {
      btn.innerHTML = '✔ Compra guardada';
      btn.style.background = '#5DCAA5';
      setTimeout(() => {
        btn.innerHTML = 'Guardar compra';
        btn.style.background = '';
        btn.disabled  = false;
        limpiarCompra();
      }, 1500);
    }, 600);
  }
}

function limpiarCompra() {
  PRODUCTOS.forEach((_, i) => {
    const cant = document.getElementById('stock-cant-' + i);
    const kg   = document.getElementById('stock-kg-'   + i);
    if (cant) cant.value = '';
    if (kg)   kg.value   = '';
    document.getElementById('stock-total-' + i).textContent = '—';
  });
}

/* ─── CARGAR BOLETA (EDICIÓN) ─────────────────────────────── */

function cargarBoleta(id) {
  const idStr   = String(id);
  const boletas = obtenerBoletas();
  const boleta  = boletas.find(b => String(b.id) === idStr);

  if (!boleta) {
    console.error('cargarBoleta: ID no encontrado:', id);
    return;
  }

  EDITANDO_ID  = idStr;
  SALDO_MANUAL = false;  // reset — editing loads its own fixed saldo
  limpiarInputs();

  document.getElementById('nro-boleta').textContent = boleta.id;
  document.getElementById('fecha').value            = boleta.fecha;
  document.getElementById('locacion').value         = boleta.locacion || '';
  document.getElementById('cliente').value          = boleta.cliente;
  document.getElementById('achurero').value         = boleta.achurero;
  document.getElementById('saldo-ant').value        = boleta.saldoAnterior || 0;
  document.getElementById('entrega').value          = boleta.entrega || 0;

  boleta.productos.forEach(p => {
    const i = PRODUCTOS.indexOf(p.nombre);
    if (i === -1) return;
    document.getElementById('kg-'  + i).value       = p.kg;
    document.getElementById('px-'  + i).value       = p.precio;
    document.getElementById('sub-' + i).textContent = formatMoney(p.subtotal);
  });

  calcTotales();

  ALL_SECTIONS.forEach(sectionId => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    el.classList.toggle('section-hidden', sectionId !== 'ventas');
  });

  activateTabs({
    'tab-ventas-crear':     true,
    'tab-ventas-cc':        false,
    'tab-ventas-historial': false,
  });
  togglePanels({
    'ventas-crear':     true,
    'ventas-cc':        false,
    'ventas-historial': false,
  });
}

/* ─── FORM HELPERS ────────────────────────────────────────── */

function limpiarForm() {
  EDITANDO_ID  = null;
  SALDO_MANUAL = false;
  limpiarInputs();
  document.getElementById('nro-boleta').textContent = '—';
}

function limpiarInputs() {
  const cliente = document.getElementById('cliente').value.trim();

  PRODUCTOS.forEach((nombre, i) => {
    document.getElementById('kg-'  + i).value       = '';
    const precio = getPrecioProducto(nombre, cliente);
    document.getElementById('px-'  + i).value       = precio > 0 ? precio : '';
    document.getElementById('sub-' + i).textContent = '—';
  });

  document.getElementById('saldo-ant').value = 0;
  document.getElementById('entrega').value   = 0;
  calcTotales();
}

function fillBoletaPricesFromMatrix() {
  const cliente = document.getElementById('cliente').value.trim();
  PRODUCTOS.forEach((nombre, i) => {
    const pxInput = document.getElementById('px-' + i);
    if (!pxInput) return;
    if (!pxInput.value || parseFloat(pxInput.value) <= 0) {
      const precio = getPrecioProducto(nombre, cliente);
      if (precio > 0) {
        pxInput.value = precio;
        calcFila(i);
      }
    }
  });
}

/* ─── SECTION NAVIGATION ──────────────────────────────────── */

const ALL_SECTIONS = ['home', 'ventas', 'compras', 'analisis', 'config'];

function showHome() {
  ALL_SECTIONS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('section-hidden', id !== 'home');
  });
  const home = document.getElementById('home');
  home.classList.remove('fade-in');
  void home.offsetWidth;
  home.classList.add('fade-in');
}

function showSection(id) {
  ALL_SECTIONS.forEach((sectionId) => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    if (sectionId === id) {
      el.classList.remove('section-hidden');
      el.classList.remove('fade-in');
      void el.offsetWidth;
      el.classList.add('fade-in');
    } else {
      el.classList.add('section-hidden');
    }
  });

  if (id === 'ventas')   showVentasTab('crear');
  if (id === 'compras')  showComprasTab('cargar');
  if (id === 'config')   showConfigTab('productos');
  if (id === 'analisis') showAnalisisTab('dashboard');
}

showHome();
calcTotales();

/* ─── EVENT LISTENERS ─────────────────────────────────────── */

// Auto-fill saldo when cliente changes (create mode only)
document.getElementById('cliente').addEventListener('change', () => {
  if (EDITANDO_ID !== null) return;
  const cliente = document.getElementById('cliente').value.trim();
  autoFillSaldoAnterior(cliente);
});

// Mark saldo as manually edited so auto-fill won't override it again
document.getElementById('saldo-ant').addEventListener('input', () => {
  // Only flag as manual if we're in create mode and a cliente is already selected
  if (EDITANDO_ID !== null) return;
  const cliente = document.getElementById('cliente').value.trim();
  if (cliente) SALDO_MANUAL = true;
});

/* ─── TAB HELPERS ─────────────────────────────────────────── */

function activateTabs(tabMap) {
  Object.entries(tabMap).forEach(([id, active]) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', active);
  });
}

function togglePanels(panelMap) {
  Object.entries(panelMap).forEach(([id, visible]) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('section-hidden', !visible);
  });
}

/* ─── VENTAS TABS ─────────────────────────────────────────── */

function showVentasTab(tab) {
  activateTabs({
    'tab-ventas-crear':     tab === 'crear',
    'tab-ventas-cc':        tab === 'cc',
    'tab-ventas-historial': tab === 'historial',
  });
  togglePanels({
    'ventas-crear':     tab === 'crear',
    'ventas-cc':        tab === 'cc',
    'ventas-historial': tab === 'historial',
  });

  if (tab === 'crear') {
    fillBoletaPricesFromMatrix();
    setTimeout(() => {
      const firstInput = document.querySelector('#tbody input');
      if (firstInput) firstInput.focus();
    }, 50);
  }

  if (tab === 'historial') renderHistorial();
  if (tab === 'cc')        renderCuentasCorrientes();
}

/* ─── COMPRAS TABS ────────────────────────────────────────── */

function showComprasTab(tab) {
  activateTabs({
    'tab-compras-cargar': tab === 'cargar',
    'tab-compras-auto':   tab === 'auto',
    'tab-compras-manual': tab === 'manual',
  });
  togglePanels({
    'compras-cargar':       tab === 'cargar',
    'compras-stock-auto':   tab === 'auto',
    'compras-stock-manual': tab === 'manual',
  });
}

/* ─── ANALISIS TABS ───────────────────────────────────────── */

function showAnalisisTab(tab) {
  activateTabs({
    'tab-analisis-dashboard': tab === 'dashboard',
    'tab-analisis-insights':  tab === 'insights',
  });
  togglePanels({
    'analisis-dashboard': tab === 'dashboard',
    'analisis-insights':  tab === 'insights',
  });
  if (tab === 'dashboard') renderChart();
  if (tab === 'insights')  renderInsights();
}

/* ─── CONFIG TABS ─────────────────────────────────────────── */

function showConfigTab(tab) {
  activateTabs({
    'tab-config-productos':   tab === 'productos',
    'tab-config-clientes':    tab === 'clientes',
    'tab-config-proveedores': tab === 'proveedores',
  });
  togglePanels({
    'config-productos':   tab === 'productos',
    'config-clientes':    tab === 'clientes',
    'config-proveedores': tab === 'proveedores',
  });
}

/* ─── CHART ───────────────────────────────────────────────── */

function renderChart() {
  const chartData = [
    { product: 'Hígado',   sales: 45 },
    { product: 'Riñón',    sales: 32 },
    { product: 'Corazón',  sales: 28 },
    { product: 'Mondongo', sales: 18 },
  ];

  const chartEl = document.getElementById('bar-chart');
  if (!chartEl) return;
  chartEl.innerHTML = '';
  void chartEl.offsetWidth;

  const maxSales = Math.max(...chartData.map(d => d.sales));
  chartData.forEach(data => {
    const bar = document.createElement('div');
    bar.className    = 'bar';
    bar.style.height = (data.sales / maxSales * 100) + '%';
    bar.textContent  = data.sales;

    const label = document.createElement('div');
    label.className   = 'bar-label';
    label.textContent = data.product;

    bar.appendChild(label);
    chartEl.appendChild(bar);
  });
}

function renderInsights() {
  const insights = [
    '📈 El producto más vendido hoy es Hígado',
    '💰 Ingresos estimados del día: $150.000',
    '📊 Aumento del 12% respecto al promedio semanal',
    '⚠️ Bajo stock en Riñón',
    '🔥 Mondongo muestra tendencia creciente',
  ];
  const list = document.getElementById('insights-list');
  if (!list) return;
  list.innerHTML = '';
  insights.forEach(text => {
    const li = document.createElement('li');
    li.textContent = text;
    list.appendChild(li);
  });
}

/* ─── KEYBOARD NAVIGATION ─────────────────────────────────── */

const GRID_COLS = ['cant', 'kg', 'px'];
const GRID_ROWS = PRODUCTOS.length;

function getGridPos(inputEl) {
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS.length; col++) {
      if (inputEl.id === `${GRID_COLS[col]}-${row}`) return { row, col };
    }
  }
  return null;
}

function focusGridCell(row, col) {
  const r  = Math.max(0, Math.min(GRID_ROWS - 1, row));
  const c  = Math.max(0, Math.min(GRID_COLS.length - 1, col));
  const el = document.getElementById(`${GRID_COLS[c]}-${r}`);
  if (el) { el.focus(); el.select(); }
}

document.addEventListener('keydown', (e) => {
  const active = document.activeElement;
  if (!active || active.tagName !== 'INPUT') return;

  if (e.key === 'Enter') {
    const pos = getGridPos(active);
    if (!pos) return;
    e.preventDefault();
    if (pos.row < GRID_ROWS - 1) {
      focusGridCell(pos.row + 1, pos.col);
    } else if (pos.col < GRID_COLS.length - 1) {
      focusGridCell(0, pos.col + 1);
    }
    return;
  }

  if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return;

  const pos = getGridPos(active);
  if (!pos) return;

  e.preventDefault();

  switch (e.key) {
    case 'ArrowUp':    focusGridCell(pos.row - 1, pos.col); break;
    case 'ArrowDown':  focusGridCell(pos.row + 1, pos.col); break;
    case 'ArrowLeft':  if (pos.col > 0) focusGridCell(pos.row, pos.col - 1); break;
    case 'ArrowRight': if (pos.col < GRID_COLS.length - 1) focusGridCell(pos.row, pos.col + 1); break;
  }
});

/* ─── SIDEBAR ─────────────────────────────────────────────── */

function toggleSidebar() {
  const sidebar = document.getElementById('client-sidebar');
  const openBtn = document.getElementById('sidebar-open-btn');
  const isOpen  = sidebar.classList.contains('open');
  sidebar.classList.toggle('open');
  openBtn.classList.toggle('hidden', !isOpen);
}

function selectClient(nombre, locacionCodigo) {
  const clienteInput   = document.getElementById('cliente');
  const locacionSelect = document.getElementById('locacion');

  if (clienteInput)   clienteInput.value   = nombre;
  if (locacionSelect) locacionSelect.value = locacionCodigo;

  document.querySelectorAll('.sidebar-clients li').forEach(li => {
    li.classList.toggle('active', li.textContent.trim() === nombre);
  });

  // Trigger saldo auto-fill as if the user changed the field
  autoFillSaldoAnterior(nombre);

  const ventasSection = document.getElementById('ventas');
  if (ventasSection && ventasSection.classList.contains('section-hidden')) {
    showSection('ventas');
  } else {
    showVentasTab('crear');
  }
}
