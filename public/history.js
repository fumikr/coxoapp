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
    
    dFormFetchData.submit();
  
    $("#HistoryTable").tablesorter({sortList: [[0,0]]}); 
});


function sortAdjacency(b, a) {
  return a.reaction_count - b.reaction_count;
}

function getFetch(action, data) {      
  var $container = $('#container');
  $container.html('<h2>正在從伺服器下載數據記錄，可能需要一分鐘處理，請稍候。</h2>');
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
        $container.html('');
        $container.append('<table id="HistoryTable" class="tablesorter"><col width="150"><col width="60"><thead><tr><th class="header">達人用戶</th><th class="header">發佈<br>帖數</th><th class="header">粉絲反應數目</th></tr></thead><tbody></tbody>');
        console.log(response);
        for (var i= 0;  i < response.users.length; i++) {
          var user = response.users[i];
          var adjacency = Object.values(user.adjacency);
          var fanList = '';
          adjacency.sort(sortAdjacency);
          for (var j in adjacency) {
             fanList += '<div class="fans-tag"><img src="' + adjacency[j].avatar + '" title="' 
               + adjacency[j].name +'">' + adjacency[j].reaction_count + '</div>'; 
          };
          $('#HistoryTable > tbody').append('<tr><td><img src="' 
                                            + user.avatar + '"><br>' 
                                            + user.name + '</a></td><td>' 
                                            + user.num_of_posts + '</td><td><div class="flex-wrap">'
                                            + fanList + '</div></td></tr>');
        };
        $("#HistoryTable").tablesorter({sortList: [[0,0]]}); 
      } else {
        $container.html('<h2>There is a problem</h2><p>');
      };
    }
  });
};

function sortTable() {
  var table, rows, switching, i, x, y, shouldSwitch;
  table = document.getElementById("HistoryTable");
  switching = true;
  /*Make a loop that will continue until
  no switching has been done:*/
  while (switching) {
    //start by saying: no switching is done:
    switching = false;
    rows = table.getElementsByTagName("TR");
    /*Loop through all table rows (except the
    first, which contains table headers):*/
    for (i = 1; i < (rows.length - 1); i++) {
      //start by saying there should be no switching:
      shouldSwitch = false;
      /*Get the two elements you want to compare,
      one from current row and one from the next:*/
      x = rows[i].getElementsByTagName("TD")[0];
      y = rows[i + 1].getElementsByTagName("TD")[0];
      //check if the two rows should switch place:
      if (x.innerHTML.toLowerCase() > y.innerHTML.toLowerCase()) {
        //if so, mark as a switch and break the loop:
        shouldSwitch = true;
        break;
      }
    }
    if (shouldSwitch) {
      /*If a switch has been marked, make the switch
      and mark that a switch has been done:*/
      rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
      switching = true;
    }
  }
}