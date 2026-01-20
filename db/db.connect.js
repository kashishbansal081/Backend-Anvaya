require("dotenv").config();
const mongoose = require("mongoose");

const MonogDB = process.env.DB_URL;

async function dbConnect() {
  try {
    await mongoose
      .connect(MonogDB)
      .then(() => {
        console.log("db connected");
      })
      .catch((error) => {
        console.log(error);
      });
  } catch {
    console.log("Couldn't connect with db.");
  }
}

module.exports = dbConnect
