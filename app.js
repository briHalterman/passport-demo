// app.js

// // Most of this should look familiar to you by now, except for the new imported middleware for express-session and passport. We are not actually going to be using express-session directly, it is a dependency that is used in the background by passport.js.

// PassportJS uses what they call Strategies to authenticate users
// LocalStrategy (username-and-password): most basic and most common Strategy
// already installed and required the appropriate modules

// need to add 3 functions to our app.js file, and then add an app.post for our /log-in path

// once installed, require bcryptjs
var bcrypt = require('bcryptjs');
// put it to use where we save our passwords to the DB, and where we compare them inside the LocalStrategy

require('dotenv').config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// A Production Grade Session Store
// The default for express-session is to store session data in memory. This approach should never be used in production, because (a) if the application is restarted, all session data is lost, and (b) session data could fill up memory. 
// A production application stores session data another way, and there are a variety of choices. (Here we use MongoDB.)

const MongoDBStore = require('connect-mongodb-session')(session)

var store = new MongoDBStore({
  uri: process.env.MONGO_URI,
  collection: 'sessions'
});

// Catch errors
store.on('error', function (error) {
  console.log(error);
});

const mongoDb = process.env.MONGO_URI;
mongoose.connect(mongoDb);
const db = mongoose.connection;
db.on("error", console.error.bind(console, "mongo connection error"));

const User = mongoose.model(
  "User",
  new Schema({
    username: { type: String, required: true },
    password: { type: String, required: true }
  })
);

const app = express();
app.set("views", __dirname);
app.set("view engine", "ejs");

// Function one : setting up the LocalStrategy
// acts a bit like a middleware and will be called for us when we ask passport to do the authentication
// will be called when we use the passport.authenticate() function

// Comparing hashed passwords:
// Use the bcrypt.compare() function to validate the password input. The function compares the plain-text password in the request object to the hashed password.

passport.use(
  // takes username and password
  // replace the user.password !== password expression with the bcrypt.compare() function
  new LocalStrategy(async (username, password, done) => {
    try {
      // tries to find the user in DB
      const user = await User.findOne({ username: username });
      // makes sure that the user’s password matches the given password
      if (!user) {
        return done(null, false, { message: "Incorrect username" });
      };
      // if (user.password !== password) {
      //   return done(null, false, { message: "Incorrect password" });
      // };
      // // authenticates user and moves on
      // return done(null, user);
      bcrypt.compare(password, user.password, (err, result) => {
        if (result) {
          return done(null, user);
        } else {
          return done(null, false, { message: "Incorrect password" });
        }
      });
    } catch(err) {
      return done(err);
    };
  })
  // Unfortunately, users that were saved BEFORE you added bcrypt will no longer work, but that’s a small price to pay for security!
);
// // We will not be calling this function directly, so you won’t have to supply the done function.
// This is kind of a crude approach for simplicity. It would be better to extend the schema for User

// Functions two and three: sessions and serialization
// To make sure our user is logged in, and to allow them to stay logged in as they move around our app, passport will use some data to create a cookie which is stored in the user’s browser. 
// These next two functions define what bit of information passport is looking for when it creates and then decodes the cookie. 
// Make sure that whatever bit of data it’s looking for actually exists in our Database!
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch(err) {
    done(err);
  };
});
// we aren’t going to be calling these functions on our own, they’re used in the background by passport

// app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: true }));
app.use(session({
  secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: true,
  store: store
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ extended: false }));

// In express, you can set and access various local variables throughout your entire app (even in views) with the locals object.

// Middleware functions are simply functions that take the req and res objects, manipulate them, and pass them on through the rest of the app.

app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  next();
});
// insert this code somewhere between where you instantiate the passport middleware and before you render your views to have access to the currentUser variable in all of your views

