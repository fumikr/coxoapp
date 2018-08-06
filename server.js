// server.js
// where your node app starts

// create a user model
var User = {
  oauthID: '',
  auth: '',
  name: '',
  created: ''
};

var FbPassport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;

FbPassport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: 'https://'+process.env.PROJECT_DOMAIN+'.glitch.me/auth/facebook/callback',
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(accessToken);
    console.log(profile);
    return cb(null, profile);
  }
));

var SlackPassport = require('passport');
var SlackStrategy = require('passport-slack-oauth2').Strategy;

SlackPassport.use(new SlackStrategy({
    clientID: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_SECRET,
    skipUserProfile: false, // default
    callbackURL: 'https://'+process.env.PROJECT_DOMAIN+'.glitch.me/auth/slack/callback',
    scope: ['reactions:write','reactions:read','groups:history','groups:read','incoming-webhook'] 
  },
  (accessToken, refreshToken, profile, done) => {
    // optionally persist user data into a database
    
    done(null, profile);
    
    var jwt = require('jwt-simple');
    var encoded = jwt.encode(accessToken, process.env.SECRET);
  
    User = { oauthID: profile.id,
              auth: encoded,
              name: profile.displayName,
              created: Date.now() }
    console.log(profile);
  }
));

SlackPassport.serializeUser(function(user, done) {
  console.log(user);
  done(null, user);
});
SlackPassport.deserializeUser(function(obj, done) {
  done(null, obj);
});

// init project
var express = require('express');
var app = express();
var expressSession = require('express-session');

// cookies are used to save authentication
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');

// http://expressjs.com/en/starter/static-files.html
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(express.static('public'));
app.use(expressSession({ secret:'observingboats', resave: true, saveUninitialized: true, maxAge: (90 * 24 * 3600000) }));
app.use(SlackPassport.initialize());
app.use(SlackPassport.session());

// index route
// http://expressjs.com/en/starter/basic-routing.html
app.get('/', function(req, res) {
  res.sendFile(__dirname + '/views/index.html');
  console.log(getUserInfo(req, res) + ' opened index.html');
});

app.get('/login', function(req, res) {
  res.sendFile(__dirname + '/views/fail.html');
  console.log(getUserInfo(req, res) + ' opened fail.html');
});

app.get('/fail', function(req, res) {
  res.sendFile(__dirname + '/views/fail.html');
  console.log(getUserInfo(req, res) + ' opened fail.html');
});

// on clicking "logoff" the cookie is cleared
app.get('/logoff',
  function(req, res) {
    console.log(getUserInfo(req, res) + ' Logoff');  
    res.clearCookie('ezsfbmaster-passport');
    res.clearCookie('ezspassport');
    res.redirect('/');    
  }
);

app.get('/start', function(req, res) {
  res.sendFile(__dirname + '/views/main.html');
  console.log(getUserInfo(req, res) + ' opened main.html');
});

app.get('/how-to-use', function(req, res) {
  res.sendFile(__dirname + '/views/how-to-use.html');
  console.log(getUserInfo(req, res) + ' opened how-to-use.html');
});

app.get('/changelog', function(req, res) {
  res.sendFile(__dirname + '/views/changelog.html');
  console.log(getUserInfo(req, res) + ' opened changelog.html');
});

app.get('/auth/facebook', FbPassport.authenticate('facebook'));

app.get('/auth/facebook/callback', 
  SlackPassport.authenticate('facebook', { failureRedirect: '/login', session: false }),
    (req, res) => res.redirect('/setcookie') 
);

app.get('/auth/slack', SlackPassport.authorize('Slack'));

app.get('/auth/slack/callback', 
  SlackPassport.authenticate('Slack', { failureRedirect: '/login', session: false }),
    (req, res) => {
        console.log('slack callback')
        if (!isValidMember(req.user.team.id)) res.redirect('/logoff') 
         else res.redirect('/setcookie') ;
        
  }
);


function isValidMember(teamId){
  if ( teamId == process.env.DEFAULT_SLACK_TEAM_ID) {
     return true;
  }
  return false;
}

// on successful auth, a cookie is set before redirecting
// to the success view
app.get('/setcookie', function(req, res) {
    console.log(getUserInfo(req, res) +  ' set Cookie');
      var OneYear = new Date(new Date().getTime() + (1000*60*60*24*365)); // ~1y
      res.cookie('ezsfbmaster-passport', new Date());
      res.cookie('ezspassport', User, { expires: OneYear });
      res.redirect('/success');
      console.log(getUserInfo(req, res) + ' sucessfully set cookie');
  }
);

// if cookie exists, success. otherwise, user is redirected to index
app.get('/success', function(req, res) {
    console.log(getUserInfo(req, res) + ' pass Success');
    if(req.cookies['ezspassport']) {
      if (getTokenFromCookie(req, res)) { res.redirect('/start'); }
      else {
        res.redirect('/');
      }
    } else {
      res.redirect('/');
    }
  }
);

app.get('/exec', function(req, res) {
  asyncFetch(req, res); 
});

