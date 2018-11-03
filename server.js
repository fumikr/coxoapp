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
    //state: 'aabbCCddeeFF',
    callbackURL: 'https://'+process.env.PROJECT_DOMAIN+'.glitch.me/auth/slack/callback',
    scope: ['reactions:write','reactions:read','groups:history','groups:read','incoming-webhook'] 
  },
  (accessToken, refreshToken, profile, done) => {
    // optionally persist user data into a database
    
    done(null, profile);
    
    var jwt = require('jwt-simple');
    var encoded = jwt.encode(accessToken, process.env.SECRET);
  
    User = {  oauthID: profile.id,
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
  logUserPageView(req, res, 'open /')
  if (req.cookies.ezspassport) {
    res.redirect('/start');
  } else {
    logUserPageView(req, res, 'open index.html');
    res.sendFile(__dirname + '/views/index.html');
  }
});

// routing to Fans Analysis Assistant
app.get('/analytics', function(req, res) {
  logUserPageView(req, res, 'open /analytics');
  if (validLogin(req, res)) {
    logUserPageView(req, res, 'open analytics.html');
    res.sendFile(__dirname + '/views/analytics.html');
  };
});

app.get('/auth/facebook', FbPassport.authenticate('facebook'));

app.get('/auth/facebook/callback', 
  FbPassport.authenticate('facebook', { failureRedirect: '/fail', session: false }),
    (req, res) => res.redirect('/') 
);

app.get('/auth/slack', SlackPassport.authorize('Slack'));

app.get('/auth/slack/callback', 
  SlackPassport.authenticate(
    'Slack', { failureRedirect: '/fail', session: false }),
        (req, res) => {
            console.log('slack callback');
            console.log(req.query);
            if (isValidMember(req.user.team.id)) {
              if (req.query.state){
                 res.redirect('/auth/slack');
              } else {
                 res.redirect('/setcookie') ;
              };
            }
            else {
              res.redirect('/logoff');
            }
        }
);

app.get('/changelog', function(req, res) {
  res.sendFile(__dirname + '/views/changelog.html');
  logUserPageView(req, res, 'open changelog.html');
});

app.get('/checkgroups', function(req, res) {
  logUserPageView(req, res, 'access /checkgroups');
  checkGroupPermmision(req, res); 
});


app.get('/exec', function(req, res) {
  fetchFbPosts(req, res); 
});

app.get('/fail', function(req, res) {
  res.sendFile(__dirname + '/views/fail.html');
  logUserPageView(req, res, 'open fail.html');
});

// routing to GET Fans Analysis API
app.get('/getAnalytics', function(req, res) {
  asyncFetchHistory(req, res); 
});

app.get('/how-to-use', function(req, res) {
  res.sendFile(__dirname + '/views/how-to-use.html');
  logUserPageView(req, res, 'open how-to-use.html');
});

// on clicking "logoff" the cookie is cleared
app.get('/logoff',
  function(req, res) {
    logUserPageView(req, res, 'Logoff');  
    res.clearCookie('ezsfbmaster-passport');
    res.clearCookie('ezspassport');
    res.redirect('/');
  }
);

/* Cookie Handling Functions*/

// on successful auth, a cookie is set before redirecting
// to the success view
app.get('/setcookie', function(req, res) {
    console.log(getUserInfo(req, res) +  ' set Cookie');
      var OneYear = new Date(new Date().getTime() + (1000*60*60*24*365)); // ~1y
      res.cookie('ezsfbmaster-passport', new Date());
      res.cookie('ezspassport', User, { expires: OneYear });
      res.redirect('/success');
      logUserPageView(req, res, 'sucessfully set cookie');
  }
);

// routing to 
app.get('/setdb', function(req, res) {
  logUserPageView(req, res, 'set Member Database');
  setMemberDB(req, res);
});

/* Start of Facebook Click Assistant page */
app.get('/start', function(req, res) {
  logUserPageView(req, res, 'open /start');
  if (validLogin(req, res)) {
    logUserPageView(req, res, 'open main.html');
    res.sendFile(__dirname + '/views/main.html');
  };
});

// if cookie exists, success. otherwise, user is redirected to index
app.get('/success', function(req, res) {
    logUserPageView(req, res, 'pass Success');
    res.redirect('/start');
  }
);

app.get('/updatebase', function(req, res) {
  logUserPageView(req, res, 'access /updatebase');
  try {
    var member = checkArg(req, res, 'member', '150');
    if (member.length == 9) {
      writeMembers2db(req, res, member);
    };
  } catch (err) {
    res.send({ success: false, error: err});
  };
});


function logUserPageView(req, res, msg){
  console.log(getUserInfo(req, res) + ' ' + msg);
};


