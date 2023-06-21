const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
app.use(express.json());

let db = null;

const intializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () =>
      console.log("Server running at http://localhost:3000/")
    );
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

intializeDBAndServer();

const convertDBObjToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDBObjToStateObject = (dbObject) => {
  return {
    stateName: dbObject.state_name,
  };
};

const convertDBObjToResponseDistrictObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

const convertDBObjToStateStatsResponseObject = (dbObject) => {
  return {
    totalCases: dbObject["SUM(cases)"],
    totalCured: dbObject["SUM(cured)"],
    totalActive: dbObject["SUM(active)"],
    totalDeaths: dbObject["SUM(deaths)"],
  };
};

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// API1 login with POST

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
      console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// GET States API1

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
    SELECT *
    FROM state;`;
  const stateArray = await db.all(getStatesQuery);
  response.send(
    stateArray.map((eachObj) => convertDBObjToResponseObject(eachObj))
  );
});

// GET State API2

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
        SELECT *
        FROM state
        WHERE 
        state_id = ${stateId};`;
  const state = await db.get(getStateQuery);
  console.log(state);
  response.send(convertDBObjToResponseObject(state));
});

// POST District API3

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const PostDistrictQuery = `
    INSERT INTO
        district(district_name,state_id,cases,cured,active,deaths)
    VALUES
        ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  await db.run(PostDistrictQuery);
  response.send("District Successfully Added");
});

// GET District API4

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
        SELECT *
        FROM district
        WHERE 
       district_id = ${districtId};`;
    const district = await db.get(getDistrictQuery);
    console.log(district);
    response.send(convertDBObjToResponseDistrictObject(district));
  }
);

// DELETE a District API5

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
  DELETE FROM
    district
  WHERE
    district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// PUT (update) a District API6

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const { districtId } = request.params;
    const updateDistrictQuery = `
  UPDATE
    district
  SET
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
  WHERE
    district_id = ${districtId};`;

    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

// GET State STATS API7

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateQuery = `
        SELECT 
            SUM(cases),
            SUM(cured),
            SUM(active),
            SUM(deaths)
        FROM district
        WHERE 
        state_id = ${stateId};`;
    const state = await db.get(getStateQuery);
    console.log(state);
    response.send(convertDBObjToStateStatsResponseObject(state));
  }
);

// GET State Name based on district_id API8

app.get(
  "/districts/:districtId/details/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getStateQuery = `
        SELECT 
            *
        FROM district
        WHERE 
        district_id = ${districtId};`;
    const state = await db.get(getStateQuery);
    console.log(state);
    const getStateNameQuery = `
    SELECT state_name as stateName FROM state
    where state_id = ${state.state_id};
    `;
    const getStateNameQueryResponse = await db.get(getStateNameQuery);
    response.send(getStateNameQueryResponse);
  }
);

module.exports = app;
