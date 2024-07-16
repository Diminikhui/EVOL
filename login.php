<?php
session_start();

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
$user_email = $_POST['email'];
$user_password = $_POST['password'];

// SQL-запрос для получения данных пользователя
$sql = "SELECT id, username, password FROM users WHERE email='$user_email'";
$result = $conn->query($sql);

if ($result->num_rows > 0) {
    // Получение данных пользователя
    $row = $result->fetch_assoc();
    if (password_verify($user_password, $row['password'])) {
        // Установка сессии
        $_SESSION['user_id'] = $row['id'];
        $_SESSION['username'] = $row['username'];
        
        echo "Добро пожаловать, " . $row['username'] . "!"; // Сообщение об успешном входе
        // Редирект на защищенную страницу (например, profile.php)
        header("Location: p");
        exit();
    } else {
        echo "Неверный пароль";
    }
} else {
    echo "Пользователь с таким email не найден";
}

$conn->close();
?>