function isValidMember(teamId){
  if ( teamId == process.env.DEFAULT_SLACK_TEAM_ID) {
     return true;
  }
  return false;
}

async function validLogin(req, res) {
  const web = createSlackWeb(req, res, '000');
  if (web) {
    try{
      const result = await web.auth.test();
      if (result.ok) return true;
    }
    catch (err) {
      console.warn(err);
      return false;
    }
  };
};

function getTokenFromCookie(req, res) {
  var xToken = '';
  if (req.cookies.ezspassport) {
    xToken = req.cookies.ezspassport.auth;
    var jwt = require('jwt-simple');
    var decoded = jwt.decode(xToken, process.env.SECRET); 
    if (decoded.startsWith("xoxp-")) {
      return {ok: true, value: decoded};
    } else {
      console.warn('Wrong OAuth Data');
      res.redirect('/logoff');
      return {ok: false, error: 'Wrong OAuth Data' };
    }
  } else {
    console.warn('No OAuth Data');
    res.redirect('/');
    return {ok: false, error: 'No OAuth Data'} ;
  } 
}

function getUserIdFromCookie(req, res) {
  var id = req.cookies.ezspassport.oauthID;
  return id;
}

function getUserNameFromCookie(req, res) {
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

/* End of Cookie Handling Functions*/

function createSlackWeb(req, res, errId){
  var token = getTokenFromCookie(req, res);
  if (!token.ok) {
    var err = "Error(" + errId + "): " + token.error;
    console.warn(err);
    return false;
  } else {   
    const { WebClient } = require('@slack/client');    
    const web = new WebClient(token.value);
    return web;
  }
};

function checkArg(req, res, key, errId){
  if(req.query[key]) {
    return req.query[key];
  } else {
    var err = "Error(" + errId + "): 無法讀取參數";
    res.send(err);
    console.warn(err + req.query)
    return false;
  };
};

function get_channel_ids() {
  const ids = (process.env.SLACK_CHANNEL_IDs).split(',');
  return ids;
};

function checkGroupPermmision(req, res) {    
  const web = createSlackWeb(req, res, '160');
  const channels = get_channel_ids();
  
  var groups = [];
    channels.forEach(function (ch){
        groups.push(web.groups.info({channel: ch})
          .then((result) => {
               if (result.ok) return { id: ch, name: result.group.name};
            })
          .catch ((err) => { return null;}));
    });
    
    Promise.all(groups).then( (v) => {
      res.send({ success: true, channels: v.filter(w => w)});
    });
};

async function fetchFbPosts(req, res) {    
  const count = checkArg(req, res, 'read_limit','110');
  const channel_id = checkArg(req, res, 'group','115');//process.env.DEFAULT_SLACK_CHANNEL_ID;
  const channel_name = checkArg(req, res, 'groupname','116');
  const web = createSlackWeb(req, res, '111');    
  if (count && web) {
    var obj = [];
    try {
      const userId = getUserIdFromCookie(req, res);
      const result = await web.groups.history({channel: channel_id, count: count});
      if (result.ok) {
        for (var i = 0 ; i < result.messages.length; i++) {
          const message = result.messages[i];
          if (message.hasOwnProperty('attachments')){          
            const url = message.attachments[0].original_url;
            if (url) {
              obj.push({ind: i, url: url, ts: message.ts, 
                        isliked: isLikedbyUser(message, userId) });
            }
          };
        };
        logUserPageView(req, res, 'proceeded ' + i + ' messages.');
        res.send({ success: true, channel: { id: channel_id, name: channel_name }, read_limit: count, obj: obj});
      } else {
        throw new Error('(112) Failed to fetch history of messages and events from a private channel.');
      };
    } catch(err) {
      res.send({ success: false , error: err});
      console.warn(err)
    }
  }
};

// check if the post has aleary marked on Slack by a specifiy user
function isLikedbyUser(message, userId) {
    var isliked = false;
    if (message.hasOwnProperty('reactions')){                   
    for (var j in message.reactions) {
      var likedusers = message.reactions[j].users;
      isliked = likedusers.includes(userId);
      if (isliked) { break; }
    };
    return isliked;
  }; 
};

// POST method called by Mark Like buttons
app.post('/update_reactions', function(req, res) {
  onMarkReaction(req, res); 
});

// OnClickEvent - Mark Liked on Slack
async function onMarkReaction(req, res) {    
  console.log(req.body)
  var ts = req.body.ts;
  if (!ts) {
    var err = 'Error(120): 無法讀取參數。';
    res.send(err);
    console.warn(err); 
    return { ok: false , error: err};
  }
  
  const web = createSlackWeb(req, res, '141');
  var channel = req.body.channel.id;//process.env.DEFAULT_SLACK_CHANNEL_ID;  
  
  if(ts && web) {
    try {
      const result = await web.reactions.add({channel: channel, timestamp: ts, name : 'thumbsup'});
      if (!result.ok) {
        console.log("Error(122): Slack上的「" + req.body.channel.name + "」Channel 讀取失敗!");
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
/* End of Facebook Click Assistant page */

/* START FAN ANALYSIS ASISTANT PAGE */

// init sqlite db
var fs = require('fs');
var dbFile = './.data/sqlite.db';
var exists = fs.existsSync(dbFile);
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(dbFile);

var sqlite = require('sqlite-sync');
sqlite.connect(dbFile); 


function checkTableExists(name) {
  if (exists) {
    console.log('checking table');
    var hasTable = sqlite.run("SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = '" 
                              + name + "'" );
    if (Object.values(hasTable[0]) > 0) {
      console.log('Table exists.');
      return true;
    };
  }
  return false;
};

function createTableIfNotExist(name) {
  if (exists && !checkTableExists(name)) {
    db.serialize(function(){
      db.run('CREATE TABLE ' + name + ' (uid TEXT unique, name TEXT, avatar TEXT);');
      console.log('New table ' + name + ' created!');
    });
   };     
};


function write2db(uid, name, avatar) {    
  if (exists) {
    db.serialize(function() {
          db.run('INSERT OR REPLACE INTO Members (uid, name, avatar) VALUES ("' 
                 + uid + '", "' + name + '", "'
                 + avatar +'" );');
    });
    console.log('uid: ' + uid + ' , name: ' + name + ' , avatar: ' + avatar);
  };
};

function onlyUnique(value, index, self) { 
    return self.indexOf(value) === index;
};

async function writeMembers2db(req, res, members) {
  var token = process.env.SLACK_TOKEN;
  const { WebClient } = require('@slack/client');    
  const web = new WebClient(token);
  console.log('Try to update members to database');
  if (typeof(members) == 'string') {
    members = [members];
    console.log(members.length);
  }
  var uids = members.filter(onlyUnique);
  for (var i in uids){
    console.log('Try to add ' + uids[i] + ' to database');
    const uid = uids[i];
    const uInfo = await web.users.info({user: uid}); 
    if (!uInfo.ok) {
       console.log('Error(133) Failed to get information about a user.')
    };
    console.log('update Member ' + uid + ' in database')
    write2db(uid, uInfo.user.real_name, uInfo.user.profile.image_32);
  };
  console.log('Database "Members" ready to go!');
};

// fetch members' data and store to database
async function setMemberDB(req, res) {  
  const web = createSlackWeb(req, res, '141');
  var channels = get_channel_ids();
  console.log('Preparing to set Database...');
  var members = [];
  for (var i in channels) {
    const gInfo = await web.groups.info({channel: channels[i]});
    if (gInfo.ok) {
      console.log('Successful got group member list #' + i);
      members += gInfo.group.members;
    } else {
      console.log('Error:(130) Failed to get information about a private channel.')
      return false;
    };
  };
  createTableIfNotExist('Members');
  writeMembers2db(req, res, members.split(','));
  res.send('Successfully Updated Member Database!');
  return true;
};

// get the avatar of a specific user from database
function getNameAvatar(uid) {
   return sqlite.run('SELECT name name, avatar avatar FROM Members WHERE uid = ?', [uid]); 
}

// get all members's data from database
function getAllMbDataFromDb() {
  var data = sqlite.run('SELECT * FROM Members');
  var mbdata = [];
  for (var d in data) {
    var datum = data[d];
    mbdata[datum.uid] = {name: datum.name, avatar: datum.avatar} ;
  }
  return mbdata;
};

// Initialize using signing secret from environment variables
const slackEvents = require('slack-events-listener')(process.env.SLACK_VERIFICATION_TOKEN, onSlackEvent);

// Mount the event handler on a route
// NOTE: you must mount to a path that matches the Request URL that was configured earlier
app.use('/slack/events', bodyParser.json(), slackEvents);

function onSlackEvent(req, res) {
  console.log('Received a Slack Event')
  addMemberByJoinEvent(req, res);
}

function addMemberByJoinEvent(req, res){
  if (req.event.type === 'member_joined_channel') {
    if (req.event.channel === process.env.DEFAULT_SLACK_CHANNEL_ID){
      writeMembers2db(req, res, req.event.user);
    }
  } else  {
    console.log(req.event);
  };
};

app.use('/slack/events', bodyParser.json(), slackEvents);


// Fans Analysis functoin
async function asyncFetchHistory(req, res) {    
  var nDays = checkArg(req, res, 'num_of_days', '140');
  
  const web = createSlackWeb(req, res, '141');
  var channel = checkArg(req, res, 'group', '141');  
  
  // get the required time period
  var timePeriod = getTimePeriod(nDays);
  
  // cache members' data from database
  var mbdata = getAllMbDataFromDb();
  
  var users = [];
  var has_more = true;
  
  // while if any remaining history
  while(has_more && nDays && web) {
    try {
      const result = await web.groups.history({channel: channel, 
                                               count: 1000, 
                                               latest: timePeriod.last, 
                                               oldest: JsDate2SlackTs(timePeriod.past)});
      if (!result.ok) {
        throw new Error('Error(141) Failed to fetch history of messages and events from a private channel.');
      } else {
        console.log('Start Fetch History');
        var messages = result.messages;
        // for each slack messages in the history
        for (var i = 0 ; i < messages.length; i++) {
          var uid = messages[i].user;
          if (!mbdata[uid]) {
            console.log("Error(142): Missing User Data => " + uid);
            await writeMembers2db(req, res, uid);
            mbdata = await getAllMbDataFromDb();
          };
        };
          
        for (var i = 0 ; i < messages.length; i++) {
          var message = messages[i];  
          // Chech if this message attached a facebook post
          if (message.hasOwnProperty('attachments')){          
            if (message.attachments[0].original_url && message.attachments[0].original_url.includes('.facebook.com')){
              // Add a new user if the liker is not in the list of users;
              // else, increase the count of user's posts.
              const uid = message.user;
              if (!users.hasOwnProperty(uid)) {
                users[uid] = { avatar: mbdata[uid].avatar, 
                                 name: mbdata[uid].name, num_of_posts: 1, 
                                 num_of_reacts: 0, adjacency: {}};
              } else {
                users[uid].num_of_posts++;
              };              
              // Find and count who liked is slack message
              if (message.hasOwnProperty('reactions')){                   
                var likers = [];
                // for each reactions attached to this slack message
                // list out unique likers
                for (var j in message.reactions) {
                  var reactedusers = message.reactions[j].users;
                  for (var k in reactedusers) {
                    likers[reactedusers[k]] = reactedusers[k];
                  }
                }; // End for each reaction lists    
                
                // for each of unique likers found
                for (var m in likers) {
                   var liker = likers[m];
                   if (!mbdata[liker]) {
                     console.log("Error(143): Missing User Data => " + liker);
                     await writeMembers2db(req, res, liker);
                     mbdata = await getAllMbDataFromDb();
                   };
                };
                for (var m in likers) {
                   var liker = likers[m];
                   // if this liker has not registered in the adjacency list of current user,
                   // create a new record to the adjacency list; else, increase the corresponding counter.
                   if (!users[uid].adjacency[liker]) {   
                     users[uid].adjacency[liker] = {
                                     avatar: mbdata[liker].avatar,
                                     name: mbdata[liker].name,
                                     reaction_count: 1};                
                   } else {
                     users[uid].adjacency[liker].reaction_count++;
                   }
                   // Add a new user if the liker is not in the list of users;
                   // else, increase the reacted count of the liker
                   if (!users[liker]){
                     users[liker] = {avatar: mbdata[liker].avatar, 
                            name: mbdata[liker].name, num_of_posts: 0, 
                                     num_of_reacts: 1, adjacency: {}};
                   } else {
                     users[liker].num_of_reacts++;
                   };                  
                };   // End for each likers           
              }; // End if reactions exist
            }; // End if this message attached a facebook post
          }; // End if this message has any attachements
        }; // End for each slack messages in the history
        
        // check if there are more slack messages within the required time period
        if (result.has_more) {
          timePeriod.last = messages[messages.length-1].ts;
        } else {
          has_more = false;
        }
      }; // End if fetched results
    } catch(err) {
      res.send({ success: false , error: err});
      console.warn(err);
    }
  }; // End while if any remaining history
  
  res.send({success: true, users: Object.values(users)});
};

// Convert Javascript datatime to Unix timestamp
function JsDate2SlackTs(d) {
   return d/1000;
};
// Convert Unix timestamp to Javascript datatime
function SlackTs2JsDate(ts) {
   return ts*1000;
}

function getTimePeriod(nDays) {
  var tsLast = new Date().getTime();
  var tsFirst = new Date(tsLast-86400000*nDays);
    tsFirst.setHours(0);
    tsFirst.setMinutes(0);
    tsFirst.setSeconds(0);
    tsFirst.setMilliseconds(0);
  return { past: tsFirst, last: tsLast };
};

/* END OF FAN ANALYSIS ASISTANT PAGE */

// listen for requests :)
var listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});