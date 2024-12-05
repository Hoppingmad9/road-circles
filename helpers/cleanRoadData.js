import writeGeoJSON from "./writeGeoJSON.js"

function removePartialDeadEnds(db) {
  // removes nodes from ways that are outside conencting nodes
  let changes = 0
  changes += db.prepare(`
    WITH duplicated_nodes AS (
        SELECT node_id
        FROM way_links
        GROUP BY node_id
        HAVING COUNT(*) > 1
    ),
    id_boundaries AS (
        SELECT way_id,
              MAX(id) AS max_id,
              MIN(id) AS min_id
        FROM way_links
        WHERE node_id IN (SELECT node_id FROM duplicated_nodes)
        GROUP BY way_id
    ),
    rows_to_delete AS (
        SELECT wl.id
        FROM way_links wl
        LEFT JOIN id_boundaries ib
          ON wl.way_id = ib.way_id
        WHERE wl.node_id NOT IN (SELECT node_id FROM duplicated_nodes) -- unique node_id
          AND (wl.id > ib.max_id OR wl.id < ib.min_id)
    )
    DELETE FROM way_links
    WHERE id IN (SELECT id FROM rows_to_delete);
  `).run().changes
  return changes
}

function removeUniqueNodes(db) {
  // remove nodes that only appear in 1 way
  let changes = 0
  changes += db.prepare(`
    DELETE FROM simplified_links
    WHERE node_id NOT IN (
        SELECT node_id
        FROM (
            SELECT node_id
            FROM simplified_links
            GROUP BY node_id
            HAVING COUNT(*) > 1
        ) subquery
    );
  `).run().changes
  changes += db.prepare(`
    DELETE FROM unique_nodes
    WHERE id NOT IN (
        SELECT node_id
        FROM simplified_links
    );
  `).run().changes
  return changes
}

function removeDeadEnds(db) {
  // remove ways that only connect to one way
  let changes = 0
  changes += db.prepare(`
    DELETE FROM simplified_links
    WHERE way_id NOT IN (
        SELECT way_id
        FROM (
            SELECT way_id
            FROM simplified_links
            GROUP BY way_id
            HAVING COUNT(*) > 1
        ) subquery
    );
  `).run().changes
  changes += db.prepare(`
    DELETE FROM way_links
    WHERE way_id NOT IN (
        SELECT way_id
        FROM (
            SELECT way_id
            FROM simplified_links
            GROUP BY way_id
            HAVING COUNT(*) > 1
        ) subquery
    );
  `).run().changes
  changes += db.prepare(`
    DELETE FROM simplified_ways
    WHERE id NOT IN (
        SELECT way_id
        FROM simplified_links
    );
  `).run().changes
  changes += db.prepare(`
    DELETE FROM way_nodes
    WHERE id NOT IN (
        SELECT node_id
        FROM way_links
    );
  `).run().changes
  return changes
}

function prepareTables(db) {
  db.prepare(`DROP TABLE IF EXISTS unique_nodes`).run()
  db.prepare(`DROP TABLE IF EXISTS way_nodes`).run()
  db.prepare(`DROP TABLE IF EXISTS simplified_ways`).run()
  db.prepare(`DROP TABLE IF EXISTS simplified_links`).run()
  db.prepare(`DROP TABLE IF EXISTS way_links`).run()
  db.prepare(`CREATE TABLE unique_nodes AS SELECT * FROM nodes`).run()
  db.prepare(`CREATE TABLE way_nodes AS SELECT * FROM nodes`).run()
  db.prepare(`CREATE TABLE simplified_ways AS SELECT * FROM ways`).run()
  db.prepare(`CREATE TABLE simplified_links AS SELECT * FROM links`).run()
  db.prepare(`CREATE TABLE way_links AS SELECT * FROM links`).run()
}

export default function(db, filename) {
  prepareTables(db)
  writeGeoJSON(db, filename+'_initial')
  let changes
  do {
    changes = 0
    changes += removeUniqueNodes(db)
    changes += removeDeadEnds(db)
    changes += removePartialDeadEnds(db)
    console.log(`${changes} simplifications`)
  } while (changes > 0);
  writeGeoJSON(db, filename+'_simplified')
}