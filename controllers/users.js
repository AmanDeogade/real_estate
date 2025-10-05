const User = require("../models/user.js");

module.exports.renderSignupForm = (req, res) => {
    res.render("users/signup.ejs");
}

module.exports.signup = async (req, res, next) => {
    try {
        let { 
            username, 
            email, 
            password, 
            userType, 
            firstName, 
            lastName, 
            phone,
            companyName,
            licenseNumber,
            brokerLicense,
            agency,
            specialization
        } = req.body;
    // Debug: log incoming signup body to help track role issues
    console.log('Signup request body:', req.body);

    // Normalize and validate userType
        const allowedTypes = ['buyer', 'property_owner', 'broker'];
        let normalizedType = (userType || '').toString().trim().toLowerCase();
        // Accept some common variants
        if (normalizedType === 'owner' || normalizedType === 'propertyowner' || normalizedType === 'owner/agency') {
            normalizedType = 'property_owner';
        }
        if (!allowedTypes.includes(normalizedType)) {
            // If user didn't explicitly choose a valid role, reject the signup
            req.flash('error', 'Please select a valid role when signing up (Buyer, Property Owner, or Broker).');
            return res.redirect('/signup');
        }
        
        const newUser = new User({
            email,
            username,
            userType: normalizedType,
            firstName,
            lastName,
            phone,
            companyName: normalizedType === 'property_owner' ? companyName : undefined,
            licenseNumber: normalizedType === 'property_owner' ? licenseNumber : undefined,
            brokerLicense: normalizedType === 'broker' ? brokerLicense : undefined,
            agency: normalizedType === 'broker' ? agency : undefined,
            specialization: normalizedType === 'broker' ? (specialization ? specialization.split(',').map(s => s.trim()) : []) : undefined
        });
        
        const registeredUser = await User.register(newUser, password);
        console.log(registeredUser);
        req.login(registeredUser, (err) => {
            if (err) {
                req.flash('error', err.message || 'Login after registration failed. Please login manually.');
                return res.redirect('/login');
            }
            req.flash("success", `Welcome to Karnavat & Associates Real Estate Platform, ${firstName}!`);
            res.redirect("/listings");
        });
    } catch(e) {
        req.flash("error", e.message);
        res.redirect("/signup");
    }
}

module.exports.renderLoginForm = (req, res) => {
    res.render("users/login.ejs");
}

module.exports.login = async(req, res) => {
    const userType = req.user.userType;
    let welcomeMessage = "Welcome back to Karnavat & Associates!";
    
    if (userType === 'broker') {
        welcomeMessage = `Welcome back, ${req.user.firstName}! Ready to manage your leads?`;
    } else if (userType === 'property_owner') {
        welcomeMessage = `Welcome back, ${req.user.companyName || req.user.firstName}! How are your listings performing?`;
    } else {
    welcomeMessage = `Welcome back, ${req.user.firstName}!`;
    }
    
    req.flash("success", welcomeMessage);
    let redirectUrl = res.locals.redirectUrl || "/listings";
    res.redirect(redirectUrl);
}

module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if(err) {
            return next(err);
        }
        req.flash("success", "You are logged out!");
        res.redirect("/listings");
    })
}

// Profile management
module.exports.renderProfile = async (req, res) => {
    const user = await User.findById(req.user._id);
    res.render("users/profile.ejs", { user });
}

module.exports.updateProfile = async (req, res) => {
    // Support updating current user's profile via POST to /profile with method-override to PATCH
    const id = req.user && req.user._id ? req.user._id : req.params.id;
    // Prevent userType changes from the profile form
    const updateData = { ...req.body };
    if (updateData.userType) delete updateData.userType;
    const user = await User.findByIdAndUpdate(id, updateData, { runValidators: true, new: true });
    req.flash("success", "Profile updated successfully!");
    res.redirect(`/profile`);
}