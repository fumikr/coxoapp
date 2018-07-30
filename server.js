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
    scope: ['reactions:write','emoji:read','reactions:read','groups:history','groups:read','usergroups:read','incoming-webhook'] 
  },
  (accessToken, refreshToken, profile, done) => {
    // optionally persist user data into a database
    
    done(null, profile);
    
    var jwt = require('jwt-simple');
    var encoded = jwt.encode(accessToken, process.env.SECRET);
  
    User = { oauthID: profile.id,
              auth: encoded,
              name: profile.name,
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
app.get('/', function(request, response) {
  response.sendFile(__dirname + '/views/index.html');
  console.log(getUserId(request, response) + ' opened Index.html');
});

app.get('/login', function(request, response) {
  response.sendFile(__dirname + '/views/fail.html');
  console.log(getUserId(request, response) + ' opened fail.html');
});

// on clicking "logoff" the cookie is cleared
app.get('/logoff',
  function(request, response) {
    console.log(getUserId(request, response) + ' Logoff');  
    response.clearCookie('ezsfbmaster-passport');
    response.clearCookie('ezspassport');
    response.redirect('/');    
  }
);

app.get('/q', function(request, response) {
  response.sendFile(__dirname + '/views/main.html');
  console.log(getUserId(request, response) + ' opened main.html');
});

app.get('/how-to-use', function(request, response) {
  response.sendFile(__dirname + '/views/how-to-use.html');
  console.log(getUserId(request, response) + ' opened how-to-use.html');
});

app.get('/changelog', function(request, response) {
  response.sendFile(__dirname + '/views/changelog.html');
  console.log(getUserId(request, response) + ' opened changelog.html');
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
        if (isValidMember(res.team_id)) res.redirect('/logoff') 
        res.redirect('/setcookie') 
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
app.get('/setcookie', function(request, response) {
    console.log(getUserId(request, response) +  ' set Cookie');
      var OneYear = new Date(new Date().getTime() + (1000*60*60*24*365)); // ~1y
      response.cookie('ezsfbmaster-passport', new Date());
      response.cookie('ezspassport', User, { expires: OneYear });
      response.redirect('/success');
      console.log(getUserId(request, response) + ' sucessfully set cookie');
  }
);

// if cookie exists, success. otherwise, user is redirected to index
app.get('/success', function(req, res) {
    console.log(getUserId(req, res) + ' pass Success');
    if(req.cookies['ezspassport']) {
      if (getTokenFromCookie(req, res)) { res.redirect('/q'); }
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
    const result = await web.groups.history({channel: channel, count: count});
    if (!result.ok) {
      res.redirect(303, "Error(110): Slack上的「" + process.env.DEFAULT_SLACK_CHANNEL_NAME + "」Channel 讀取失敗!");
    } else {
      var messages = result.messages.reverse();
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
      console.log(getUserIdFromCookie(req, res) + ' proceeded message #' + (i) + '.');
    };
    res.send({ success: true, read_limit: count, obj: obj});
  } else {
    res.redirect(303, "Error(111): 無法找取read_limi");
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

function getUserId(req,res) {
  var id = 'Anonymous user';
  if (req.cookies.ezspassport) { 
    id = getUserIdFromCookie(req, res);
  }
  return id;
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