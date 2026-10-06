import { profile, addresses } from './store.js';
import { isServer, request, safeNext } from './backend.js';

// Форма: <form data-next="страница" data-save="поля,через,запятую" [data-api="login|register"]>
const form = document.querySelector('form[data-next]');
const error = document.querySelector('#error');
const button = form.querySelector('button[type=submit]');

const fail = (message) => { error.textContent = message; error.hidden = false; };

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.hidden = true;
  const data = Object.fromEntries(new FormData(form));

  if (data.password && data.password2 !== undefined && data.password !== data.password2) {
    return fail('Пароли не совпадают');
  }

  const api = form.dataset.api;
  if (api && isServer) {
    const next = api === 'login' ? safeNext(new URLSearchParams(location.search).get('next'), form.dataset.next) : form.dataset.next;
    button.disabled = true;
    try {
      const body = api === 'login'
        ? { login: data.login, password: data.password }
        : { name: data.name, phone: data.phone, password: data.password };
      const user = await request(`api/${api}`, { method: 'POST', body });
      // Сотрудников ведём сразу в их рабочие панели.
      if (user.role === 'admin') return void (location.href = 'admin.html');
      if (user.role === 'staff' || user.role === 'courier') return void (location.href = 'staff.html');
      location.href = next;
    } catch (e) {
      button.disabled = false;
      fail(e.message);
    }
    return;
  }

  // Демо-режим без сервера. Пароли не сохраняем.
  const saved = (form.dataset.save ?? '').split(',').filter(Boolean);
  profile.merge(Object.fromEntries(saved.map((key) => [key, data[key]])));
  if (form.dataset.address !== undefined && data.street) {
    addresses.add({ city: data.city, street: data.street, flat: data.flat, floor: data.floor,
      intercom: data.intercom, comment: data.comment });
  }
  location.href = form.dataset.next;
});
