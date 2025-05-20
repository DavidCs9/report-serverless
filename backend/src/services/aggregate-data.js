const db = require("./database");

async function aggregateLastHourData() {
  const query = `
    SELECT silo_id, AVG(value) as avg_value
    FROM silo_raw_data
    GROUP BY silo_id
    WHERE timestamp >= NOW() - INTERVAL 1 HOUR
  `;
  const result = await db.executeQuery(query);
  return result;
}

module.exports = aggregateLastHourData;
