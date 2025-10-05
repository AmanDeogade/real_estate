const express = require('express');
const app = express();
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

// Import routes
const usersRoute = require('./routes/users');
const authRoute = require('./routes/auth');
const propertiesRoute = require('./routes/properties');
const bookingsRoute = require('./routes/bookings');
const brokersRoute = require('./routes/brokers');

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log(err));

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Route middleware
app.use('/api/users', usersRoute);
app.use('/api/auth', authRoute);
app.use('/api/properties', propertiesRoute);
app.use('/api/bookings', bookingsRoute);
app.use('/api/brokers', brokersRoute);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});