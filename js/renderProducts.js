const productsContainer = document.querySelector('#products-container');

// Запускаем getProducts
getProducts();

// Асинхронная функция получения данных из файла products.json
async function getProducts() {
	const response = await fetch('./js/products.json');
	const productsArray = await response.json();
	renderProducts(productsArray);
	addFilterEventListeners(productsArray);
}

function renderProducts(productsArray) {
	productsContainer.innerHTML = '';
	productsArray.forEach(function (item) {
		const productHTML = `<div class="col-md-6">
			<div class="card mb-4 tovar" data-id="${item.id}">
				<img class="product-img" src="img/roll/${item.imgSrc}" alt="">
				<div class="card-body text-center">
					<h4 class="item-title">${item.title}</h4>
					<p><small data-items-in-box class="text-muted">${item.itemsInBox}.</small></p>

					<div class="details-wrapper">
						<div class="items counter-wrapper">
							<div class="items__control" data-action="minus">-</div>
							<div class="items__current" data-counter>1</div>
							<div class="items__control" data-action="plus">+</div>
						</div>

						<div class="price">
							<div class="price__weight">${item.weight}кг</div>
							<div class="price__currency">${item.price} ₽</div>
						</div>
					</div>

					<button data-cart type="button" class="btn btn-block btn-outline-warning">
						В корзину
					</button>
				</div>
			</div>
		</div>`;
		productsContainer.insertAdjacentHTML('beforeend', productHTML);
	});
}

function addFilterEventListeners(productsArray) {
	document.querySelectorAll('.filter-buttons button').forEach(button => {
		button.addEventListener('click', () => {
			const filterId = button.getAttribute('data-filter');
			const filteredProducts = filterProducts(productsArray, filterId);
			renderProducts(filteredProducts);
		});
	});
}

function filterProducts(productsArray, filterId) {
	return productsArray.filter(product => product.id == filterId);
}
