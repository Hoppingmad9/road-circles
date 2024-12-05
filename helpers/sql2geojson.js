export default function sql2GeoJSON(db, nodeTable, linkTable) {
  
  const nodes = db.prepare(`SELECT node_id, lat, lon FROM ${nodeTable}`).all()
  const junctionNodes = db.prepare(`SELECT node_id, lat, lon FROM unique_nodes`).all()
  const ways = db.prepare(`
    SELECT 
      simplified_ways.way_id, ${nodeTable}.node_id 
      FROM ${linkTable} 
      INNER JOIN simplified_ways 
        ON ${linkTable}.way_id = simplified_ways.id 
      INNER JOIN ${nodeTable} 
        ON ${linkTable}.node_id = ${nodeTable}.id
  `).all()

  // Create a lookup table for nodes by node_id
  const nodeLookup = nodes.reduce((acc, node) => {
    acc[node.node_id] = node;
    return acc;
  }, {});

  // Group the ways by way_id
  const groupedWays = ways.reduce((acc, way) => {
    if (!acc[way.way_id]) acc[way.way_id] = [];
    acc[way.way_id].push(way.node_id);
    return acc;
  }, {});

  const features = [];

  // Convert junctionNodes into GeoJSON Points
  junctionNodes.forEach((node) => {
    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [node.lon, node.lat], // GeoJSON uses [lon, lat]
      },
      properties: {
        node_id: node.node_id, // Include the node_id as a property
      },
    });
  });

  // Convert grouped ways into GeoJSON LineStrings
  Object.entries(groupedWays).forEach(([way_id, nodeIds]) => {
    const coordinates = nodeIds.map((nodeId) => {
      const node = nodeLookup[nodeId];
      if (!node) {
        throw new Error(`Node with ID ${nodeId} not found`);
      }
      return [node.lon, node.lat]; // GeoJSON uses [lon, lat]
    });

    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: coordinates,
      },
      properties: {
        way_id: way_id, // Include the way_id as a property
      },
    });
  });

  // Create the GeoJSON object
  return {
    type: "FeatureCollection",
    features: features,
  };
}