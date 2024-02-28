/************************************
 * Дополнение к WICart
 * Обциональный выбор товара
 * кнопка должна иметь ID = wicartbutton_{ID-товара}
 * поле цена ID wicartprice_{ID-товара}
 ************************************/

var WICartOptionTotalPrice = {};

function WICartOptional(cartName, selectClass, Num)
        {
        // Установка базовых цен.
        WICartOptionalInit();
       
                
        // устанавливаем события
        $("input[type=radio]." + selectClass).each(function()
                {
                $(this).click(function(e)
                        {
                        WICartOptionalInit();
                        WICartOptionalRadio(selectClass);
                        WICartOptionalSelect(selectClass);
                        WICartOptionalTotalSum();
                        });
                });
        $("select." + selectClass).each(function()
                {
                $(this).change(function(e)
                        {
                        WICartOptionalInit();
                        WICartOptionalRadio(selectClass);
                        WICartOptionalSelect(selectClass);
                        WICartOptionalTotalSum();
                        });
                        	
                });

        WICartOptionalRadio(selectClass);
        WICartOptionalSelect(selectClass);
        WICartOptionalTotalSum();
        console.log(WICartOptionTotalPrice);
        console.log(priceList);
        }

function WICartOptionalInit()
	{
        $.each(priceList, function(index, item)
                {
                $("#wicartprice_" + index).html( item.price );
                WICartOptionTotalPrice[index] = parseFloat(item.price);
                });
         }       

        
function WICartOptionalRadio(selectClass)
        {

        $("input[type=radio]." + selectClass).each(function()
                {
                if ( $(this).is(":checked") )
                        {
                        var goodID = $(this).data("good-id");
                        var goodPrice = $(this).val();
                        var goodSubID = $(this).data("subid");
                        var goodSubName = $(this).attr("name");
                        var goodOptionName = $(this).data("option-name");

                        WICartOptionalTotalPrice(goodID, goodPrice, goodSubID, goodSubName, goodOptionName);
                        }

                });

        }
function WICartOptionalSelect(selectClass)
        {
        $("select." + selectClass).each(function()
                {
                var goodID = $(this).data("good-id");
                var goodPrice = $(this).val();
                var goodSubID = $(this).find('option:selected').data("subid");
                var goodSubName = $(this).attr("name");
                var goodOptionName = $(this).find('option:selected').data("option-name");
                
                WICartOptionalTotalPrice(goodID, goodPrice, goodSubID, goodSubName, goodOptionName);
                });

        }
function WICartOptionalTotalPrice(goodID, goodPrice, goodSubID, goodSubName, goodOptionName)
	{
	
	WICartOptionTotalPrice[goodID] += (WICartOptionTotalPrice[goodID]) ? parseFloat( goodPrice ) : 0;
	priceList[goodID].subid[goodSubName + "_id"] = goodSubID; 
 	priceList[goodID].subid[goodSubName + "_name"] = goodOptionName; 	
	
	}
function WICartOptionalTotalSum()
	{
	$.each(priceList, function(index, item)
                {
                var totalPrice =  WICartOptionTotalPrice[index];	
                $("#wicartprice_" + index).html( totalPrice );
                priceList[index].totalprice = totalPrice;
                });	
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