async function asyncFetch(req, res) {    
  var count = req.query.read_limit;
  console.log('read_limit: ' + count);
  if(count) {
    var token = getTokenFromCookie(req, res);
    var channel = process.env.DEFAULT_SLACK_CHANNEL_ID;     
    const { WebClient } = require('@slack/client');    
    const web = new WebClient(token);
    var obj = [];
    try {
      const result = await web.groups.history({channel: channel, count: count});
      if (!result.ok) {
        throw new Error('Error(110) Failed to fetch history of messages and events from a private channel.');
      } else {
        var messages = result.messages;
        for (var i = 0 ; i < messages.length; i++) {
          var message = messages[i];
          if (message.hasOwnProperty('attachments')){          
            var ts = message.ts;
            var url = message.attachments[0].original_url;

            // check if the post has aleary marked on Slack
            var isliked = false;
            var userId = getUserIdFromCookie(req, res);
            if (message.hasOwnProperty('reactions')){                   
              for (var j in message.reactions) {
                var likedusers = message.reactions[j].users;                           
                for (var k in likedusers) {
                  var uid = likedusers[k];
                  if (uid == userId) { isliked = true; break;}                                
                };
                if (isliked) { break; }
              };
            }; 
            obj.push({ind: i, url: url, ts: ts, isliked: isliked})
          };
          //output += i+1 + ". ts: " + ts + ", url: " + url + ", isliked: " + isliked + ";<br>"
        };
        console.log(getUserInfo(req, res) + ' proceeded message #' + (i) + '.');
      };
      res.send({ success: true, read_limit: count, obj: obj});
    } catch(err) {
      res.send({ success: false , error: err + '<br>你可以沒有該 Slack Channel 的讀取權限!<br>請先參加「品牌修煉」的講座及工作坊'});
      console.warn('Error(111): 沒有該Slack Channel 的讀取權限! \n' + err)
    }
  } else {
    res.redirect(303, "Error(112): 無法找取read_limit");
    console.warn("Error(112): 無法找取read_limit\n" + req.query)
  }  
};

// listen for requests :)
var listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});

function getTokenFromCookie(req, res) {
  //console.log('Cookies: ', req.cookies);
  var xToken = req.cookies.ezspassport.auth;
  if (xToken.startsWith("xoxp-")) { 
    return xToken;
  } else {
    var jwt = require('jwt-simple');
    var decoded = jwt.decode(xToken, process.env.SECRET); 
    if (decoded.startsWith("xoxp-")) {
      return decoded;
    }
    return false;
  }
}

function getUserIdFromCookie(req, res) {
  //console.log('Cookies: ', req.cookies);
  var id = req.cookies.ezspassport.oauthID;
  return id;
}

function getUserNameFromCookie(req, res) {
  //console.log('Cookies: ', req.cookies);
  var id = req.cookies.ezspassport.name;
  return id;
}

function getUserInfo(req,res) {
  var id = 'Anonymous';
  var name = ' user';
  if (req.cookies.ezspassport) { 
    id = getUserIdFromCookie(req, res);
    name = getUserNameFromCookie(req, res);
  }
  return id + ' ( ' + name + ' )';
}

// POST method called by Mark Like buttons
app.post('/update', function(req, res) {
  onClickBtn(req, res); 
});

// OnClickEvent - Mark Liked on Slack
async function onClickBtn(req, res) {    
  var ts = req.body.ts;
  //console.log('ts: ' + ts);
  if(ts) {
    var token = getTokenFromCookie(req, res);
    var channel = process.env.DEFAULT_SLACK_CHANNEL_ID;     
    const { WebClient } = require('@slack/client');    
    const web = new WebClient(token);
    try {
      const result = await web.reactions.add({channel: channel, timestamp: ts, name : 'thumbsup'});
      //console.log(result)
      if (!result.ok) {
        console.log("Error(120): Slack上的「" + process.env.DEFAULT_SLACK_CHANNEL_NAME + "」Channel 讀取失敗!");
      } else {      
          res.send({ success: true, status: result.acceptedScopes});
      }
    } catch(err) {
            console.log(err);
        if (err.data.hasOwnProperty('error')){
          console.log(err.data.error);
          res.send({ success: true });
        } else {
          res.send({ success: false });
        };
    }
  }
}; 

// init sqlite db
var fs = require('fs');
var dbFile = './.data/sqlite.db';
var exists = fs.existsSync(dbFile);
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(dbFile);

app.get('/getMemberList', function(req, res) {
  asyncFetchMemberAvatar(req, res);
});

