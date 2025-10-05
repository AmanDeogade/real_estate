require('dotenv').config();

// Temporary hardcoded values for testing
process.env.ATLASDB_URL = 'mongodb://localhost:27017/wanderlust';
process.env.CLOUD_NAME = 'dni5pw0wh';
process.env.CLOUD_API_KEY = '633357282274388';
process.env.CLOUD_API_SECRET = 'nyCOX-AyujWi_hit_KwQNV2Pxkg';
process.env.RAZORPAY_KEY_ID = 'rzp_test_R9rInMcdCNinzv';
process.env.RAZORPAY_KEY_SECRET = 'DNQO5D9ZIHjKfmlGNqGyEl0j';
process.env.SECRET = 'wanderlust_secret_key_2024';

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require('connect-mongo');
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const leadRouter = require("./routes/lead.js");
const taskRouter = require("./routes/task.js");
const favoriteRouter = require("./routes/favorite.js");
const recommendationRouter = require("./routes/recommendations.js");
const buyerManagementRouter = require("./routes/buyerManagement.js");
const buyerDashboardRouter = require("./routes/buyerDashboard.js");
const communicationRouter = require("./routes/communication.js");
const paymentRouter = require("./routes/payment.js");


const dbUrl = process.env.ATLASDB_URL;

// Debug environment variables
console.log('🔍 Environment Variables Debug:');
console.log('ATLASDB_URL:', process.env.ATLASDB_URL);
console.log('CLOUD_NAME:', process.env.CLOUD_NAME);
console.log('RAZORPAY_KEY_ID:', process.env.RAZORPAY_KEY_ID ? 'Set' : 'Not Set');
console.log('SECRET:', process.env.SECRET ? 'Set' : 'Not Set');

main().then(() => {
    console.log("✅ Connected to DB successfully");
}).catch((err) => {
    console.log("❌ DB Connection Error:", err);
});

async function main() {
    await mongoose.connect(dbUrl);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Add JSON parsing middleware
// Support method-override from query string, form body, or header
app.use(methodOverride((req, res) => {
    // 1) Check query string ?_method=DELETE
    if (req.query && req.query._method) return req.query._method;
    // 2) Check body (for forms with hidden input named _method)
    if (req.body && typeof req.body === 'object' && req.body._method) {
        const method = req.body._method;
        // Remove it so it doesn't pollute req.body for downstream handlers
        delete req.body._method;
        return method;
    }
    // 3) Check common header used by some clients
    if (req.headers['x-http-method-override']) return req.headers['x-http-method-override'];
    return undefined;
}));
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

console.log('🔍 Creating MongoStore with URL:', dbUrl);
const store = MongoStore.create({
    mongoUrl: dbUrl,
    crypto: {
        secret: process.env.SECRET,
    },
    touchAfter: 24 * 3600,
});

store.on("error", (err) => {
    console.log("ERROR IN MONGO SESSION STORE", err);
})

const sessionOptions = {
    store,
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
    }
};

// ✅ MOVE THIS SECTION ABOVE ALL ROUTES
app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
});

// ✅ ROUTES GO BELOW SESSION/PASSPORT
app.get("/", (req, res) => {
    res.redirect("/listings");
});

// app.get("/demouser", async (req, res) => {
//     let fakeUser = new User({
//         email: "student@gmail.com",
//         username: "delta-student",
//     });
//     let registeredUser = await User.register(fakeUser, "helloworld");
//     res.send(registeredUser);
// });

app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/leads", leadRouter);
app.use("/tasks", taskRouter);
app.use("/favorites", favoriteRouter);
app.use("/recommendations", recommendationRouter);
app.use("/buyer-management", buyerManagementRouter);
app.use("/buyers", buyerDashboardRouter);
app.use("/communication", communicationRouter);
app.use("/payment", paymentRouter);

app.use("/", userRouter);

app.all("*", (req, res, next) => {
    next(new ExpressError(404, "Page Not Found!"));
});

app.use((err, req, res, next) => {
    let { statusCode = 500, message = "Something went wrong!" } = err;
    res.status(statusCode).render("error.ejs", { err });
});

app.listen(8080, () => {
    console.log("server is listening to port 8080");
});
