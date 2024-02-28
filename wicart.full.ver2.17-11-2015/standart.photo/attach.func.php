<?
/********************************
 * Attachment picture to email
 *******************************/
 
function attachmentPicture($body, $header, $picture)
 		{
 		$boundary = md5(uniqid(time()));
 		
/*********************************
 * HEADERS 												
 ********************************/	
 		
 		$header .= 'Content-Type: multipart/mixed; boundary="part-'.$boundary.'"';		
 		
 		
 		print_r($header);

/*********************************
 * BODY 													
 ********************************/
 		
 		$bodyHTML = "\r\n--part-".$boundary."\r\n"
 							."Content-Type: text/html; charset=\"UTF-8\"\r\n"
 							."Content-Transfer-Encoding: 8bit\r\n\r\n"
 							.$body."\r\n";

/*********************************
 * PICTURE 												
 ********************************/ 							
 		
 		$file = file_get_contents($picture);
 		$code = chunk_split(base64_encode($file));
 		$filename = basename($picture);
 		echo $filename;
 		$pictureBlock = "--part-".$boundary."\r\n"	
 							."Content-Type: image/jpg; name=\"".$filename."\"\r\n"
  						."Content-Transfer-Encoding: base64\r\n"
  						."Content-ID: ".$filename."\r\n"
  						."Content-disposition: attachment; file=\"".$filename."\"\r\n"
  						."\r\n"
  						.$code
  						."\r\n--part-".$boundary."--\r\n"	;			 
		return array("body" => $bodyHTML.$pictureBlock, "header" => $header);
 		}


?>