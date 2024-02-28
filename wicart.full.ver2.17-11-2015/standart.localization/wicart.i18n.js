/******************************
 * i18n дополнение
 ******************************/
 
 function WICartLanguageRadio(lang)
 	{
 	$("#wicart-lang-" + lang).prop( "checked", true );
 	
 	$( ".wicart-lang" ).click(function() 
 		{
  		WICartReplace(wicartLocal, $(this).val() );
  		WICartFormPlaceholder(wicartLocal, $(this).val())
		});
 	
 	WICartReplace(wicartLocal, lang );
 	WICartFormPlaceholder(wicartLocal, lang)
 	}
 function WICartLanguageSelect(lang)
 	{
 	$("#wicart-lang [value='" + lang + "']").attr("selected", "selected");
 	$("#wicart-lang").change(function()
 		{
 		var lan = $("#wicart-lang option:selected").val();
 		WICartReplace(wicartLocal, lan );
  		WICartFormPlaceholder(wicartLocal, lan );	
 		});	
 	WICartReplace(wicartLocal, lang );
 	WICartFormPlaceholder(wicartLocal, lang)
 	} 	
 function WICartReplace(data, lang)
 	{
 	var words = data[lang];
 	
 	$.each(words, function(key,val) 
 		{             
          $( "lang[name='" + key + "']" ).html(val);
         	});
 	local = wicartLocal[lang];
 	console.log(local);
 	cart.init("basketwidjet", config);
 		
 	}	
function WICartFormPlaceholder(data, lang)
	{
	$("input[data-lang], textarea[data-lang]").each(
	function ()
		{
		var val =  data[lang][ $(this).data('lang') ];	
		$(this).attr("placeholder", val);	
		});
	
	
	} 	

var wicartLocal 	=	{
				"RU" :	{
						"city" : "Город",
						"username" : "Имя пользователя",
						"close" : "закрыть",
						"clear" : "Очистить",
						"basket_is_empty" : "Корзина пуста", 
						"name" : "Название",
						"price" : "Цена",
						"all" : "Всего",
						"order" : "Оформить заказ",
						"basket" : "корзина",
						"num" : "кол-во",
						"send" : "Спасибо за покупку!\nМы свяжемся с Вами в ближайшее время",
						"goods" : "Товаров",
						"amount" : "на сумму",
						"buy" : "купить",
						"rub" : "руб."
						},
				"EN" :	{
						"city" : "City",
						"username" : "User Name",
						"close" : "close",
						"clear" : "Clear",
						"basket_is_empty" : "Basket empty", 
						"name" : "Name",
						"price" : "Price",
						"all" : "All",
						"order" : "Order",
						"basket" : "Basket",
						"num" : "Num",
						"send" : "E-mail was send",
						"goods" : "Goods",
						"amount" : "amount",
						"buy" : "buy",
						"rub" : "rub."
						}		
			};					