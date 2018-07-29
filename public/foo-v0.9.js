//<script type="text/javascript">
   // Fetch 品牌修煉

   function ezsfbmaster(){
       
       var CLIENT_ID=""
       var SECRET=""
       var TOKEN=""
       var DEFAULT_CHANNEL_ID="G8CF3QA05"
       var DEFAULT_CHANNEL_NAME="品牌修煉"

       var LIMIT="20"
       var FBAppId="1005483426258050"
       
       var CLIENT = function(id){
         function setId(id) {
             CLIENT_ID = id;
         }
         function setSecretId(sid) {
             SECRET = sid;
         }          
         function setToken(tok) {
             TOKEN = tok;
         }
         function getId(id) {
             return CLIENT_ID;
         }
         function getSecretId(sid) {
             return SECRET;
         }          
         function getToken(tok) {
             return TOKEN;
         }
       }       
   }

   function getslackchannel(client, userId) {
       $.getJSON("https://slack.com/api/groups.history?token=" + client.getToken() + "&channel=" + client.DEFAULT_CHANNEL_ID + "&count=" + client.LIMIT + "&pretty=1", function(result, status){
           
           if (status != "success") {
               $("#warning").html("Error(110): Slack上的「" + client.DEFAULT_CHANNEL_NAME + "」Channel 讀取失敗!");
           } else {
               var listing = result["messages"];
               $.each(listing.reverse(), function(i, key){
                   if (key.hasOwnProperty('attachments')){      	
                       var obj = key.attachments;
                       var url = obj[0].original_url;
                     
                       // check if the post has aleary marked on Slack
                       var isliked = false;
                       if (key.hasOwnProperty('reactions')){                   
                           var likedusers = key.reactions[0].users;                           
                           $.each(likedusers, function(r, uid) {                        
                             if (uid == userId) { isliked = true; }                                
                           });
                       }
                   embedFB_ui(client, i, url, key.ts, isliked);
               }});
               // Display the REST GET status
               $("#status").append("\nStatus: " + status);
           }
       })
   };

      
   function embedFB_ui(client, i, url, ts, isliked) {          
       var encodedUrl = encodeURIComponent(url);
       // Embed each facebook post
       $("#output").append('<iframe src="https://www.facebook.com/plugins/post.php?href='+ encodedUrl + '&width=500&show_text=true&appId=' + client.FBAppId + '&height=496" width="500" height="496" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowTransparency="true" allow="encrypted-media"></iframe>')
       // Display URL as caption
       $("#output").append('<br><a href="' + url + '" target="_blank">' + url + '</a><br>');
       // Display a correspending button
       $("#output").append('<button class="marks" id="markbtn' + i + '" type="submit" value="' + ts + '">Mark on Slack</button>');
       if (isliked){ $("#output").append(' <i class="fa fa-check-circle" style="color:green"></i>'); }
       $("#output").append('<br><hr><br>');
   };

   // OnClickEvent - Mark Liked on Slack
       $(document).on("click", ".marks", function(e,client){

           var btnId = $(this).attr('id');
           alert(btnId)
           $.post("https://slack.com/api/reactions.add",
               { 
                   token : client.getTken,
                   name : "thumbsup",
                   channel : client.DEFAULT_CHANNEL_ID,
                   timestamp : $(this).val(),
                   pretty : "1"            
               },
               function(data,status){
                   if (status == "success") {
                         alert("Data: " + data + "\nStatus: " + status);
                         $( "#"+btnId ).after(' <i class="fa fa-check-circle" style="color:green"></i>');
                   } else {
                         $( "#"+btnId ).after(' <i class="fa fa-times-circle" style="color:red"></i>');
                   }}
           )
       });


//</script>