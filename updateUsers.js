const mongoose = require("mongoose");
const User = require("./models/user.js");

// Connect to MongoDB
const dbUrl = process.env.ATLASDB_URL || "mongodb://localhost:27017/karnavat_associates";

async function updateUsers() {
    try {
        await mongoose.connect(dbUrl);
        console.log("Connected to MongoDB");

        // Find all users without propertyPreferences
        const usersToUpdate = await User.find({
            $or: [
                { propertyPreferences: { $exists: false } },
                { propertyPreferences: null }
            ]
        });

        console.log(`Found ${usersToUpdate.length} users to update`);

        for (const user of usersToUpdate) {
            try {
                // Initialize preferences safely
                user.initializePreferences();
                
                // Save the user
                await user.save();
                console.log(`Updated user: ${user.email}`);
            } catch (error) {
                console.error(`Error updating user ${user.email}:`, error);
            }
        }

        console.log("User update process completed");
        
        // Verify the update
        const usersWithPrefs = await User.find({
            propertyPreferences: { $exists: true, $ne: null }
        });
        console.log(`Users with preferences: ${usersWithPrefs.length}`);

    } catch (error) {
        console.error("Error in update process:", error);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB");
    }
}

// Run the update
updateUsers();

