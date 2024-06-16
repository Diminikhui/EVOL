// account.js

document.getElementById('register-form').addEventListener('submit', function(event) {
	event.preventDefault();

	const email = document.getElementById('register-email').value;
	const password = document.getElementById('register-password').value;

	// Здесь вы можете добавить AJAX-запрос для регистрации пользователя
	// Например, отправить данные на сервер

	alert('Регистрация прошла успешно!');
});

document.getElementById('login-form').addEventListener('submit', function(event) {
	event.preventDefault();

	const email = document.getElementById('login-email').value;
	const password = document.getElementById('login-password').value;

	// Здесь вы можете добавить AJAX-запрос для авторизации пользователя
	// Например, отправить данные на сервер и проверить их

	alert('Авторизация прошла успешно!');
});
