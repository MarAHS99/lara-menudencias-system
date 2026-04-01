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

const tbody      = document.getElementById('tbody');
const preciosBody = document.getElementById('precios-body');
const stockBody  = document.getElementById('stock-body');

const STORAGE_PRECIOS_KEY = 'lara_menudencias_precios';
const STORAGE_BOLETAS_KEY = 'lara_menudencias_boletas';
const PRECIOS = {};
PRODUCTOS.forEach((nombre) => { PRECIOS[nombre] = 0; });
let EDITANDO_ID = null;

if (PRECIOS['Hígado'] !== undefined) PRECIOS['Hígado'] = 2000;
if (PRECIOS['Riñón']  !== undefined) PRECIOS['Riñón']  = 1800;

cargarPrecios();

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

function obtenerBoletas() {
  try {
    const raw = localStorage.getItem(STORAGE_BOLETAS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Normalizar: garantizar que todos los IDs son number
    return Array.isArray(parsed)
      ? parsed.map(b => ({ ...b, id: Number(b.id) }))
      : [];
  } catch {
    return [];
  }
}

function guardarBoletas(boletas) {
  localStorage.setItem(STORAGE_BOLETAS_KEY, JSON.stringify(boletas));
}

/* ─── BUILD ROWS ──────────────────────────────────────────── */

PRODUCTOS.forEach((nombre, i) => {

  /* Boleta row */
  const tr = document.createElement('tr');
  
  tr.innerHTML = `
    <td><input type="number" min="0" step="1"   placeholder="0"   class="cant" id="cant-${i}" oninput="calcFila(${i})"></td>
    <td class="prod-name">${nombre}</td>
    <td><input type="number" min="0" step="any" placeholder="0.0" id="kg-${i}"   oninput="calcFila(${i})"></td>
    <td><input type="number" min="0" step="1"   placeholder="0"   id="px-${i}"   readonly class="px-readonly"></td>
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
    <td><input type="number" min="0" step="1"   placeholder="0"   id="stock-cant-${i}"  oninput="calcStockFila(${i})"></td>
    <td><input type="number" min="0" step="0.1" placeholder="0.0" id="stock-kg-${i}"    oninput="calcStockFila(${i})"></td>
    <td><input type="number" min="0" step="0.1" placeholder="0.0" id="stock-pp-${i}"    value="${precioInicial}" oninput="calcStockFila(${i})"></td>
    <td class="subtotal-cell" id="stock-total-${i}">—</td>
  `;
  stockBody.appendChild(stockRow);
});

/* ─── BOLETA LOGIC ────────────────────────────────────────── */

function calcFila(i) {
  const kgInput = document.getElementById('kg-' + i);
  const pxInput = document.getElementById('px-' + i);
  const kg = parseFloat(kgInput.value) || 0;
  let   px = parseFloat(pxInput.value) || 0;

  if (kg > 0 && (!pxInput.value || px <= 0)) {
    const precio = PRECIOS[PRODUCTOS[i]];
    if (precio > 0) { px = precio; pxInput.value = precio; }
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
  if (pxInput && (!pxInput.value || parseFloat(pxInput.value) <= 0)) {
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

function generarNuevoId() {
  const boletas = obtenerBoletas();
  if (boletas.length === 0) return 1;
  return Math.max(...boletas.map(b => Number(b.id))) + 1;
}

function guardarBoletas(boletas) {
  localStorage.setItem(STORAGE_BOLETAS_KEY, JSON.stringify(boletas));
}

/* ─── GUARDAR BOLETA ──────────────────────────────────────── */

function guardarBoleta() {
  const btn = document.querySelector('#ventas .btn-primary');

  const fecha    = document.getElementById('fecha').value;
  const cliente  = document.getElementById('cliente').value.trim();
  const achurero = document.getElementById('achurero').value;
  const saldoAnt = parseFloat(document.getElementById('saldo-ant').value) || 0;
  const entrega  = parseFloat(document.getElementById('entrega').value) || 0;

  // Validaciones antes de tocar el botón
  if (!cliente) {
    alert('Seleccioná un cliente');
    return;
  }

  const productos = [];
  PRODUCTOS.forEach((nombre, i) => {
    const kg = parseFloat(document.getElementById('kg-' + i).value) || 0;
    const px = parseFloat(document.getElementById('px-' + i).value) || 0;
    if (kg > 0 && px > 0) {
      productos.push({ nombre, kg, precio: px, subtotal: kg * px });
    }
  });

  if (productos.length === 0) {
    alert('Ingresá al menos un producto');
    return;
  }

  btn.innerHTML = '<span class="loader"></span>Guardando...';
  btn.disabled = true;

  const total = productos.reduce((acc, p) => acc + p.subtotal, 0);
  const debe  = (total + saldoAnt) - entrega;

  const boletas = obtenerBoletas();

  if (EDITANDO_ID !== null) {
    // ── EDITAR: buscar por ID numérico, nunca por posición ──
    const editandoIdNum = Number(EDITANDO_ID);
    const index = boletas.findIndex(b => Number(b.id) === editandoIdNum);

    if (index === -1) {
      console.error('No se encontró la boleta con ID:', EDITANDO_ID);
      alert('Error: no se encontró la boleta a editar.');
      btn.innerHTML = 'Guardar boleta';
      btn.disabled = false;
      return;
    }

    // Preservar el ID original exacto — nunca regenerarlo
    boletas[index] = {
      ...boletas[index],  // conserva campos que pudieran agregarse en el futuro
      fecha,
      cliente,
      achurero,
      productos,
      total,
      saldoAnterior: saldoAnt,
      entrega,
      debe
      // id NO se toca
    };

    guardarBoletas(boletas);
    console.log('✔ Boleta editada, ID:', EDITANDO_ID);

  } else {
    // ── NUEVA: ID desde localStorage, nunca desde el DOM ──
    const nuevoId = generarNuevoId();

    const boleta = {
      id: nuevoId,
      fecha,
      cliente,
      achurero,
      productos,
      total,
      saldoAnterior: saldoAnt,
      entrega,
      debe
    };

    boletas.push(boleta);
    guardarBoletas(boletas);
    console.log('✔ Boleta nueva guardada, ID:', nuevoId);
  }

  EDITANDO_ID = null;

  setTimeout(() => {
    btn.innerHTML = '✔ Guardado';
    btn.style.background = '#5DCAA5';
    setTimeout(() => {
      btn.innerHTML = 'Guardar boleta';
      btn.style.background = '';
      btn.disabled = false;
      limpiarForm();
    }, 1200);
  }, 500);
}

function renderHistorial() {
  const contenedor = document.getElementById('ventas-historial');

  const boletas = obtenerBoletas();

  if (!boletas || boletas.length === 0) {
    contenedor.innerHTML = `
      <div class="section-body">
        <div class="section-panel-inner" style="text-align:center; padding: 48px 24px;">
          <div style="font-size: 32px; margin-bottom: 16px;">📋</div>
          <div style="font-size: 16px; font-weight: 700;">Sin boletas</div>
        </div>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = `
    <div class="section-body">
      <div class="section-panel-inner">
        <table class="lara-table">
          <thead>
            <tr>
              <th>N°</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody id="historial-body"></tbody>
        </table>
      </div>
    </div>
  `;

  const tbody = document.getElementById('historial-body');

  boletas.slice().reverse().forEach((b) => {
    const total = b.productos.reduce((acc, p) => acc + p.subtotal, 0);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${b.id}</td>
      <td>${b.fecha}</td>
      <td>${b.cliente}</td>
      <td>${formatMoney(total)}</td>
    `;
  tr.style.cursor = 'pointer';

  tr.addEventListener('click', () => {
    cargarBoleta(b.id);
  });

    tbody.appendChild(tr);
  });
}

function cargarBoleta(id) {
  const idNum = Number(id);
  const boletas = obtenerBoletas();
  const boleta = boletas.find(b => Number(b.id) === idNum);

  if (!boleta) {
    console.error('cargarBoleta: ID no encontrado:', id);
    return;
  }

  // 1. Setear modo edición ANTES de navegar
  EDITANDO_ID = idNum;

  // 2. Limpiar inputs ANTES de escribir los valores nuevos
  limpiarInputs();

  // 3. Escribir los valores de la boleta en el DOM
  document.getElementById('nro-boleta').textContent = String(boleta.id).padStart(6, '0');
  document.getElementById('fecha').value    = boleta.fecha;
  document.getElementById('cliente').value  = boleta.cliente;
  document.getElementById('achurero').value = boleta.achurero;
  document.getElementById('saldo-ant').value = boleta.saldoAnterior || 0;
  document.getElementById('entrega').value   = boleta.entrega || 0;

  boleta.productos.forEach(p => {
    const i = PRODUCTOS.indexOf(p.nombre);
    if (i === -1) return;
    document.getElementById('kg-' + i).value = p.kg;
    document.getElementById('px-' + i).value = p.precio;
    document.getElementById('sub-' + i).textContent = formatMoney(p.subtotal);
  });

  calcTotales();

  // 4. Navegar DESPUÉS de escribir — así showVentasTab no pisa los datos
  // Mostrar la sección sin resetear el formulario
  const ALL_SECTIONS = ['home', 'ventas', 'compras', 'analisis', 'config'];
  ALL_SECTIONS.forEach(sectionId => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    el.classList.toggle('section-hidden', sectionId !== 'ventas');
  });

  // Activar el tab 'crear' sin llamar fillBoletaPricesFromMatrix
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

function limpiarForm() {
  EDITANDO_ID = null;
  limpiarInputs();

  const nuevoId = generarNuevoId();
  document.getElementById('nro-boleta').textContent = String(nuevoId).padStart(6, '0');
}

function limpiarInputs() {
  PRODUCTOS.forEach((_, i) => {
    document.getElementById('kg-'  + i).value = '';
    document.getElementById('px-'  + i).value = '';
    document.getElementById('sub-' + i).textContent = '—';
  });
  document.getElementById('saldo-ant').value = 0;
  document.getElementById('entrega').value   = 0;
  calcTotales();
}

function limpiarInputs() {
  PRODUCTOS.forEach((_, i) => {
    document.getElementById('kg-'  + i).value = '';
    document.getElementById('px-'  + i).value = '';
    document.getElementById('sub-' + i).textContent = '—';
  });

  document.getElementById('saldo-ant').value = 0;
  document.getElementById('entrega').value   = 0;

  calcTotales();
}

function fillBoletaPricesFromMatrix() {
  PRODUCTOS.forEach((nombre, i) => {
    const pxInput = document.getElementById('px-' + i);
    if (!pxInput) return;
    const saved = PRECIOS[nombre] || 0;
    if ((!pxInput.value || parseFloat(pxInput.value) <= 0) && saved > 0) {
      pxInput.value = saved;
      calcFila(i);
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

/* ─── TAB HELPERS ─────────────────────────────────────────── */

function activateTabs(tabMap) {
  /* tabMap: { tabId: boolean } */
  Object.entries(tabMap).forEach(([id, active]) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', active);
  });
}

function togglePanels(panelMap) {
  /* panelMap: { panelId: boolean (true = visible) } */
  Object.entries(panelMap).forEach(([id, visible]) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('section-hidden', !visible);
  });
}

/* ─── VENTAS TABS ─────────────────────────────────────────── */

function showVentasTab(tab) {
  activateTabs({
    'tab-ventas-crear':    tab === 'crear',
    'tab-ventas-cc':       tab === 'cc',
    'tab-ventas-historial': tab === 'historial',
  });

  togglePanels({
    'ventas-crear':    tab === 'crear',
    'ventas-cc':       tab === 'cc',
    'ventas-historial': tab === 'historial',
  });

  // 👉 SOLO cuando estás creando
  if (tab === 'crear') {
    fillBoletaPricesFromMatrix();

    setTimeout(() => {
      const firstInput = document.querySelector('#tbody input');
      if (firstInput) firstInput.focus();
    }, 50);
  }

  // 👉 SOLO cuando estás viendo historial
  if (tab === 'historial') {
    renderHistorial();
  }
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
    bar.className   = 'bar';
    bar.style.height = (data.sales / maxSales * 100) + '%';
    bar.textContent  = data.sales;

    const label = document.createElement('div');
    label.className = 'bar-label';
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

/* ─── KEYBOARD NAV ────────────────────────────────────────── */

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const active = document.activeElement;
  if (!active || active.tagName !== 'INPUT') return;
  e.preventDefault();
  const inputs = Array.from(document.querySelectorAll('#tbody input'));
  const index  = inputs.indexOf(active);
  if (index > -1 && index < inputs.length - 1) inputs[index + 1].focus();
});

/* ─── SIDEBAR ─────────────────────────────────────────────── */

function toggleSidebar() {
  const sidebar = document.getElementById('client-sidebar');
  const openBtn = document.getElementById('sidebar-open-btn');
  const isOpen  = sidebar.classList.contains('open');
  sidebar.classList.toggle('open');
  openBtn.classList.toggle('hidden', !isOpen);
}

function selectClient(nombre) {
  const clienteInput = document.getElementById('cliente');
  if (clienteInput) clienteInput.value = nombre;

  document.querySelectorAll('.sidebar-clients li').forEach(li => {
    li.classList.toggle('active', li.textContent === nombre);
  });

  const ventasSection = document.getElementById('ventas');
  if (ventasSection && ventasSection.classList.contains('section-hidden')) {
    showSection('ventas');
  } else {
    showVentasTab('crear');
  }
}
