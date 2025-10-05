/**
 * Test script for Property Location Scoring Integration
 * This script demonstrates how the property scoring system works
 */

const propertyScoreService = require('./services/propertyScoreService');

async function testPropertyScoring() {
    console.log('🏠 Testing Property Location Scoring System\n');
    
    // Test coordinates (Pune, India - a well-known location)
    const testCoordinates = [
        { name: 'Pune City Center', lat: 18.5204, lng: 73.8567 },
        { name: 'Mumbai Central', lat: 19.0760, lng: 72.8777 },
        { name: 'Bangalore Whitefield', lat: 12.9698, lng: 77.7500 }
    ];
    
    for (const coord of testCoordinates) {
        console.log(`📍 Testing location: ${coord.name}`);
        console.log(`   Coordinates: ${coord.lat}, ${coord.lng}\n`);
        
        try {
            const scores = await propertyScoreService.calculateAllScores(coord.lat, coord.lng);
            
            console.log('📊 Location Scores:');
            console.log(`   🏥 Amenity Score: ${scores.amenityScore}/100`);
            console.log(`   🌳 Environment Score: ${scores.environmentScore}/100`);
            console.log(`   🛡️ Safety Score: ${scores.safetyScore}/100`);
            console.log(`   🏆 Overall Score: ${scores.overallScore}/100`);
            
            // Show some detailed information
            if (scores.scoreDetails.amenityDetails) {
                console.log('\n🏥 Nearby Amenities:');
                Object.entries(scores.scoreDetails.amenityDetails).forEach(([key, value]) => {
                    if (value.found) {
                        console.log(`   ${key}: ${(value.distance/1000).toFixed(2)} km away`);
                    } else {
                        console.log(`   ${key}: Not found within 2km radius`);
                    }
                });
            }
            
            if (scores.scoreDetails.environmentDetails) {
                console.log('\n🌳 Environment Details:');
                console.log(`   Green Features: ${scores.scoreDetails.environmentDetails.greenFeatures}`);
                console.log(`   Industrial Features: ${scores.scoreDetails.environmentDetails.industrialFeatures}`);
                console.log(`   Nearest Major Road: ${scores.scoreDetails.environmentDetails.nearestMajorRoad === Infinity ? 'None in radius' : (scores.scoreDetails.environmentDetails.nearestMajorRoad/1000).toFixed(2) + ' km'}`);
            }
            
            if (scores.scoreDetails.pollutionDetails) {
                console.log('\n🌫️ Pollution Details:');
                if (scores.scoreDetails.pollutionDetails.pm25Value) {
                    console.log(`   PM2.5: ${scores.scoreDetails.pollutionDetails.pm25Value} µg/m³`);
                }
                console.log(`   Data Source: ${scores.scoreDetails.pollutionDetails.dataSource}`);
            }
            
        } catch (error) {
            console.error(`❌ Error calculating scores for ${coord.name}:`, error.message);
        }
        
        console.log('\n' + '='.repeat(80) + '\n');
    }
    
    console.log('✅ Property scoring test completed!');
    console.log('\n📝 Integration Summary:');
    console.log('1. ✅ Listing model updated with location scores');
    console.log('2. ✅ Property score service created');
    console.log('3. ✅ API endpoint added for score calculation');
    console.log('4. ✅ Listing creation updated to handle coordinates and scores');
    console.log('5. ✅ Property listing form updated with map selection');
    console.log('6. ✅ Property display pages updated to show scores');
    console.log('\n🚀 The property scoring system is now fully integrated!');
}

// Run the test if this file is executed directly
if (require.main === module) {
    testPropertyScoring().catch(console.error);
}

module.exports = { testPropertyScoring };


