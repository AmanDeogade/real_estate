const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const passport = require("passport");
const { saveRedirectUrl, isLoggedIn } = require("../middleware.js");

const userController = require("../controllers/users.js");

router
    .route("/signup")
    .get(userController.renderSignupForm)
    .post(wrapAsync(userController.signup));

router
    .route("/login")
    .get(userController.renderLoginForm)
    .post(saveRedirectUrl, passport.authenticate("local", { failureRedirect: '/login', failureFlash: true }), userController.login);

router.get("/logout", userController.logout);

// Profile routes
router
    .route("/profile")
    .get(isLoggedIn, userController.renderProfile)
    .patch(isLoggedIn, wrapAsync(userController.updateProfile))
    .post(isLoggedIn, wrapAsync(userController.updateProfile));

module.exports = router;