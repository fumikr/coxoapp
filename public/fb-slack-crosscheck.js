var hasLoadedFjs = false;
var currentChannel;

function checkLoginState() {
  FB.getLoginStatus(function(response) {
      $('#FetchForm').submit(); 
  });
}

$(document).ready(function() {
  
    (function(d, s, id) {
      var js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) return;
      js = d.createElement(s); js.id = id;
      js.src = 'https://connect.facebook.net/zh_HK/sdk.js#xfbml=1&version=v3.1&appId=1146717015478341&autoLogAppEvents=1';
      fjs.parentNode.insertBefore(js, fjs);
    }(document, 'script', 'facebook-jssdk'));
    hasLoadedFjs = true;

    var dFormFetchData = $('#FetchForm');
  
    dFormFetchData.on('submit', function(e) {
      e.preventDefault();

      var dThisForm = $(this),
          action = dThisForm.attr('action');
            var data = dThisForm.serialize();
      
      data += '&groupname=' + $("select#group option:selected").text();
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
            currentChannel = response.channel;
            var output ='<div class="content-container">';
            var nLiked = 0;
            var objLendth = response.obj.length;
            for (var i= 1;  i <= objLendth; i++) {
              var obj = response.obj[objLendth - i];
              output += embedFB_ui(obj.ind, obj.url, obj.ts, obj.isliked, obj.skin_tone);
              if (obj.isliked) { 
                nLiked++;
              }
            }
            output += '</div>'
            var hideBtn = '<!-- HIDE BUTTON --><button id="hide" value="false"></button>';
            var h2Html = '<h2>找到 ' + objLendth + ' Fb Posts (&nbsp;'+ hideBtn + ' '  + nLiked + ' 已讚好 )</h2>' ;            
            
            $container.html(h2Html + output);
            FB.XFBML.parse(document.getElementById('container'));
            showHideBtn();
            $('#hide').click();
          } else {
            console.log(response.error);
            $container.html('<h2>發生了一些問題！</h2><p>' + JSON.stringify(response.error));
          }
        }
      });
    }
    setTimeout(function() { 
      checkGroups();
      //dFormFetchData.submit(); 
    }, 3000);
});


function checkGroups() {
  $.ajax({
        url: '/checkgroups',
        type: 'get',
        data: '',
        dataType: 'json',
        error: function (xhr) {
          alert('error: ' + xhr);
        },
        success: function (response) {
          if(response.success) {
            if (response.channels.length > 0) {
              var groupSelect = $('select#group');
              $.each(response.channels, function(i, val){
                groupSelect.append(
                  $('<option></option>').val(val.id).html(val.name)
                );
              });
              $('#FetchForm').submit();
            } else {
              $('#container').html('<h2>發生了一些問題！</h2>' + '<h3>沒有Slack的存取權限，無法找到任何品牌修煉頻道。</h3>');
            }
          };
        }});
}

// Formatting HTML output of Facbook embeeded posts
function embedFB_ui(i, url, ts, isliked, skin_tone) {  
  var htmltxt = [];
  
  const regex_fbid = /fbid=([0-9]+)/;
  const regex_id = /\Wid=([0-9]+)/;
  var res_fbid = regex_fbid.exec(url);
  var res_id = regex_id.exec(url);
  if (url) {
    if (res_fbid && res_id) {
      var old_url = url;
      url = 'https://www.facebook.com/' + res_id[1] + '/posts/' + res_fbid[1];
    }
    url = url.replace('m.facebook.com', 'www.facebook.com');

    var encodedUrl = encodeURIComponent(url);

    if (isliked) { htmltxt += '<div class="post-shell liked-post">'; }
    else { htmltxt += '<div class="post-shell">'; }

    // Embed each facebook post
    var dataWidth = 500;
    if (screen.width < dataWidth) {
      dataWidth = screen.width;
    };
    htmltxt += '<div class="fb-post" data-href="' + url +  '" data-width="' + dataWidth + '" data-show-text="true"></div>'
    
    if (skin_tone){
       var emoji = 'thumbsup';
     } else {
       var emoji = 'thumbsup::skin-tone-2'; 
     };
    // Display URL as caption
    htmltxt += '<div class="shell-menu"><a href="' + url + '" target="_blank">在Facebook開啟</a>&nbsp;&nbsp;&nbsp;';
    // Display a correspending button
    htmltxt += '<button class="marks" id="markbtn' + i + '" type="submit" name="' + emoji + '" value="' + ts + '">標記到<i class="fa fa-slack"></i>slack</button>';
    if (isliked){ htmltxt += ' <i class="fa fa-check-circle" style="color:green"></i>'; }
    htmltxt += '</div></div>';
    return htmltxt;
  };
};

// OnClick Mark Like button
$(document).on("click", ".marks", function(e){  
   var btnId = $(this).attr('id');
   var ts = $(this).val();
   var emoji = $(this).attr('name');
   $.ajax({
      url: '/update_reactions',
      type: 'post',
      data: { ts: ts, channel: currentChannel, name: emoji },
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
      $(this).html('<i class="fa fa-eye-slash"></i>');
    }
    else {
      showHideBtn();
    }            
});

function showHideBtn() {
  $('.liked-post').show();
  var x = $('#hide');
  x.val('false');
  x.html('<i class="fa fa-eye">');
};