import sql2GeoJSON from "./sql2geojson.js"
import fs from 'node:fs'

export default async function(db, filename) {
  
  const geoJSONData = sql2GeoJSON(db, 'way_nodes', 'way_links')

  fs.writeFileSync(`./geoJsonData/${filename}.geojson`, JSON.stringify(geoJSONData,null, 2))
}