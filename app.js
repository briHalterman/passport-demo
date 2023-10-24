// app.js

// // Most of this should look familiar to you by now, except for the new imported middleware for express-session and passport. We are not actually going to be using express-session directly, it is a dependency that is used in the background by passport.js.

// PassportJS uses what they call Strategies to authenticate users
// LocalStrategy (username-and-password): most basic and most common Strategy
// already installed and required the appropriate modules

// need to add 3 functions to our app.js file, and then add an app.post for our /log-in path

require('dotenv').config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

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
passport.use(
  // takes username and password
  new LocalStrategy(async (username, password, done) => {
    try {
      // tries to find the user in DB
      const user = await User.findOne({ username: username });
      // makes sure that the user’s password matches the given password
      if (!user) {
        return done(null, false, { message: "Incorrect username" });
      };
      if (user.password !== password) {
        return done(null, false, { message: "Incorrect password" });
      };
      // authenticates user and moves on
      return done(null, user);
    } catch(err) {
      return done(err);
    };
  })
);
// We will not be calling this function directly, so you won’t have to supply the done function.

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

app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ extended: false }));

// edit app.get("/") to send user object to view:
// app.get("/", (req, res) => res.render("index"));
app.get("/", (req, res) => {
  res.render("index", { user: req.user });
});

// create a route for /sign-up that points to sign-up-form
app.get("/sign-up", (req, res) => res.render("sign-up-form"));

// create an app.post for the sign up form so that we can add users to our database
app.post("/sign-up", async (req, res, next) => {
  try {
    const user = new User({
      username: req.body.username,
      password: req.body.password
    });
    const result = await user.save();
    // redirect to the index
    res.redirect("/");
  } catch(err) {
    return next(err);
  };
});

// … and now for the magical part!
app.post(
  "/log-in",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/"
  })
);
// As you can see, all we have to do is call passport.authenticate(). This middleware performs numerous functions behind the scenes. Among other things, it looks at the request body for parameters named username and password then runs the LocalStrategy function that we defined earlier to see if the username and password are in the database. It then creates a session cookie that gets stored in the user’s browser, and that we can access in all future requests to see whether or not that user is logged in. It can also redirect you to different routes based on whether the login is a success or a failure. If we had a separate login page we might want to go back to that if the login failed, or we might want to take the user to their user dashboard if the login is successful.

// The passport middleware checks to see if there is a user logged in (by checking the cookies that come in with the req object) and if there is, it adds that user to the request object for us.

app.listen(3000, () => console.log("app listening on port 3000!"));