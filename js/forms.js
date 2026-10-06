import { profile } from './store.js';

// Форма: <form data-next="страница" data-save="поля,через,запятую">
const form = document.querySelector('form[data-next]');
const error = document.querySelector('#error');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));

  if (data.password && data.password2 !== undefined && data.password !== data.password2) {
    error.textContent = 'Пароли не совпадают';
    error.hidden = false;
    return;
  }

  // Пароли не сохраняем: бэкенда нет, это прототип.
  const saved = (form.dataset.save ?? '').split(',').filter(Boolean);
  profile.merge(Object.fromEntries(saved.map((key) => [key, data[key]])));
  location.href = form.dataset.next;
});
