# Property Location Scoring Integration

## Overview

This integration adds a comprehensive location scoring system to the WanderLust property listing platform. When property owners list their properties, they can now select the exact location on a map and receive detailed scores based on nearby amenities, environment, safety, and pollution data.

## Features

### 🗺️ Interactive Map Selection
- Property owners can click on a map to select their property's exact location
- Uses Leaflet.js for interactive mapping
- Centered on Pune, India by default (easily configurable)

### 📊 Comprehensive Location Scoring
The system calculates four main scores (0-100 scale):

1. **🏥 Amenity Score**: Based on proximity to essential facilities
   - Hospitals, Schools, Colleges
   - Malls, Pharmacies, Police Stations
   - Bus Stops and public transportation

2. **🌳 Environment Score**: Based on environmental factors
   - Green spaces (parks, forests, gardens)
   - Industrial areas (negative impact)
   - Distance to major roads

3. **🛡️ Safety Score**: Based on security indicators
   - Police station proximity and count
   - CCTV camera presence
   - Nightlife density (safety factor)
   - Distance from major roads

4. **🌫️ Pollution Score**: Based on air quality data
   - Real-time PM2.5 data from OpenAQ API
   - Fallback estimation based on environment score

### 🏆 Overall Score
A weighted combination of all scores:
- Amenity: 30%
- Environment: 25%
- Safety: 25%
- Pollution: 20%

## Technical Implementation

### Database Schema Updates

The `Listing` model has been extended with:

```javascript
locationScores: {
    amenityScore: { type: Number, min: 0, max: 100 },
    environmentScore: { type: Number, min: 0, max: 100 },
    safetyScore: { type: Number, min: 0, max: 100 },
    pollutionScore: { type: Number, min: 0, max: 100 },
    overallScore: { type: Number, min: 0, max: 100 },
    scoreDetails: {
        amenityDetails: { /* detailed amenity data */ },
        environmentDetails: { /* environment metrics */ },
        safetyDetails: { /* safety indicators */ },
        pollutionDetails: { /* pollution data */ }
    },
    scoresCalculatedAt: { type: Date }
}
```

### API Endpoints

#### POST `/listings/api/calculate-scores`
Calculates location scores for given coordinates.

**Request:**
```json
{
    "latitude": 18.5204,
    "longitude": 73.8567
}
```

**Response:**
```json
{
    "success": true,
    "scores": {
        "amenityScore": 85,
        "environmentScore": 72,
        "safetyScore": 78,
        "pollutionScore": 65,
        "overallScore": 75,
        "scoreDetails": { /* detailed breakdown */ }
    }
}
```

### Services

#### PropertyScoreService
Located in `services/propertyScoreService.js`, this service:
- Queries OpenStreetMap data via Overpass API
- Fetches real-time pollution data from OpenAQ
- Calculates comprehensive location scores
- Handles errors gracefully with fallback scores

### Frontend Integration

#### Property Listing Form (`views/listings/new.ejs`)
- Interactive map modal for location selection
- Real-time score calculation and display
- Loading states and error handling
- Responsive design with Bootstrap

#### Property Display (`views/listings/show.ejs`)
- Visual score display with color-coded cards
- Expandable detailed score information
- Shows calculation date and data sources

## Data Sources

### OpenStreetMap (via Overpass API)
- Amenity locations (hospitals, schools, etc.)
- Environmental features (parks, forests, industrial areas)
- Safety indicators (police stations, CCTV cameras)
- Infrastructure (roads, public transport)

### OpenAQ API
- Real-time air quality data (PM2.5)
- Global coverage with fallback estimation
- Data source attribution

## Usage Instructions

### For Property Owners

1. **Create New Listing**: Go to `/listings/new`
2. **Fill Basic Information**: Complete property details
3. **Select Location**: Click "Select Location on Map"
4. **Choose Property Location**: Click on the map where your property is located
5. **Confirm Selection**: Click "Confirm Location" to calculate scores
6. **Review Scores**: View the calculated location scores
7. **Complete Listing**: Fill remaining details and submit

### For Property Viewers

1. **Browse Properties**: View listings at `/listings`
2. **View Property Details**: Click on any property
3. **Check Location Scores**: Scroll to the "Location Scores" section
4. **View Details**: Click "View Detailed Scores" for breakdown

## Configuration

### Map Center
To change the default map center, update in `views/listings/new.ejs`:
```javascript
const defaultCenter = [18.5204, 73.8567]; // [latitude, longitude]
```

### Search Radius
To modify the search radius, update in `services/propertyScoreService.js`:
```javascript
this.MAX_RADIUS = 2000; // meters
```

### Score Weights
To adjust score weights, update in `services/propertyScoreService.js`:
```javascript
const weights = { 
    amenity: 0.3, 
    environment: 0.25, 
    safety: 0.25, 
    pollution: 0.2 
};
```

## Error Handling

The system includes comprehensive error handling:
- API timeouts and failures
- Missing data graceful degradation
- Fallback scores when external APIs are unavailable
- User-friendly error messages

## Performance Considerations

- Scores are calculated once during property creation
- External API calls are optimized with timeouts
- Parallel processing for multiple score calculations
- Caching of score results in database

## Dependencies

### New Dependencies Added
- `axios`: For HTTP requests to external APIs

### External APIs Used
- Overpass API (OpenStreetMap data)
- OpenAQ API (air quality data)
- Leaflet.js (map functionality)

## Testing

Run the test script to verify the integration:
```bash
node test-property-scores.js
```

This will test the scoring system with sample coordinates and display the results.

## Future Enhancements

Potential improvements for the system:
1. **Caching**: Implement Redis caching for frequently requested locations
2. **Batch Processing**: Calculate scores for multiple properties simultaneously
3. **Historical Data**: Track score changes over time
4. **Custom Weights**: Allow users to customize score importance
5. **More Data Sources**: Integrate additional environmental and safety data
6. **Mobile Optimization**: Enhanced mobile map experience

## Support

For issues or questions regarding the property scoring integration:
1. Check the console logs for detailed error information
2. Verify external API connectivity
3. Ensure all dependencies are installed
4. Review the test script output for debugging

---

**Note**: This integration enhances the property listing experience by providing valuable location insights to both property owners and potential buyers/renters, helping them make informed decisions based on comprehensive location data.


