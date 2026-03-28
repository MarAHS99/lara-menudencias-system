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

const tbody = document.getElementById('tbody');
const preciosBody = document.getElementById('precios-body');
const stockBody = document.getElementById('stock-body');

const STORAGE_PRECIOS_KEY = 'lara_menudencias_precios';
const PRECIOS = {};
PRODUCTOS.forEach((nombre) => {
  PRECIOS[nombre] = 0;
});

// Valores iniciales de ejemplo (si no hay localStorage).
if (PRECIOS['Hígado'] !== undefined) PRECIOS['Hígado'] = 2000;
if (PRECIOS['Riñón'] !== undefined) PRECIOS['Riñón'] = 1800;

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
  const btn = document.querySelector('#precios .btn-primary');
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


PRODUCTOS.forEach((nombre, i) => {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="number" min="0" step="1" placeholder="0" class="cant" id="cant-${i}"></td>
    <td class="prod-name">${nombre}</td>
    <td><input type="number" min="0" step="0.1" placeholder="0.0" id="kg-${i}" oninput="calcFila(${i})"></td>
    <td><input type="number" min="0" step="1" placeholder="0" id="px-${i}" readonly class="px-readonly"></td>
    <td class="subtotal-cell" id="sub-${i}">—</td>
  `;
  tbody.appendChild(tr);

  const row = document.createElement('tr');
  const precioInicial = PRECIOS[nombre] || 0;
  row.innerHTML = `
    <td class="prod-name">${nombre}</td>
    <td><input type="number" min="0" step="1" placeholder="0" id="precio-${i}" value="${precioInicial}" oninput="updatePrecio(${i})"></td>
  `;
  preciosBody.appendChild(row);

  const stockRow = document.createElement('tr');
  stockRow.innerHTML = `
    <td class="prod-name">${nombre}</td>
    <td><input type="number" min="0" step="1" placeholder="0" id="stock-cant-${i}" oninput="calcStockFila(${i})"></td>
    <td><input type="number" min="0" step="0.1" placeholder="0.0" id="stock-kg-${i}" oninput="calcStockFila(${i})"></td>
    <td><input type="number" min="0" step="0.1" placeholder="0.0" id="stock-pp-${i}" value="${precioInicial}" oninput="calcStockFila(${i})"></td>
    <td class="subtotal-cell" id="stock-total-${i}">—</td>
  `;
  stockBody.appendChild(stockRow);
});

function calcFila(i) {
  const kgInput = document.getElementById('kg-'+i);
  const pxInput = document.getElementById('px-'+i);
  const kg = parseFloat(kgInput.value) || 0;
  let px = parseFloat(pxInput.value) || 0;

  if (kg > 0 && (!pxInput.value || px <= 0)) {
    const precio = PRECIOS[PRODUCTOS[i]];
    if (precio > 0) {
      px = precio;
      pxInput.value = precio;
    }
  }

  const sub = kg * px;
  document.getElementById('sub-'+i).textContent = sub > 0 ? formatMoney(sub) : '—';
  calcTotales();
}

function calcTotales() {
  let total = 0;
  PRODUCTOS.forEach((_, i) => {
    const kg = parseFloat(document.getElementById('kg-'+i).value) || 0;
    const px = parseFloat(document.getElementById('px-'+i).value) || 0;
    total += kg * px;
  });
  const saldo = parseFloat(document.getElementById('saldo-ant').value) || 0;
  const entrega = parseFloat(document.getElementById('entrega').value) || 0;
  const debe = (total + saldo) - entrega;
  document.getElementById('total-boleta').textContent = formatMoney(total);
  const debeEl = document.getElementById('debe');
  debeEl.textContent = formatMoney(debe);
  debeEl.style.color = debe > 0 ? '#f09595' : '#5DCAA5';
}

function updatePrecio(i) {
  const input = document.getElementById('precio-'+i);
  const value = parseFloat(input.value) || 0;
  PRECIOS[PRODUCTOS[i]] = value;

  // Sincronizar con la fila de boleta cuando se visualiza y el campo precio está vacío
  const pxInput = document.getElementById('px-'+i);
  if (pxInput && (!pxInput.value || parseFloat(pxInput.value) <= 0)) {
    pxInput.value = value > 0 ? value : '';
    calcFila(i);
  }
}

function calcStockFila(i) {
  const kilos = parseFloat(document.getElementById('stock-kg-'+i).value) || 0;
  const precio = parseFloat(document.getElementById('stock-pp-'+i).value) || 0;
  const total = kilos * precio;
  document.getElementById('stock-total-'+i).textContent = total > 0 ? formatMoney(total) : '—';
}

function guardarBoleta() {
  const btn = document.querySelector('#boleta .btn-primary');

  btn.innerHTML = '<span class="loader"></span>Guardando...';
  btn.disabled = true;

  setTimeout(() => {
    btn.innerHTML = '✔ Guardado';
    btn.style.background = '#5DCAA5';

    setTimeout(() => {
      btn.innerHTML = 'Guardar boleta';
      btn.style.background = '';
      btn.disabled = false;
    }, 2000);

  }, 1000);
}

function limpiarForm() {
  PRODUCTOS.forEach((_, i) => {
    document.getElementById('kg-'+i).value = '';
    document.getElementById('px-'+i).value = '';
    document.getElementById('sub-'+i).textContent = '—';
  });
  document.getElementById('saldo-ant').value = 0;
  document.getElementById('entrega').value = 0;
  calcTotales();
  const nro = parseInt(document.getElementById('nro-boleta').textContent);
  document.getElementById('nro-boleta').textContent = String(nro + 1).padStart(6, '0');
}

function fillBoletaPricesFromMatrix() {
  PRODUCTOS.forEach((nombre, i) => {
    const pxInput = document.getElementById('px-'+i);
    if (!pxInput) return;
    const precioGuardado = PRECIOS[nombre] || 0;
    if ((!pxInput.value || parseFloat(pxInput.value) <= 0) && precioGuardado > 0) {
      pxInput.value = precioGuardado;
      calcFila(i);
    }
  });
}

function showHome() {
  const home = document.getElementById('home');

  home.classList.remove('section-hidden');
  home.classList.remove('fade-in');
  void home.offsetWidth;
  home.classList.add('fade-in');

  ['boleta', 'precios', 'analisis', 'stock'].forEach((sectionId) => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    el.classList.add('section-hidden');
  });
}

showHome();
calcTotales();

// mantengo foco inicial solo al entrar a boleta por acción de usuario

function renderChart() {
  const chartData = [
    { product: 'Hígado', sales: 45 },
    { product: 'Riñón', sales: 32 },
    { product: 'Corazón', sales: 28 },
    { product: 'Mondongo', sales: 18 }
  ];

  const chartEl = document.getElementById('bar-chart');
  if (!chartEl) return;

  chartEl.innerHTML = '';
  void chartEl.offsetWidth;

  const maxSales = Math.max(...chartData.map(d => d.sales));

  chartData.forEach(data => {
    const barHeight = (data.sales / maxSales) * 100;
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = barHeight + '%';
    bar.textContent = data.sales;

    const label = document.createElement('div');
    label.className = 'bar-label';
    label.textContent = data.product;

    bar.appendChild(label);
    chartEl.appendChild(bar);
  });
}

function showStockTab(tab) {
  document.querySelectorAll('.stock-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.textContent === (tab === 'carga' ? 'Carga de Stock' : 'Control de Stock'));
  });
  document.getElementById('stock-carga').classList.toggle('section-hidden', tab !== 'carga');
  document.getElementById('stock-control').classList.toggle('section-hidden', tab !== 'control');
}

function showSection(id) {
  document.getElementById('home').classList.add('section-hidden');

  const sections = ['boleta', 'precios', 'analisis', 'stock'];

  sections.forEach((sectionId) => {
    const el = document.getElementById(sectionId);
    if (!el) return;

    if (sectionId === id) {
      el.classList.remove('section-hidden');

      // Reset animación
      el.classList.remove('fade-in');
      void el.offsetWidth; // trigger reflow

      el.classList.add('fade-in');
    } else {
      el.classList.add('section-hidden');
    }
  });

  if (id === 'boleta') {
    fillBoletaPricesFromMatrix();
    document.querySelector('input[id^="kg-"]').focus();
  }

  if (id === 'analisis') {
    renderChart();
  }

  if (id === 'stock') {
    showStockTab('carga');
  }
}

function renderInsights() {
  const insights = [
    "📈 El producto más vendido hoy es Hígado",
    "💰 Ingresos estimados del día: $150.000",
    "📊 Aumento del 12% respecto al promedio semanal",
    "⚠️ Bajo stock en Riñón",
    "🔥 Mondongo muestra tendencia creciente"
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

function verHistorial() {
  alert("📋 Historial de boletas\n\n- Boleta #008851\n- Boleta #008850\n- Boleta #008849\n\n(Próximamente conectado a base de datos)");
}