async function asyncFetchMemberAvatar(req, res) {
  
  var token = process.env.SLACK_TOKEN;
  var channel = process.env.DEFAULT_SLACK_CHANNEL_ID;     
  const { WebClient } = require('@slack/client');    
  const web = new WebClient(token);
  
  var memberlist = [];
  const gInfo = await web.groups.info({channel: channel});
  if (!gInfo.ok) {
    throw new Error('Error(130) Failed to get information about a private channel.')
  } else {
    var members = gInfo.group.members;
    for (var m in members){
      const uInfo = await web.users.info({user: members[m]}); 
      if (!uInfo.ok) {
         throw new Error('Error(133) Failed to get information about a user.')
      }
      memberlist[m] = { [members[m]] : {avatar: uInfo.user.profile.image_32,
                           name: uInfo.user.real_name}};
      write2db(members[m], uInfo.user.real_name, uInfo.user.profile.image_32);

    }   
    res.send(members);
    console.log('Database "Members" ready to go!');
    db.each('SELECT * from Members', function(err, row) {
      if ( row ) {
        console.log('record:', row);
      }
    });
  };  
};

var r = false;
function write2db(uid, name, avatar) {
  // if ./.data/sqlite.db does not exist, create it, otherwise print records to console
  db.serialize(function(){
    console.log(exists)
    if (!r) {
      db.run('CREATE TABLE Members (uid TEXT, name TEXT, avatar TEXT);');
      console.log('New table Members created!');
      r = true;
    }
    else {
      
      db.serialize(function() {
          db.run('INSERT INTO Members (uid, name, avatar) VALUES ("' 
                 + uid + '", "' + name + '", "'
                 + avatar +'" );');
      });
    }
  });
};


//
app.get('/history', function(req, res) {
  res.sendFile(__dirname + '/views/history.html');
  console.log(getUserInfo(req, res) + ' opened history.html');
});

app.get('/getHistory', function(req, res) {
  asyncFetchHistory(req, res); 
});

var sqlite = require('sqlite-sync'); //requiring
sqlite.connect(dbFile); 

function getNameAvatar(uid) {
   return sqlite.run('SELECT name name, avatar avatar FROM Members WHERE uid = ?', [uid]); 
}

async function asyncFetchHistory(req, res) {    
  var nDays = req.query.num_of_days;
  console.log('num_of_days: ' + nDays);
  var tsLast = new Date().getTime();
  var tsFirst = new Date(tsLast-86400000*nDays);
    tsFirst.setHours(0);
    tsFirst.setMinutes(0);
    tsFirst.setSeconds(0);
    tsFirst.setMilliseconds(0);
  
  var token = process.env.SLACK_TOKEN;
  var channel = process.env.DEFAULT_SLACK_CHANNEL_ID;     
  const { WebClient } = require('@slack/client');    
  const web = new WebClient(token);
  
  
  var data = sqlite.run('SELECT * FROM Members');
  var members = [];
  for (var d in data) {
    var datum = data[d];
    members[datum.uid] = {name: datum.name, avatar: datum.avatar} ;
  }
  
  var users = [];
  var has_more = true;
  //console.log(members);
  while(has_more) {
    try {
      const result = await web.groups.history({channel: channel, 
                                               count: 1000, 
                                               latest: tsLast, 
                                               oldest: JsDate2SlackTs(tsFirst)});
      if (!result.ok) {
        throw new Error('Error(131) Failed to fetch history of messages and events from a private channel.');
      } else {
        console.log('Start Fetch History');
        var messages = result.messages;
        for (var i = 0 ; i < messages.length; i++) {
          var message = messages[i];
          if (message.hasOwnProperty('attachments')){          
            if (message.attachments[0].original_url.includes('.facebook.com')){
              const uid = message.user;
              var UserNotFound = true;
              
              if (!users.hasOwnProperty(uid)) {
                //console.log(uid);
                users[uid] = {avatar: members[uid].avatar, 
                            name: members[uid].name, num_of_posts: 1, adjacency: {}};
              } else {
                users[uid].num_of_posts++;
              };
              
              if (message.hasOwnProperty('reactions')){                   
                var likelist = [];
                for (var j in message.reactions) {
                  var likedusers = message.reactions[j].users;
                  for (var k in likedusers) {
                    likelist[likedusers[k]] = likedusers[k];
                  }
                };
                for (var m in likelist) {
                   var liker = likelist[m];
                   if (!users[uid].adjacency[liker]) {
                     //console.log('New adjacency')
                     users[uid].adjacency[liker] = {
                                     avatar: members[liker].avatar,
                                     name: members[liker].name,
                                     reaction_count: 0};
                   }
                   users[uid].adjacency[liker].reaction_count++;
                };                  
              }; 
              //console.log(users[uid].adjacency);
            };
          };
        };
        if (result.has_more) {
          tsLast = messages[messages.length-1].ts;
        } else {
          has_more = false;
        }
      };
    } catch(err) {
      res.send({ success: false , error: err + '<br>你可以沒有該 Slack Channel 的讀取權限!<br>請先參加「品牌修煉」的講座及工作坊'});
      console.warn('Error(131): 沒有該Slack Channel 的讀取權限! \n' + err)
    }
  };
  //console.log(users);
  res.send({success: true, users: Object.values(users)});
};

function JsDate2SlackTs(d) {
   return d/1000;
}

function SlackTs2JsDate(ts) {
   return ts*1000;
}

