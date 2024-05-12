	function loadProducts(callback) {
	fetch('./js/products.json')
		.then(response => response.json())
		.then(data => callback(data))
		.catch(error => console.error('Ошибка загрузки файла JSON:', error));
}

function searchProducts(keyword) {
	loadProducts(function(products) {
		const results = products.filter(product => product.title.toLowerCase().includes(keyword.toLowerCase()));

		if (results.length > 0) {
			const searchResultsDiv = document.getElementById('searchResults');
			searchResultsDiv.innerHTML = ''; // очищение предидущих результатов 

			results.forEach(result => {
				const link = document.createElement('a');
				link.href = result.link; 
				link.textContent = result.title + ' - ' + result.price;
				link.classList.add('result-link');
				searchResultsDiv.appendChild(link);
			});

		} else {
			console.log('Товар не найден.');
		}
	});
}

document.getElementById('searchButton').addEventListener('click', function() {
	const keyword = document.getElementById('searchInput').value.trim().toLowerCase();
	if (keyword !== '') {
		searchProducts(keyword);
	} else {
		console.log('Введите ключевое слово для поиска.');
	}
});