<?php
// Подключение к базе данных
$servername = "localhost";
$username = "root";
$password = "";
$dbname = "evol";

$conn = new mysqli($servername, $username, $password, $dbname);

// Проверка соединения
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Получение данных формы
$user_username = $_POST['username'];
$user_email = $_POST['email'];
$user_password = password_hash($_POST['password'], PASSWORD_DEFAULT); // Хеширование пароля

// SQL-запрос для вставки данных
$sql = "INSERT INTO users (username, email, password) VALUES ('$user_username', '$user_email', '$user_password')";

if ($conn->query($sql) === TRUE) {
    echo "Регистрация прошла успешно";
} else {
    echo "Ошибка: " . $sql . "<br>" . $conn->error;
}

$conn->close();
?>
