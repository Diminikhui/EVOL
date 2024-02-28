/************************************
 * Дополнение к WICart
 * Обциональный выбор товара
 * кнопка должна иметь ID = wicartbutton_{ID-товара}
 * поле цена ID wicartprice_{ID-товара}
 ************************************/

 	function WICartOptionalRadio(cartName, selectClass, Num)
 		{
 		$("input[type=radio]." + selectClass).each(function() 
 				{
 				var goodID = $(this).data("good-id");
 				var goodPrice = $(this).val();
 				var goodSubID = $(this).data("subid");
 				var goodSubName = $(this).attr("name");
 				var goodOptionName = $(this).data("option-name");
 				
 				if ( $(this).is(":checked") )
 					{
 					WICartUpdatePriceList(goodID, goodPrice, goodSubName, goodSubID, goodOptionName);	
 					}
 				
 				$(this).bind("click", function(e) 
 						{
 						WICartUpdatePriceList(goodID, goodPrice, goodSubName, goodSubID, goodOptionName);
 						});
 				});
 		}
 	function WICartOptionalSelect(cartName, selectClass, Num)
 		{
 		$("select." + selectClass).each(function() 
 				{
 				var goodID = $(this).data("good-id");
 				var goodPrice = $(this).val();
 				var goodSubID = $(this).find('option:selected').data("subid");
 				var goodSubName = $(this).attr("name");
 				var goodOptionName = $(this).find('option:selected').data("option-name");	
 				
 				$(this).bind("change", function(e) 
 						{
 						goodID = $(this).data("good-id");	
 						goodPrice = $(this).val();
 						goodSubID = $(this).find('option:selected').data("subid");
 						goodSubName = $(this).attr("name");
 						goodOptionName = $(this).find('option:selected').data("option-name");	
 						
 						WICartUpdatePriceList(goodID, goodPrice, goodSubName, goodSubID, goodOptionName);	
 						});
 				WICartUpdatePriceList(goodID, goodPrice, goodSubName, goodSubID, goodOptionName);
 				});	
 		}	
 	function WICartUpdatePriceList(goodID, goodPrice, goodSubName, goodSubID, goodOptionName)
 		{
 		$("#wicartprice_" + goodID).html(goodPrice);
 		priceList[goodID].price = goodPrice;
 		priceList[goodID].subid[goodSubName + "_id"] = goodSubID; 
 		priceList[goodID].subid[goodSubName + "_name"] = goodOptionName; 	
 		} 	
 	function WICartObjToString(obj, postfix, seporator)
 		{
 		var str = "";	
 		console.log(obj);
 		$.each(obj, function(index, value) 
 			{
 			if ( index.substr( -(postfix.length) ) == postfix)
 				{	
    				str += seporator + value;
    				}
			});	
			
 		return str;
 		}	
 	