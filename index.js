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

// get northern most node
// get the way it's part of
// if part of multiple get the way with the northern most other node 
// get eastern most node of the way
// get next way
// if multiple ways get angle between node and previous node, and the node and all possible next nodes, then rotate CW until the first next node is hit
// repeat until back at start 


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

// const geoJSON = createGeoJSON(convexHull);
// saveGeoJSONFile("convexHull.geojson", geoJSON);