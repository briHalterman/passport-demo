// app.js

// Most of this should look familiar to you by now, except for the new imported middleware for express-session and passport. We are not actually going to be using express-session directly, it is a dependency that is used in the background by passport.js.

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

app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ extended: false }));

app.get("/", (req, res) => res.render("index"));

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
    res.redirect("/");
  } catch(err) {
    return next(err);
  };
});


app.listen(3000, () => console.log("app listening on port 3000!"));