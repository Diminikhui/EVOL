function displayProductInfo(productId) {
	fetch('./js/products.json')
		.then(response => response.json())
		.then(data => {
			const product = data.find(item => item.id === productId);
			if (product) {
				// Отображаем информацию о продукте на странице
				const productInfo = document.createElement('div');
				productInfo.innerHTML = `
					<h2>${product.title}</h2>
					<p>Цена: ${product.price}</p>
					<p>Описание: ${product.description}</p>
				`;
				document.body.appendChild(productInfo);
			} else {
				console.log('Продукт с указанным ID не найден.');
			}
		})
		.catch(error => console.error('Ошибка загрузки файла JSON:', error));
}

// Вызываем функцию для отображения информации о продукте с ID = 1 (вы можете указать нужный ID)
displayProductInfo(1);