// use middleware to perform access control
// so that certain pages are restricted only to those users that log in
const authMiddleware = (req, res, next) => {
  // if the user attempts to access a restricted page without being logged in...
  if (!req.user) {
    if (!req.session.messages) {
      req.session.messages = [];
    }
    // ...redirect user to logon page with message
    req.session.messages.push("You can't access that page before logon.");
    res.redirect('/');
  } else {
    next();
  }
}

// edit app.get("/") to send user object to view:
// app.get("/", (req, res) => res.render("index"));
app.get("/", (req, res) => {
  // to create password error message:
  let messages = [];
  if (req.session.messages) {
    messages = req.session.messages;
    req.session.messages = [];
  }
  // res.render("index", { user: req.user });
  // res.render("index");
  res.render("index", { messages });
});

// create a route for /sign-up that points to sign-up-form
app.get("/sign-up", (req, res) => res.render("sign-up-form"));

// Conveniently, the passport middleware adds a logout function to the req object:
// app.get("/log-out", (req, res, next) => {
//   req.logout((err) => {
//     if (err) {
//       return next(err);
//     }
//     res.redirect("/");
//   });
// });
// // The code now does a req.logout() when the user logs off.
// It is better to delete all the session information at logoff time:
app.get("/log-out", (req, res) => {
  req.session.destroy(function (err) {
    res.redirect("/");
  });
});

// create route statement that loads restricted page
app.get('/restricted', authMiddleware, (req, res) => {
  if (!req.session.pageCount) {
    req.session.pageCount = 1;
  } else {
    req.session.pageCount++;
  }
  res.render('restricted', { pageCount: req.session.pageCount });
})
// Here the code shows also how the session can be used to store state, in this case the number of page visits.

// Storing Hashed Passwords (A Review of Lesson 9):

// Password hashes are the result of passing the user’s password through a one-way hash function, which maps variable sized inputs to fixed size pseudo-random outputs.

// Salting a password means adding extra random characters to it, the password plus the extra random characters are then fed into the hashing function. Salting is used to make a password hash output unique, even for users who use the same password, and to protect against rainbow table and dictionary attacks.

// Usually, the salt gets stored in the database in the clear next to the hashed value, but in our case, there is no need to do so because the hashing algorithm that bcryptjs uses includes the salt automatically with the hash.

// The hash function is somewhat slow, so all of the DB storage code needs to go inside the callback.

// It’s important to note that how hashing works is beyond the scope of this lesson.

// create an app.post for the sign up form so that we can add users to our database
app.post("/sign-up", async (req, res, next) => { // second argument is length of “salt” used in hashing function
  bcrypt.hash(req.body.password, 10, async (err, hashedPassword) => {
    try {
      // const user = new User({
      //   username: req.body.username,
      //   password: req.body.password
      // });
      const hashedPassword = await bcrypt.hash(req.body.password, 10);
      // const result = await user.save();
      await User.create({ username: req.body.username, password: hashedPassword });
      // redirect to the index
      res.redirect("/");
    } catch(err) {
      return next(err);
    };
  });
});

// … and now for the magical part!
app.post(
  "/log-in",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/",
    failureMessage: true // creating incorrect password message
    // This is the way Passport error messages into the session, so that they can be displayed on subsequent screens. The messages are put in an array, req.session.messages. This can then be displayed in the index.ejs.
  })
);
// As you can see, all we have to do is call passport.authenticate(). This middleware performs numerous functions behind the scenes. Among other things, it looks at the request body for parameters named username and password then runs the LocalStrategy function that we defined earlier to see if the username and password are in the database. It then creates a session cookie that gets stored in the user’s browser, and that we can access in all future requests to see whether or not that user is logged in. It can also redirect you to different routes based on whether the login is a success or a failure. If we had a separate login page we might want to go back to that if the login failed, or we might want to take the user to their user dashboard if the login is successful.

// The passport middleware checks to see if there is a user logged in (by checking the cookies that come in with the req object) and if there is, it adds that user to the request object for us. Neat!

app.listen(3000, () => console.log("app listening on port 3000!"));
