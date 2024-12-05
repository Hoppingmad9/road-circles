import osm2sql from './helpers/osm2sql.js';
import Database from 'better-sqlite3'
import sql2GeoJSON from './helpers/sql2geojson.js';
import writeGeoJsonFile from './helpers/writeGeoJSON.js';
import cleanRoadData from './helpers/cleanRoadData.js';
import fs from 'node:fs'

const filename = 'sample_data'
const db = new Database(`${filename}.sqlite`, {})
// const db = new Database(`${filename}.sqlite`, { verbose: console.log })
db.pragma('journal_mode = WAL')

const importData = false
if (importData) {
  await osm2sql(db, filename)
}

const cleanData = true
if (cleanData) {
  cleanRoadData(db, filename)
}

// const mostNorthernNode = db.prepare(`SELECT * FROM unique_nodes ORDER BY lat DESC LIMIT 1`).all()
// console.log(mostNorthernNode)

// Utility functions to determine orientation of points and check if point is on the convex hull
function cross(o, a, b) {
  if (!o || !a || !b) {
      throw new Error("Invalid points passed to cross function.");
  }
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function merge(left, right) {
  if (left.length === 0) return right; // If left is empty, return right
  if (right.length === 0) return left; // If right is empty, return left

  const result = [];

  // Start merging
  let i = 0, j = 0;

  while (i < left.length && j < right.length) {
      // Compare points and add the "better" one to the result
      if (cross(result[result.length - 1] || left[0], left[i], right[j]) <= 0) {
          result.push(left[i]);
          i++;
      } else {
          result.push(right[j]);
          j++;
      }
  }

  // Add remaining points from `left` or `right`
  while (i < left.length) {
      result.push(left[i]);
      i++;
  }

  while (j < right.length) {
      result.push(right[j]);
      j++;
  }

  return result;
}


function grahamScan(points) {
  if (points.length === 0) {
      return [];
  }
  // Sort points based on x-coordinate (and y-coordinate as tie-breaker)
  points.sort((a, b) => a.x - b.x || a.y - b.y);

  const lower = [];
  for (let i = 0; i < points.length; i++) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) {
          lower.pop();
      }
      lower.push(points[i]);
  }

  const upper = [];
  for (let i = points.length - 1; i >= 0; i--) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) {
          upper.pop();
      }
      upper.push(points[i]);
  }

  upper.pop(); // Remove the last point of upper hull because it's repeated in lower hull
  lower.pop(); // Remove the last point of lower hull because it's repeated in upper hull
  return lower.concat(upper);
}

// Chan's Algorithm for convex hull
function chansAlgorithm(points, k) {
  // Step 1: Divide points into k groups
  const groups = [];
  const groupSize = Math.ceil(points.length / k);
  for (let i = 0; i < k; i++) {
      groups.push(points.slice(i * groupSize, Math.min((i + 1) * groupSize, points.length)));
  }

  // Step 2: Compute convex hull for each group using Graham's scan
  const convexHulls = groups.map(group => grahamScan(group));

  // Step 3: Merge convex hulls
  let hull = convexHulls[0];
  for (let i = 1; i < convexHulls.length; i++) {
      hull = merge(hull, convexHulls[i]);
  }

  return hull;
}

// Example usage
// const points = [
//   { x: 0, y: 0 },
//   { x: 1, y: 1 },
//   { x: 2, y: 2 },
//   { x: 3, y: 3 },
//   { x: 0, y: 3 },
//   { x: 3, y: 0 },
//   { x: 1, y: 2 },
//   { x: 2, y: 1 },
// ];

const points = db.prepare(`SELECT * FROM unique_nodes`).all().map(({ lat, lon }) => ({ x: lat, y: lon }))

const k = 1 // Number of groups to divide the points into
const convexHull = chansAlgorithm(points, k);

console.log("Convex Hull Points:");
console.log(convexHull);

function createGeoJSON(convexHullPoints) {
  // Ensure the hull forms a closed loop
  const coordinates = convexHullPoints.map(point => [point.y, point.x]);
  if (coordinates.length > 0 && (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || 
                                 coordinates[0][1] !== coordinates[coordinates.length - 1][1])) {
      coordinates.push(coordinates[0]); // Close the loop
  }

  // Create the GeoJSON structure
  const geoJSON = {
      type: "FeatureCollection",
      features: [
          {
              type: "Feature",
              geometry: {
                  type: "Polygon",
                  coordinates: [coordinates],
              },
              properties: {},
          },
      ],
  };

  return geoJSON;
}

function saveGeoJSONFile(filename, geoJSON) {
  fs.writeFileSync(filename, JSON.stringify(geoJSON, null, 2));
  console.log(`GeoJSON file saved to ${filename}`);
}

const geoJSON = createGeoJSON(convexHull);
saveGeoJSONFile("convexHull.geojson", geoJSON);