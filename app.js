//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate = require('mongoose-findorcreate');
const _ = require('lodash');

//http certification
var fs = require('fs');
var https = require('https');
const app = express();
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(express.static("public"));

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: "Thisisthesecret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
//use passport when dealing with session



mongoose.connect("mongodb://localhost:27017/userDB", {
  useNewUrlParser: true
});
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  name: String,
  location: String,
  currentLocation: {
    lattitude: Number,
    longitude: Number
  },
  description: {
    skills: String,
    interest: String
  },
  rating: Number,
  posts: [{
    title: String,
    body: String,
    lookingfor: String,
    commitment: String,
    date: String
  }]

});

userSchema.plugin(passportLocalMongoose);
// hash and salt passwords and save users to db
userSchema.plugin(findOrCreate);



// userSchema.plugin(encrypt, { secret: process.env.SECRET, encryptedFields: ["password"] });

const User = new mongoose.model("User", userSchema);


passport.use(User.createStrategy());
// creates an authentication mechanism

passport.serializeUser(function(user, done) {
  done(null, user.id);
  // where is this user.id going? Are we supposed to access this anywhere?
});
//serializeUser determines which data of the user object should be stored in the session.


passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});
// cracks the fortune cookie, allows passport to discover is inside the cookie or session


function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    req.session.returnTo = req.originalUrl;
    res.redirect('/login');
  }
}



// ----------------------------------------APIs----------------------------------------
// ----------------------------------------GET----------------------------------------

app.get("/", function(req, res) {
  res.render("home");

});
app.get("/register", function(req, res) {
  res.render("register");
});

app.get("/aboutyou",
  ensureAuthenticated,
  function(req, res) {
    res.render("AboutYou");

  });


app.get("/login", function(req, res) {
  res.render("login");

});


app.get('/me',
  ensureAuthenticated,
  function(req, res) {
    User.findById(req.user._id, function(err, foundUser) {
      // passport saves users details into req var when we initiate authenticate local session/cookie(when we login/register)

      if (err) {
        console.log(err);
      } else {
        if (foundUser) {
          res.render("me", {
            name: req.user.name,
            userDescription: req.user.description

          });
        }
      }
    });

  });


app.get('/meedit',
  ensureAuthenticated,
  function(req, res) {
    User.findById(req.user._id, function(err, foundUser) {
      // passport saves users details into req var when we initiate authenticate local session/cookie(when we login/register)

      if (err) {
        console.log(err);
      } else {
        if (foundUser) {
          res.render("meedit", {
            name: req.user.name,
            userDescription: req.user.description
          });
        }
      }
    });

  });

app.get('/me/myposts',
  ensureAuthenticated,
  function(req, res) {
    User.findById(req.user._id, function(err, foundUser) {
      // passport saves users details into req var when we initiate authenticate local session/cookie(when we login/register)
      if (err) {
        console.log(err);
      } else {
        if (foundUser) {
          res.render("memyposts", {
            name: foundUser.name,
            userDescription: req.user.description,
            myPosts: foundUser.posts

          });
        }
      }
    });

  });

app.get("/logout", function(req, res) {
  req.logout();
  //unauthenticate user and deletes cookie
  res.redirect("/");
});

app.get('/compose',
  ensureAuthenticated,
  function(req, res) {
    res.render('compose');

  });




app.get('/ideas',
  ensureAuthenticated,
  //  substitute for if (req.isAuthenticated()) {  and  }res.redirect("/login");
  function(req, res) {
    User.find({
      "posts": {
        $ne: null
      }
    }, function(err, foundUsers) {
      // find all users with posts field thats not null
      if (err) {
        console.log(err);

      } else {
        if (foundUsers) {
          res.render('ideas', {
            currentUserId: req.user._id,
            userWithPosts: foundUsers
          });
        }
      }
    });

  });


app.get('/people',
  ensureAuthenticated,
  //  substitute for if (req.isAuthenticated()) {  and  }res.redirect("/login");
  function(req, res) {
    User.find({}, function(err, foundUsers) {
      // find all users with secret field thats not null
      if (err) {
        console.log(err);
      } else {
        if (foundUsers) {

          res.render('people', {
            allUser: foundUsers,
            currentUser: req.user,

            // might want add more user details to be displayed later so lets pass the entire user for now
          });
        }
      }
    });

  });




