# Karnavat&Associates - Real Estate Platform

A comprehensive real estate platform with role-based access and features for buyers, property owners, and brokers.

## Features

### 🔹 Property Discovery & Inquiry (For Users/Buyers)
- Search and filter properties
- Save favorite properties
- Request property visits and contact options
- Personalized recommendations based on preferences

### 🔹 Listing Management (For Admin/Property Listers)
- Add/edit/delete property listings with media uploads
- Track listing views and inquiries
- Set property status: active, under offer, sold/rented
- Assign listings to brokers
- Dashboard with analytics and insights

### 🔹 Lead Management & CRM (For Brokers)
- Auto-capture leads from user interactions
- Lead management with stages (new, contacted, qualified, proposal sent, negotiation, closed)
- Task management with priorities and due dates
- Add notes and follow-ups to leads
- CRM dashboard with statistics and recent activities

## User Types

### Buyer/Renter
- Search and browse properties
- Save favorites
- Submit inquiries
- Receive personalized recommendations

### Property Owner/Agency
- Manage property listings
- Track performance and inquiries
- Assign brokers to listings
- View analytics dashboard

### Real Estate Broker/Agent
- Manage leads and client relationships
- Create and track tasks
- CRM dashboard with lead pipeline
- Property assignment management

## Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Karnavat-Major-Project
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory with:
   ```
   ATLASDB_URL=your_mongodb_connection_string
   SECRET=your_session_secret
   ```

4. **Start the application**
   ```bash
   npm start
   ```

5. **Access the application**
   Open your browser and navigate to `http://localhost:8080`

## Project Structure

```
Karnavat-Major-Project/
├── app.js                 # Main application file
├── models/                # Mongoose schemas
│   ├── user.js           # User model with role-based fields
│   ├── listing.js        # Property listing model
│   ├── lead.js           # Lead management model
│   ├── task.js           # Task management model
│   └── ...
├── routes/                # Express routes
│   ├── listing.js        # Property listing routes
│   ├── lead.js           # Lead management routes
│   ├── task.js           # Task management routes
│   └── ...
├── controllers/           # Business logic
│   ├── listings.js       # Listing management logic
│   └── ...
├── views/                 # EJS templates
│   ├── listings/         # Property-related views
│   ├── leads/            # Lead management views
│   ├── tasks/            # Task management views
│   └── users/            # Authentication views
└── middleware.js          # Authentication and authorization
```

## Key Technologies

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Passport.js with Local Strategy
- **Template Engine**: EJS
- **Frontend**: Bootstrap 5, Font Awesome
- **File Upload**: Multer with Cloudinary integration

## API Endpoints

### Property Listings
- `GET /listings` - Browse all properties
- `GET /listings/search` - Search properties
- `GET /listings/dashboard` - Property owner dashboard
- `GET /listings/broker-dashboard` - Broker CRM dashboard

### Lead Management
- `GET /leads` - View all leads (brokers only)
- `POST /leads` - Create new lead
- `PATCH /leads/:id/status` - Update lead status

### Task Management
- `GET /tasks` - View all tasks (brokers only)
- `POST /tasks` - Create new task
- `PATCH /tasks/:id/complete` - Complete task

## Running the Application

1. **Development Mode**
   ```bash
   npm start
   ```

2. **Production Mode**
   ```bash
   NODE_ENV=production npm start
   ```

## Database Setup

The application uses MongoDB. Make sure you have:
- MongoDB instance running (local or Atlas)
- Proper connection string in your `.env` file
- Required indexes for text search on properties

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please contact the development team.
