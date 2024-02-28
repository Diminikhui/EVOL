var wibutton_id_prefix = "wicartbutton";
var wibasketwidjet_id = "basketwidjet";
var wicartprice_id_prefix = "wicartprice";

$( document ).ready(function() 
{
/*** INIT ***/	
$("body").append("<div style='position: absolute; font: bold 20px Arial;' id='wibird'></div>");
var wibird = $("#wibird");
wibird.offset({ top: -300, left: -300});		
/*************/
    
$("[id*='" + wibutton_id_prefix + "']").each(function() 
	{
    	$( $(this) ).bind( "click", function() 
   		{
  		var buy_button = $(this).attr("id");
    		var good_id = buy_button.substr(buy_button.indexOf("_") + 1);
    		
    		var pos = $(this).position();	
    		wibird.offset({ top: pos.top, left: pos.left});
    		var price = $("#" + wicartprice_id_prefix + "_" + good_id).html();
    		wibird.html(price);
    		
    		var basket_pos = $("#" + wibasketwidjet_id).offset();
    		wibird.animate(
				{
				'left': basket_pos.left, 
				'top': basket_pos.top 
				}
				,
				{
				'duration': 500, 
				complete:  function() 
					{ 
					wibird.offset({ top: -300, left: -300});
					}
				});
    		
		});
	});
    
});