app.get("/nearby", function(req, res) {


  usersWithDistances = [];
  sortedUsers = [];
  currentUserLattitude = req.user.currentLocation.lattitude;
  currentUserLongitude = req.user.currentLocation.longitude;



    function distance(lat1, lon1, lat2, lon2, unit) {
      // calculates distance between 2 coordinates of longitude and lattitude
      if ((lat1 == lat2) && (lon1 == lon2)) {
        return 0;
      } else {
        var radlat1 = Math.PI * lat1 / 180;
        var radlat2 = Math.PI * lat2 / 180;
        var theta = lon1 - lon2;
        var radtheta = Math.PI * theta / 180;
        var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
        if (dist > 1) {
          dist = 1;
        }
        dist = Math.acos(dist);
        dist = dist * 180 / Math.PI;
        dist = dist * 60 * 1.1515;
        if (unit == "K") {
          dist = dist * 1.609344;
        }
        if (unit == "N") {
          dist = dist * 0.8684;
        }
        return dist;
      }
    }


    User.find({"_id": {"$ne": req.user._id}}, function(err, Users) {
      if (err) {
        console.log(err);
      }
      m = Object.keys(Users).length;
      // m = number of the actually number of keys or elements, excludes the current User
      for (i = 0; i < m; i++) {

        distanceBetween = distance(currentUserLattitude, currentUserLongitude, Users[i].currentLocation.lattitude, Users[i].currentLocation.longitude, "K");

        const userWithDistance = {
          User: Users[i],
          distanceBetween: distanceBetween
        };

        usersWithDistances.push(userWithDistance);
      
      }

      usersWithDistances[0].distanceBetween = 0;
      //since we are signing in each user with same ip/location, resulting same distanceBetween, we change an instance for testing

      usersWithDistances.sort((a, b) => parseFloat(b.distanceBetween) - parseFloat(a.distanceBetween));
      // sort usersWithDistances array by distance property


      for (i = 0; i < m; i++) {
        sortedUsers.push(usersWithDistances[i].User);
        // gets rid of distanceBetween property, leaving only the Users
      }

      res.render('nearby', {
        currentUser: req.user,
        sortedUsers: sortedUsers,
      });

    });


});




app.get('/posts/:postId',
  // values after : will be the params, in this case we named our param postId, so we can access it later
  ensureAuthenticated,
  function(req, res) {
    const requestedPostId = req.params.postId;

    User.findOne({
      "posts._id": requestedPostId
    }, function(err, foundUser) {
      // we can locate users by the objectID of its child-objects
      // tags into posts property and finds the object that has a ID of requestedPostId

      if (err) {
        console.log(err);
      } else {
        if (foundUser) {
          foundUser.posts.forEach(function(post) {
            //foundUser is a single object and Foreach works on the posts array of foundUser object
            const postIDString = String(post._id);
            // object IDs of objects such as post._id has a type of objectID, seen in ROBO 3T, therefore wont work in if statement
            // Json.Stringify also adds the " " quotations marks when Stringifying which nulls the if statement to work
            if (postIDString === requestedPostId) {
              res.render("post", {
                title: post.title,
                //post.title and post.body are strings since they are declared in the Schema
                body: post.body,
                commitment: post.commitment,
                lookingfor: post.lookingfor,
                date: post.date,
                userWithThatPost: foundUser
              });
            }
          });

        }
      }
    });

  });


app.get("/people/:userId",
  ensureAuthenticated,
  function(req, res) {
    const requestedUserId = req.params.userId;
    //req.params.userId is a turned into a string after being passed in
    User.findById(requestedUserId, function(err, foundUser) {
      // finds the user with requestedUserId which is string
      if (err) {
        console.log(err);
      } else {
        if (foundUser) {
          res.render("person", {
            user: foundUser
            // might want add more user details to be displayed later so lets pass the entire user for now
          });



        }
      }
    });

  });

