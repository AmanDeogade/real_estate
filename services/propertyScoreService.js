const axios = require('axios');

class PropertyScoreService {
    constructor() {
        this.MAX_RADIUS = 2000; // meters
        this.OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
        this.OPENAQ_URL = 'https://api.openaq.org/v2/latest';
    }

    // Haversine formula to calculate distance between two coordinates
    haversine(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // meters
        const toRad = x => x * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    // Categories for amenity scoring
    getAmenityCategories() {
        return [
            { name: "Hospital", query: '["amenity"="hospital"]' },
            { name: "School", query: '["amenity"="school"]' },
            { name: "College", query: '["amenity"="college"]' },
            { name: "Mall", query: '["shop"="mall"]' },
            { name: "Pharmacy", query: '["amenity"="pharmacy"]' },
            { name: "Police Station", query: '["amenity"="police"]' },
            { name: "Bus Stop", query: '["highway"="bus_stop"]' }
        ];
    }

    // Calculate amenity score
    async calculateAmenityScore(lat, lng) {
        const categories = this.getAmenityCategories();
        const results = [];
        
        for (const cat of categories) {
            try {
                const query = `
                    [out:json][timeout:25];
                    (
                        node${cat.query}(around:${this.MAX_RADIUS},${lat},${lng});
                        way${cat.query}(around:${this.MAX_RADIUS},${lat},${lng});
                        relation${cat.query}(around:${this.MAX_RADIUS},${lat},${lng});
                    );
                    out center;
                `;

                const response = await axios.post(this.OVERPASS_URL, query, {
                    headers: { 'Content-Type': 'text/plain' },
                    timeout: 30000
                });

                const data = response.data;
                
                if (!data.elements || data.elements.length === 0) {
                    results.push({ 
                        category: cat.name, 
                        found: false, 
                        distance: null, 
                        element: null 
                    });
                    continue;
                }

                // Find nearest
                let nearest = null, minDist = Infinity;
                for (const el of data.elements) {
                    let elLat, elLon;
                    if (el.type === "node") {
                        elLat = el.lat; 
                        elLon = el.lon;
                    } else if (el.center) {
                        elLat = el.center.lat; 
                        elLon = el.center.lon;
                    } else {
                        continue;
                    }
                    
                    const dist = this.haversine(lat, lng, elLat, elLon);
                    if (dist < minDist) {
                        minDist = dist;
                        nearest = { ...el, elLat, elLon, distance: dist };
                    }
                }

                results.push({
                    category: cat.name,
                    found: nearest !== null,
                    distance: nearest ? nearest.distance : null,
                    element: nearest
                });

            } catch (error) {
                console.error(`Error calculating amenity score for ${cat.name}:`, error);
                results.push({ 
                    category: cat.name, 
                    found: false, 
                    distance: null, 
                    element: null, 
                    error: true 
                });
            }
        }

        // Calculate score
        const weight = 100 / categories.length;
        let total = 0;
        
        for (const r of results) {
            if (!r.found || r.distance == null) continue;
            const ratio = Math.max(0, 1 - Math.min(r.distance, this.MAX_RADIUS) / this.MAX_RADIUS);
            total += weight * ratio;
        }
        
        return {
            score: Math.round(total),
            details: results
        };
    }

    // Calculate environment score
    async calculateEnvironmentScore(lat, lng) {
        try {
            const query = `
                [out:json][timeout:25];
                (
                    node["leisure"="park"](around:${this.MAX_RADIUS},${lat},${lng});
                    way["leisure"="park"](around:${this.MAX_RADIUS},${lat},${lng});
                    relation["leisure"="park"](around:${this.MAX_RADIUS},${lat},${lng});

                    node["landuse"="forest"](around:${this.MAX_RADIUS},${lat},${lng});
                    way["landuse"="forest"](around:${this.MAX_RADIUS},${lat},${lng});
                    relation["landuse"="forest"](around:${this.MAX_RADIUS},${lat},${lng});

                    node["natural"="wood"](around:${this.MAX_RADIUS},${lat},${lng});
                    way["natural"="wood"](around:${this.MAX_RADIUS},${lat},${lng});
                    relation["natural"="wood"](around:${this.MAX_RADIUS},${lat},${lng});

                    node["landuse"="industrial"](around:${this.MAX_RADIUS},${lat},${lng});
                    way["landuse"="industrial"](around:${this.MAX_RADIUS},${lat},${lng});
                    relation["landuse"="industrial"](around:${this.MAX_RADIUS},${lat},${lng});

                    node["industrial"="yes"](around:${this.MAX_RADIUS},${lat},${lng});
                    way["industrial"="yes"](around:${this.MAX_RADIUS},${lat},${lng});
                    relation["industrial"="yes"](around:${this.MAX_RADIUS},${lat},${lng});

                    node["highway"~"primary|secondary|tertiary|trunk"](around:${this.MAX_RADIUS},${lat},${lng});
                    way["highway"~"primary|secondary|tertiary|trunk"](around:${this.MAX_RADIUS},${lat},${lng});
                    relation["highway"~"primary|secondary|tertiary|trunk"](around:${this.MAX_RADIUS},${lat},${lng});
                );
                out center;
            `;

            const response = await axios.post(this.OVERPASS_URL, query, {
                headers: { 'Content-Type': 'text/plain' },
                timeout: 30000
            });

            const data = response.data;
            let greenCount = 0;
            let industrialCount = 0;
            let nearestRoadDist = Infinity;
            
            if (data.elements && data.elements.length) {
                for (const el of data.elements) {
                    const tags = el.tags || {};
                    
                    // Count green features
                    if (tags.leisure === 'park' || tags.landuse === 'forest' || 
                        tags.natural === 'wood' || tags.leisure === 'garden') {
                        greenCount++;
                    }
                    
                    // Count industrial features
                    if (tags.landuse === 'industrial' || tags.industrial === 'yes') {
                        industrialCount++;
                    }
                    
                    // Find nearest major road
                    if (tags.highway && /primary|secondary|tertiary|trunk/.test(tags.highway)) {
                        let elLat, elLon;
                        if (el.type === 'node') { 
                            elLat = el.lat; 
                            elLon = el.lon; 
                        } else if (el.center) { 
                            elLat = el.center.lat; 
                            elLon = el.center.lon; 
                        }
                        if (elLat != null) {
                            const d = this.haversine(lat, lng, elLat, elLon);
                            if (d < nearestRoadDist) nearestRoadDist = d;
                        }
                    }
                }
            }

            // Calculate score
            const greenNormalized = Math.min(1, greenCount / 8);
            const industrialPresent = industrialCount > 0;
            const roadNormalized = nearestRoadDist === Infinity ? 1 : Math.min(1, nearestRoadDist / this.MAX_RADIUS);

            const W_GREEN = 0.6, W_ROAD = 0.25, W_INDUSTRY = 0.15;
            const envScoreRaw = (greenNormalized * W_GREEN + roadNormalized * W_ROAD + (industrialPresent ? 0 : 1) * W_INDUSTRY);
            const envScore = Math.round(envScoreRaw * 100);

            return {
                score: envScore,
                details: {
                    greenFeatures: greenCount,
                    industrialFeatures: industrialCount,
                    nearestMajorRoad: nearestRoadDist
                }
            };

        } catch (error) {
            console.error('Error calculating environment score:', error);
            return {
                score: 50, // Default score
                details: {
                    greenFeatures: 0,
                    industrialFeatures: 0,
                    nearestMajorRoad: Infinity
                }
            };
        }
    }

    // Calculate safety score
    async calculateSafetyScore(lat, lng) {
        try {
            const query = `
                [out:json][timeout:25];
                (
                    node["amenity"="police"](around:${this.MAX_RADIUS},${lat},${lng});
                    way["amenity"="police"](around:${this.MAX_RADIUS},${lat},${lng});
                    relation["amenity"="police"](around:${this.MAX_RADIUS},${lat},${lng});

                    node["surveillance"="camera"](around:${this.MAX_RADIUS},${lat},${lng});
                    way["surveillance"="camera"](around:${this.MAX_RADIUS},${lat},${lng});
                    relation["surveillance"="camera"](around:${this.MAX_RADIUS},${lat},${lng});

                    node["amenity"="bar"](around:${this.MAX_RADIUS},${lat},${lng});
                    node["amenity"="nightclub"](around:${this.MAX_RADIUS},${lat},${lng});
                    node["amenity"="pub"](around:${this.MAX_RADIUS},${lat},${lng});
                    node["shop"="alcohol"](around:${this.MAX_RADIUS},${lat},${lng});
                    way["amenity"="bar"](around:${this.MAX_RADIUS},${lat},${lng});
                    way["amenity"="nightclub"](around:${this.MAX_RADIUS},${lat},${lng});
                    way["amenity"="pub"](around:${this.MAX_RADIUS},${lat},${lng});
                    way["shop"="alcohol"](around:${this.MAX_RADIUS},${lat},${lng});
                );
                out center;
            `;

            const response = await axios.post(this.OVERPASS_URL, query, {
                headers: { 'Content-Type': 'text/plain' },
                timeout: 30000
            });

            const data = response.data;
            let policeCount = 0, cctvCount = 0, nightlifeCount = 0;
            let nearestPoliceDist = Infinity;
            
            if (data.elements && data.elements.length) {
                for (const el of data.elements) {
                    const tags = el.tags || {};
                    
                    if (tags.amenity === 'police') {
                        policeCount++;
                        let elLat, elLon;
                        if (el.type === 'node') { 
                            elLat = el.lat; 
                            elLon = el.lon; 
                        } else if (el.center) { 
                            elLat = el.center.lat; 
                            elLon = el.center.lon; 
                        }
                        if (elLat != null) {
                            const d = this.haversine(lat, lng, elLat, elLon);
                            if (d < nearestPoliceDist) nearestPoliceDist = d;
                        }
                    }
                    
                    if (tags.surveillance === 'camera') cctvCount++;
                    if (tags.amenity === 'bar' || tags.amenity === 'nightclub' || 
                        tags.amenity === 'pub' || tags.shop === 'alcohol') {
                        nightlifeCount++;
                    }
                }
            }

            // Calculate score
            const policeProxNorm = nearestPoliceDist === Infinity ? 0 : Math.max(0, 1 - Math.min(nearestPoliceDist, this.MAX_RADIUS) / this.MAX_RADIUS);
            const policeCountNorm = Math.min(1, policeCount / 3);
            const cctvNorm = Math.min(1, cctvCount / 5);
            const nightlifeNorm = Math.min(1, nightlifeCount / 5);

            const P_POLICE_PROX = 0.4, P_POLICE_COUNT = 0.2, P_CCTV = 0.15, P_ROAD = 0.15, P_NIGHTLIFE_PENALTY = 0.1;

            let safetyRaw = 0;
            safetyRaw += policeProxNorm * P_POLICE_PROX;
            safetyRaw += policeCountNorm * P_POLICE_COUNT;
            safetyRaw += cctvNorm * P_CCTV;
            safetyRaw += 0.5 * P_ROAD; // Default road score
            safetyRaw -= nightlifeNorm * P_NIGHTLIFE_PENALTY;

            safetyRaw = Math.max(0, Math.min(1, safetyRaw));
            const safetyScore = Math.round(safetyRaw * 100);

            return {
                score: safetyScore,
                details: {
                    policeStations: policeCount,
                    nearestPoliceDistance: nearestPoliceDist,
                    cctvCameras: cctvCount,
                    nightlifeSpots: nightlifeCount
                }
            };

        } catch (error) {
            console.error('Error calculating safety score:', error);
            return {
                score: 50, // Default score
                details: {
                    policeStations: 0,
                    nearestPoliceDistance: Infinity,
                    cctvCameras: 0,
                    nightlifeSpots: 0
                }
            };
        }
    }

    // Calculate pollution score
    async calculatePollutionScore(lat, lng) {
        try {
            const radiusForOpenAQ = Math.min(50000, this.MAX_RADIUS * 10);
            const url = `${this.OPENAQ_URL}?coordinates=${lat},${lng}&radius=${radiusForOpenAQ}&parameter=pm25&limit=10`;
            
            const response = await axios.get(url, { timeout: 10000 });
            const data = response.data;
            
            let pm25Value = null;
            if (data && data.results && data.results.length) {
                for (const loc of data.results) {
                    if (loc && loc.measurements && loc.measurements.length) {
                        const m = loc.measurements.find(x => x.parameter === 'pm25');
                        if (m && typeof m.value === 'number') { 
                            pm25Value = m.value; 
                            break; 
                        }
                    }
                }
            }

            let pollutionScore;
            let dataSource = 'measured';
            
            if (pm25Value != null) {
                const capped = Math.max(0, Math.min(250, pm25Value));
                pollutionScore = Math.round((1 - capped / 250) * 100);
            } else {
                // Fallback to environment-based estimate
                const envResult = await this.calculateEnvironmentScore(lat, lng);
                pollutionScore = Math.max(0, 100 - envResult.score);
                dataSource = 'estimated';
            }

            return {
                score: pollutionScore,
                details: {
                    pm25Value: pm25Value,
                    dataSource: dataSource
                }
            };

        } catch (error) {
            console.error('Error calculating pollution score:', error);
            return {
                score: 50, // Default score
                details: {
                    pm25Value: null,
                    dataSource: 'default'
                }
            };
        }
    }

    // Calculate all scores for a location
    async calculateAllScores(lat, lng) {
        try {
            console.log(`Calculating scores for location: ${lat}, ${lng}`);
            
            // Calculate all scores in parallel
            const [amenityResult, environmentResult, safetyResult, pollutionResult] = await Promise.all([
                this.calculateAmenityScore(lat, lng),
                this.calculateEnvironmentScore(lat, lng),
                this.calculateSafetyScore(lat, lng),
                this.calculatePollutionScore(lat, lng)
            ]);

            // Calculate overall score (weighted average)
            const weights = { amenity: 0.3, environment: 0.25, safety: 0.25, pollution: 0.2 };
            const overallScore = Math.round(
                amenityResult.score * weights.amenity +
                environmentResult.score * weights.environment +
                safetyResult.score * weights.safety +
                pollutionResult.score * weights.pollution
            );

            // Format amenity details
            const amenityDetails = {};
            amenityResult.details.forEach(detail => {
                const key = detail.category.toLowerCase().replace(' ', '');
                amenityDetails[key] = {
                    distance: detail.distance,
                    found: detail.found
                };
            });

            const scores = {
                amenityScore: amenityResult.score,
                environmentScore: environmentResult.score,
                safetyScore: safetyResult.score,
                pollutionScore: pollutionResult.score,
                overallScore: overallScore,
                scoreDetails: {
                    amenityDetails: amenityDetails,
                    environmentDetails: environmentResult.details,
                    safetyDetails: safetyResult.details,
                    pollutionDetails: pollutionResult.details
                },
                scoresCalculatedAt: new Date()
            };

            console.log('Scores calculated:', scores);
            return scores;

        } catch (error) {
            console.error('Error calculating all scores:', error);
            throw error;
        }
    }
}

module.exports = new PropertyScoreService();


