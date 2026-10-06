import { el } from './dom.js';
import { formatPrice, imageUrl } from './store.js';
import { request } from './backend.js';

const $ = (selector) => document.querySelector(selector);
const dialog = $('#product-dialog');
const form = $('#product-form');
let products = [];
let editingId = null;
let photo = '';

async function api(path, { method = 'GET', body, raw } = {}) {
  const response = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error ?? `Ошибка ${response.status}`), { status: response.status });
  return data;
}

const show = (node, visible) => { node.hidden = !visible; };
const message = (node, text) => { node.textContent = text ?? ''; show(node, Boolean(text)); };

// ---------- Вход ----------
function showLogin() {
  show($('#login-form'), true); show($('#products-section'), false); show($('#staff-section'), false);
  show($('#admin-nav'), false); show($('#admin-user'), false);
}

const ROLES = { admin: 'Администратор', staff: 'Сотрудник склада', courier: 'Курьер' };
let currentUser = null;

function openTab(name) {
  show($('#products-section'), name === 'products');
  show($('#staff-section'), name === 'staff');
  document.querySelectorAll('#admin-nav [data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === name)));
  if (name === 'staff') loadStaff();
}
$('#admin-nav').addEventListener('click', (event) => { const t = event.target.dataset?.tab; if (t) openTab(t); });

async function loadStaff() {
  try {
    const list = await request('api/staff');
    message($('#staff-error'), '');
    $('#staff-table tbody').replaceChildren(...list.map((u) => el('tr', {},
      el('td', {}, el('b', { textContent: u.login })),
      el('td', { textContent: ROLES[u.role] ?? u.role }),
      el('td', {}, u.id === currentUser.id ? el('small', { className: 'muted', textContent: 'это вы' })
        : el('div', { className: 'actions' }, el('button', { type: 'button', className: 'btn btn--outline btn--sm btn--danger', textContent: 'Удалить',
            onclick: async () => {
              if (!confirm(`Удалить сотрудника «${u.login}»?`)) return;
              try { await request(`api/staff/${u.id}`, { method: 'DELETE' }); loadStaff(); }
              catch (error) { message($('#staff-error'), error.message); }
            } }))))));
  } catch (error) { message($('#staff-error'), error.message); }
}

$('#staff-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await request('api/staff', { method: 'POST', body: Object.fromEntries(new FormData(event.target)) });
    event.target.reset(); loadStaff();
  } catch (error) { message($('#staff-error'), error.message); }
});

async function start() {
  try {
    const user = await api('api/me');
    if (user.role !== 'admin') throw new Error('Нет доступа');
    currentUser = user;
    $('#admin-login').textContent = user.login;
    show($('#admin-user'), true); show($('#login-form'), false); show($('#admin-nav'), true); openTab('products');
    await loadProducts();
  } catch (error) {
    if (error.status === 404) {
      $('#admin').replaceChildren(el('p', { className: 'form-error', textContent: 'Сервер не запущен. Запустите «npm start» и откройте сайт через него.' }));
    } else {
      showLogin();
    }
  }
}

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  try {
    await api('api/login', { method: 'POST', body: data });
    event.target.reset(); message($('#login-error'), '');
    start();
  } catch (error) { message($('#login-error'), error.message); }
});

$('#logout').addEventListener('click', async () => { await api('api/logout', { method: 'POST' }); showLogin(); });

// ---------- Список ----------
async function loadProducts() {
  try {
    products = await api('api/products?all=1');
    message($('#list-error'), '');
    renderTable();
  } catch (error) {
    if (error.status === 401) showLogin(); else message($('#list-error'), error.message);
  }
}

function stockTag(p) {
  if (p.stock === 0) return el('span', { className: 'tag tag--low', textContent: 'нет' });
  return el('span', { className: p.stock <= 5 ? 'tag tag--low' : '', textContent: `${p.stock} шт` });
}

function renderTable() {
  $('#products-table tbody').replaceChildren(...products.map((p) => el('tr', {},
    el('td', {}, el('img', { src: imageUrl(p.image), alt: '' })),
    el('td', {}, el('b', { textContent: p.title }), el('br'), el('small', { textContent: p.summary })),
    el('td', { textContent: p.category }),
    el('td', { className: 'num' }, formatPrice(p.price), p.oldPrice ? el('small', { textContent: ` (было ${formatPrice(p.oldPrice)})` }) : null),
    el('td', {}, stockTag(p)),
    el('td', {}, el('span', { className: `tag${p.active ? '' : ' tag--off'}`, textContent: p.active ? 'в каталоге' : 'скрыт' })),
    el('td', {}, el('div', { className: 'actions' },
      el('button', { type: 'button', className: 'btn btn--outline btn--sm', textContent: 'Изменить', onclick: () => openForm(p) }),
      el('button', { type: 'button', className: 'btn btn--outline btn--sm btn--danger', textContent: 'Удалить', onclick: () => remove(p) }))))));
  $('#categories').replaceChildren(...[...new Set(products.map((p) => p.category).filter(Boolean))].map((c) => el('option', { value: c })));
}

async function remove(product) {
  if (!confirm(`Удалить «${product.title}»? Это нельзя отменить. Чтобы просто убрать из каталога, скройте товар.`)) return;
  try { await api(`api/products/${product.id}`, { method: 'DELETE' }); await loadProducts(); }
  catch (error) { message($('#list-error'), error.message); }
}

// ---------- Форма товара ----------
function openForm(product) {
  editingId = product?.id ?? null;
  $('#dialog-title').textContent = product ? 'Изменить товар' : 'Новый товар';
  form.reset();
  const p = product ?? { stock: 0, weight: 0, active: true, image: '' };
  for (const name of ['title', 'category', 'summary', 'description', 'price', 'oldPrice', 'stock', 'weight']) {
    form.elements[name].value = p[name] ?? '';
  }
  form.elements.active.checked = p.active;
  photo = p.image ?? '';
  $('#photo-preview').src = imageUrl(photo);
  message($('#form-error'), '');
  dialog.showModal();
}

$('#add-product').addEventListener('click', () => openForm(null));
$('#cancel-dialog').addEventListener('click', () => dialog.close());

$('#photo-input').addEventListener('change', async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    const result = await api('api/upload', { method: 'POST', raw: file });
    photo = result.image;
    $('#photo-preview').src = imageUrl(photo);
    message($('#form-error'), '');
  } catch (error) { message($('#form-error'), error.message); }
  event.target.value = '';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const f = form.elements;
  const body = {
    title: f.title.value, category: f.category.value, summary: f.summary.value, description: f.description.value,
    price: f.price.value, oldPrice: f.oldPrice.value, stock: f.stock.value, weight: f.weight.value || 0,
    active: f.active.checked, image: photo,
  };
  try {
    await api(editingId ? `api/products/${editingId}` : 'api/products', { method: editingId ? 'PUT' : 'POST', body });
    dialog.close();
    await loadProducts();
  } catch (error) { message($('#form-error'), error.message); }
});

start();