// ----------------------------------------POST----------------------------------------
app.post("/register", function(req, res) {
  User.register({
    username: req.body.username
  }, req.body.password, function(err, user) {
    //passport-local-mongoose allows us to register/create user simply
    //passport-local-mongoose needs a username from the post request which is given by register.ejs as the email
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function() {
        //authenticates the user
        // authentication is what actually logs in the user
        // allowing it access particular info that requires authentication
        // if authentication succeeds, a session will be established and maintained via a cookie set in the user's browser
        // inside the cookie the content has meaning to our server that the current user is authenticated
        // serializes user/ creates that fortune cookie
        //call back is called once authentication succeeds
        res.redirect("/aboutyou");
      });
    }
  });
});

app.post("/login", function(req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(user, function(err) {
    //checks if user exists in data base
    if (err) {
      console.log(err);

    } else {
      passport.authenticate("local", {
        failureRedirect: '/login',
        failureFlash: 'Invalid username or password.'
      })(req, res, function() {

        User.findById(req.user._id, function(err, foundUser) {
          // passport saves users details into req var when we initiate a login session/cookie(when we login)

          if (err) {
            console.log(err);

          } else {
            if (foundUser) {
              foundUser.currentLocation.lattitude = req.body.currentUserLattitude;
              foundUser.currentLocation.longitude = req.body.currentUserLongitude;
              foundUser.save();
              // saves user currentLocation to db
            }
          }
        });
        if (req.session.returnTo !== undefined) {

          // req.session.returnTo will be undefined if user comes the home route since home route has no value
          res.redirect(req.session.returnTo);
          delete req.session.returnTo;
        } else {
          res.redirect("/me");
        }

      });
    }
  });
  //passport method

});

app.post("/aboutyou", function(req, res) {
  const name = req.body.name;

  const description = {
    skills: req.body.skills,
    interest: req.body.interest
  };

  User.updateOne({
      '_id': req.user._id
    },
    // passport saves users details into req var when we initiate a login session/cookie(when we login)
    {
      '$set': {
        //$set updates and saves into field
        //works even if field is initally empty
        'name': name,
        'description': description,
      }
    },
    function(err, model) {
      if (err) {
        console.log(err);
      }
      res.redirect("/me");
    });

});

app.post("/meedit", function(req, res) {

  const description = {
    skills: req.body.newSkills,
    interest: req.body.newInterest
  };

  User.updateOne({
      '_id': req.user._id
    },

    {
      '$set': {
        //updates and saves to db
        'description': description,
      }
    },
    function(err, model) {
      if (err) {
        console.log(err);
      }
      res.redirect("/me");
    });

  // User.findByIdAndUpdate(req.user._id, function(err, foundUser) {
  //   // passport saves users details into req var when we initiate a login session/cookie(when we login)
  //
  //   if (err) {
  //     console.log(err);
  //   } else {
  //     if (foundUser) {
  //       foundUser.description = description;
  //       foundUser.save(function() {
  //         //saves to database
  //         res.redirect("/me");
  //       });
  //     }
  //   }
  // });
});

app.post("/deletepost", function(req, res) {

  const postID = req.body.postId;

  User.updateOne({
    "posts._id": postID
  }, {
    $pull: {
      'posts': {
        _id: postID
      }
    }
  }, function(err, model) {
    if (err) {
      console.log(err);
    } else {
      res.redirect("/me/myposts");

    }

  });

});

app.post("/compose", function(req, res) {
  const post = {
    title: req.body.postTitle,
    body: req.body.postBody,
    lookingfor: req.body.lookingfor,
    commitment: req.body.commitment,
    date: req.body.date
  };

  User.updateOne({
      '_id': req.user._id
    }, {
      $push: {
        "posts": post
      }
    },
    // pushes post in to posts array
    {
      safe: true,
      upsert: true
    },
    function(err, model) {

      if (err) {
        console.log(err);

      }
      console.log(model);
      res.redirect("/ideas");
    });


});



// -------------------------PORT-------------------------
https.createServer({
    key: fs.readFileSync('./key.pem'),
    cert: fs.readFileSync('./cert.pem')
  }, app)
  .listen(3000, function() {
    console.log('Example app listening on port 3000! Go to https://localhost:3000/');
  });
