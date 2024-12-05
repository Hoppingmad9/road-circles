import fs from 'node:fs'
import readline from 'readline'

export default async function osm2sql(db, filename) {
  await createNodeTable(db)
  await createWayTable(db)
  await createLinkTable(db)
  const roadDataFile = `./data/${filename}.xml`
  const roadDataStream = fs.createReadStream(roadDataFile, {
    flag: 'r',
    encoding: 'UTF-8'
  })

  const roadDataLines = readline.createInterface({
    input: roadDataStream,
    crlfDelay: Infinity
  })

  let insideWay = false
  let wayDbId = null

  let numberWays = 0
  let numberExternalNodes = 0
  let numberInternalNodes = 0

  for await (const line of roadDataLines) {
    const internalNodeSearchTerm = '<nd ref="'
    const externalNodeSearchTerm = '<node id="'
    const wayStartSearchTerm = '<way id="'
    const wayEndSearchTerm = '</way>'

    // way start
    const wayIdStartPos = line.indexOf(wayStartSearchTerm)
    if (wayIdStartPos !== -1) {
      if (insideWay) {
        console.log('error: way inside way')
        return 0
      }
      insideWay = true
      numberWays++
      const wayIdEndPos = line.indexOf('">')
      const wayId = line.substring(wayIdStartPos+wayStartSearchTerm.length,wayIdEndPos)
      const result = db.prepare(`INSERT INTO 'ways' VALUES (?,?)`).run(null, wayId)
      wayDbId = result.lastInsertRowid
    }

    // way end
    const wayEndPos = line.indexOf(wayEndSearchTerm)
    if (wayEndPos !== -1) {
      if (!insideWay) {
        console.log('error: end way outside way')
        return 0
      }
      insideWay = false
    }

    // external node

    const nodeIdStartPos = line.indexOf(externalNodeSearchTerm)
    if (nodeIdStartPos !== -1) {
      if (insideWay) {
        console.log('error: external node inside way')
        return 0
      }
      numberExternalNodes++
      const nodeIdEndPos = line.indexOf('"',nodeIdStartPos+externalNodeSearchTerm.length)
      const nodeId = line.substring(nodeIdStartPos+externalNodeSearchTerm.length,nodeIdEndPos)
      const lat = line.substring(line.indexOf('lat="')+5,line.indexOf('"',line.indexOf('lat="')+5))
      const lon = line.substring(line.indexOf('lon="')+5,line.indexOf('"',line.indexOf('lon="')+5))
      const result = db.prepare(`INSERT INTO 'nodes' VALUES (?,?,?,?)`).run(null, nodeId, lat, lon)
    }

    // internal node
    const nodeRefStartPos = line.indexOf(internalNodeSearchTerm)
    if (nodeRefStartPos !== -1) {
      if (!insideWay) {
        console.log('error: internal node outside way')
        return 0
      }
      numberInternalNodes++
      const nodeRefEndPos = line.indexOf('"/>')
      const nodeRef = line.substring(nodeRefStartPos+internalNodeSearchTerm.length,nodeRefEndPos)
      const result = db.prepare(`SELECT id FROM 'nodes' WHERE node_id = ?`).all(nodeRef)
      const nodeDbId = result[0].id
      db.prepare(`INSERT INTO 'links' VALUES (?,?,?)`).run(null, wayDbId, nodeDbId)
    }
  }
  console.log(numberWays)
  console.log(numberExternalNodes)
  console.log(numberInternalNodes)
  return 1
}

async function createNodeTable(db) {
  const tableName = 'nodes'
  db.prepare(`DROP TABLE IF EXISTS ${tableName}`).run()
  const checkQuery = 'SELECT name FROM sqlite_master WHERE name = ?'
  const checkTable = db.prepare(checkQuery)
  const checkResult = checkTable.all(tableName)
  if (checkResult.length === 0) {
    const fields = `(
      'id' INTEGER PRIMARY KEY AUTOINCREMENT,
      'node_id' INTEGER,
      'lat' INTEGER,
      'lon' INTEGER
    )`
    const createQuery = `CREATE TABLE IF NOT EXISTS '${tableName}' ${fields}`
    const createTable = db.prepare(createQuery)
    const createResult = createTable.run()
  }
}

async function createWayTable(db) {
  const tableName = 'ways'
  db.prepare(`DROP TABLE IF EXISTS ${tableName}`).run()
  const checkQuery = 'SELECT name FROM sqlite_master WHERE name = ?'
  const checkTable = db.prepare(checkQuery)
  const checkResult = checkTable.all(tableName)
  if (checkResult.length === 0) {
    const fields = `(
      'id' INTEGER PRIMARY KEY AUTOINCREMENT,
      'way_id' INTEGER
    )`
    const createQuery = `CREATE TABLE IF NOT EXISTS '${tableName}' ${fields}`
    const createTable = db.prepare(createQuery)
    const createResult = createTable.run()
  }
}

async function createLinkTable(db) {
  const tableName = 'links'
  db.prepare(`DROP TABLE IF EXISTS ${tableName}`).run()
  const checkQuery = 'SELECT name FROM sqlite_master WHERE name = ?'
  const checkTable = db.prepare(checkQuery)
  const checkResult = checkTable.all(tableName)
  if (checkResult.length === 0) {
    const fields = `(
      'id' INTEGER PRIMARY KEY AUTOINCREMENT,
      'way_id' INTEGER,
      'node_id' INTEGER
    )`
    const createQuery = `CREATE TABLE IF NOT EXISTS '${tableName}' ${fields}`
    const createTable = db.prepare(createQuery)
    const createResult = createTable.run()
  }
}