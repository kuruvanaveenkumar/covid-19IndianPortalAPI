const express = require("express");
const app = express();
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
app.use(express.json());
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

let dataBase = null;
const initializeDbAndServer = async () => {
  try {
    dataBase = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

const authenticationToken = (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "abc", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const getDetail = await dataBase.get(getQuery);

  if (getDetail === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const validPassword = await bcrypt.compare(password, getDetail.password);
    if (validPassword === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "abc");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const convertObject = (each) => {
  return {
    stateId: each.state_id,
    stateName: each.state_name,
    population: each.population,
  };
};

app.get("/states/", authenticationToken, async (request, response) => {
  const getQuery = `SELECT * FROM state;`;
  const getDetails = await dataBase.all(getQuery);
  response.send(getDetails.map((each) => convertObject(each)));
});

app.get("/states/:stateId", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const db = `SELECT * FROM state WHERE state_id = '${stateId}';`;
  const getDb = await dataBase.get(db);
  response.send({
    stateId: getDb.state_id,
    stateName: getDb.state_name,
    population: getDb.population,
  });
});

app.post("/districts/", authenticationToken, async (request, response) => {
  const getQuery = `SELECT * FROM district;`;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;

  const addQuery = `INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
                      VALUES('${districtName}', '${stateId}', '${cases}', '${cured}', '${active}', '${deaths}');`;
  await dataBase.run(addQuery);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getQuery = `SELECT * FROM district WHERE district_id = '${districtId}';`;
    const getDetail = await dataBase.get(getQuery);
    response.send({
      districtId: getDetail.district_id,
      districtName: getDetail.district_name,
      stateId: getDetail.state_id,
      cases: getDetail.cases,
      cured: getDetail.cured,
      active: getDetail.active,
      deaths: getDetail.deaths,
    });
  }
);

app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;

    const deleteQuery = `DELETE FROM district WHERE district_id = '${districtId}';`;
    await dataBase.run(deleteQuery);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateQuery = `UPDATE district SET
                              district_name = '${districtName}',
                              state_id = '${stateId}',
                              cases = '${cases}',
                              cured = '${cured}',
                              active = '${active}',
                              deaths = '${deaths}'
                              WHERE district_id = '${districtId}';`;
    await dataBase.run(updateQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const sumQuery = `SELECT 
                       SUM(cases) AS totalCases,
                       SUM(cured) AS totalCured,
                       SUM(active) AS totalActive,
                       SUM(deaths) AS totalDeaths
                       FROM state NATURAL JOIN district WHERE state_id = '${stateId}' GROUP BY state_id;`;
    const getDetails = await dataBase.get(sumQuery);
    response.send(getDetails);
  }
);

module.exports = app;
