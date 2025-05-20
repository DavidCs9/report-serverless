const db = require("./database");

function generateMockSiloData() {
  const siloId = Math.floor(Math.random() * 12) + 1; // between 1 - 12
  const value = Math.random() * 100;
  return { siloId, value };
}

async function insertMockSiloData() {
  const mockData = generateMockSiloData();
  const query = `
    INSERT INTO silo_raw_data (silo_id, value)
    VALUES (${mockData.siloId}, ${mockData.value})
  `;
  await db.executeQuery(query);
}

module.exports = insertMockSiloData;
