$(document).ready(function() {  

    var dFormFetchData = $('#FetchForm');
  
    dFormFetchData.on('submit', function(e) {
      e.preventDefault();

      var dThisForm = $(this),
          action = dThisForm.attr('action');
            var data = dThisForm.serialize();
      console.log(data);
      
      getFetch(action, data);
    });
                      
    function getFetch(action, data) {      
      var $container = $('#container');      
      $.ajax({
        url: action,
        type: 'get',
        data: data,
        dataType: 'json',
        error: function (xhr) {
          alert('error: ' + xhr);
        },
        success: function (response) {
          if(response.success) {            
            var output ='';
            var nLiked = 0;
            for (var i= 0;  i < response.obj.length; i++) {
              var obj = response.obj[i];
              output += embedFB_ui(obj.ind, obj.url, obj.ts, obj.isliked);
              if (obj.isliked) { 
                nLiked++;
              }
            }
            $container.html('<h2>Found ' + response.obj.length + ' posts (' + nLiked + ' already liked)</h2>'+ output);
            (function(d, s, id) {
              var js, fjs = d.getElementsByTagName(s)[0];
              if (d.getElementById(id)) return;
              js = d.createElement(s); js.id = id;
              js.src = 'https://connect.facebook.net/zh_HK/sdk.js#xfbml=1&version=v3.1&appId=1146717015478341&autoLogAppEvents=1';
              fjs.parentNode.insertBefore(js, fjs);
            }(document, 'script', 'facebook-jssdk'));
            FB.XFBML.parse();
          } else {
            $container.html('There is a problem');
          }
        }
      });
    }
  
    dFormFetchData.submit(); 
    
});

// Formatting HTML output of Facbook embeeded posts
function embedFB_ui(i, url, ts, isliked) {  
  var htmltxt = [];
  
  const regex_fbid = /fbid=([0-9]+)/;
  const regex_id = /\Wid=([0-9]+)/;
  var res_fbid = regex_fbid.exec(url);
  var res_id = regex_id.exec(url);
  if (res_fbid && res_id) {
    var old_url = url;
    url = 'https://www.facebook.com/' + res_id[1] + '/posts/' + res_fbid[1];
  }
  console.log(url);
  url = url.replace('m.facebook.com', 'www.facebook.com');
  
  var encodedUrl = encodeURIComponent(url);
  
  if (isliked) { htmltxt += '<div class="fb-post liked-post">'; }
  else { htmltxt += '<div class="fb-post">'; }
  
  // Embed each facebook post
  var dataWidth = 500;
  if (screen.width < dataWidth) {
    dataWidth = screen.width;
  };
  //htmltxt += '<iframe class="fb-iframe" id="fb-iframe_' + i + '" src="https://www.facebook.com/plugins/post.php?href='+ encodedUrl + '&width=500&appId=' + process.env.FACEBOOK_APP_ID + '" width="500" height="500" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowTransparency="true" allow="encrypted-media"></iframe>';
  htmltxt += '<div class="fb-post" data-href="' + url +  '" data-width="' + dataWidth + '" data-show-text="true"></div>'
  //htmltxt += '<button class="enlarge" value="fb-iframe_' + i + '" type="submit">+</button>';
  
  // Display URL as caption
  htmltxt += '<br><a href="' + url + '" target="_blank">Open in Facebook</a>&nbsp;&nbsp;&nbsp;';
  // Display a correspending button
  htmltxt += '<button class="marks" id="markbtn' + i + '" type="submit" value="' + ts + '">Mark on Slack</button>';
  if (isliked){ htmltxt += ' <i class="fa fa-check-circle" style="color:green"></i>'; }
  htmltxt += '</div>';
  return htmltxt;
};

// OnClick Mark Like button
$(document).on("click", ".marks", function(e){  
   var btnId = $(this).attr('id');
   var ts = {ts :　$(this).val() };
   $.ajax({
      url: '/update',
      type: 'post',
      data: ts,
      dataType: 'json',
      error: function (xhr) {
        alert('error: ' + xhr);
      },
      success: function (response) {
        if(response.success) {
          $( "#"+btnId ).after(' <i class="fa fa-check-circle" style="color:green"></i>');
        } else {
          $( "#"+btnId ).after(' <i class="fa fa-times-circle" style="color:red"></i>');
        }
      }
    });

});

// OnClick Enlarge iframe
$(document).on("click", ".enlarge", function(e){  
    var iframeid = $(this).attr('value');
    var iframe = $('#' + iframeid);
    iframe.height(iframe.height() + 150);
})  

// Toggle Hide
$(document).on("click", "#hide", function(e){
    if ($(this).val() == 'false') {
      $('.liked-post').hide();
      $(this).val('true');
      $(this).html('Show Liked');
    }
    else {
      $('.liked-post').show();
      $(this).val('false');
      $(this).html('Hide Liked');
    }            
});