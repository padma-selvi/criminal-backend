const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");

require("dotenv").config();

// =====================================================
// ROUTES
// =====================================================

const criminalRoutes =
  require("./routes/criminalRoutes");

const caseRoutes =
  require("./routes/caseRoutes");

const notificationRoutes =
  require("./routes/notificationRoutes");

const voiceRoutes =
  require("./routes/voiceRoutes");

const faceSearchRoutes =
  require("./routes/faceSearchRoutes");

// =====================================================
// MODEL
// =====================================================

const Criminal =
  require("./models/Criminal");

// =====================================================
// APP
// =====================================================

const app = express();

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

// =====================================================
// 📁 UPLOADS
// =====================================================

const uploadPath =
  path.join(__dirname, "uploads");

app.use(
  "/uploads",
  express.static(uploadPath)
);

// =====================================================
// ROUTES
// =====================================================

// =====================================================
// 👤 CRIMINALS
// =====================================================

app.use(
  "/api/criminals",
  criminalRoutes
);

// =====================================================
// 📁 CASES
// =====================================================

app.use(
  "/api/cases",
  caseRoutes
);

// =====================================================
// 🔔 NOTIFICATIONS
// =====================================================

app.use(
  "/api/notifications",
  notificationRoutes
);

// =====================================================
// 🎙️ VOICE
// =====================================================

// Direct test route
// This confirms that THIS server.js is running.

app.get(
  "/api/voices/test-direct",
  (req, res) => {

    console.log(
      "🔥 DIRECT VOICE TEST HIT"
    );

    res.json({
      success: true,

      message:
        "Voice route path is working from server.js",

      path:
        req.originalUrl
    });
  }
);

// Actual voice routes

console.log(
  "🎙️ Loading voiceRoutes..."
);

console.log(
  "🎙️ Voice routes type:",
  typeof voiceRoutes
);

app.use(
  "/api/voices",
  voiceRoutes
);

// =====================================================
// 🔍 FACE SEARCH
// =====================================================

app.use(
  "/api/face-search",
  faceSearchRoutes
);

// =====================================================
// 🏠 HOME
// =====================================================

app.get(
  "/",
  (req, res) => {

    res.json({

      success: true,

      message:
        "Criminal Identification System Backend is Running!"

    });
  }
);

// =====================================================
// 🧪 API TEST
// =====================================================

app.get(
  "/api/test",
  (req, res) => {

    res.json({

      success: true,

      message:
        "API is working correctly"

    });
  }
);

// =====================================================
// 🆔 AUTO ASSIGN CRIMINAL IDS
// =====================================================

async function assignMissingCriminalIds() {

  try {

    console.log(
      "🆔 Checking Criminal IDs..."
    );

    const criminals =
      await Criminal.find()
        .sort({
          createdAt: 1
        });

    let maxNumber = 0;

    // -----------------------------------------------
    // Find highest existing CR number
    // -----------------------------------------------

    criminals.forEach(
      (criminal) => {

        if (!criminal.criminalId) {
          return;
        }

        const match =
          String(
            criminal.criminalId
          ).match(
            /^CR-(\d+)$/
          );

        if (match) {

          const number =
            parseInt(
              match[1],
              10
            );

          if (
            number > maxNumber
          ) {

            maxNumber =
              number;
          }
        }
      }
    );

    // -----------------------------------------------
    // Assign missing IDs
    // -----------------------------------------------

    for (
      const criminal of criminals
    ) {

      if (
        !criminal.criminalId
      ) {

        maxNumber++;

        const newId =
          `CR-${String(
            maxNumber
          ).padStart(3, "0")}`;

        await Criminal.updateOne(

          {
            _id:
              criminal._id
          },

          {
            $set: {
              criminalId:
                newId
            }
          }

        );

        console.log(
          `✅ ${criminal.name} → ${newId}`
        );
      }
    }

    console.log(
      "✅ Criminal ID check completed"
    );

  } catch (error) {

    console.error(
      "❌ Criminal ID Assignment Error:",
      error.message
    );
  }
}

// =====================================================
// 🗄️ MONGODB
// =====================================================

mongoose
  .connect(
    process.env.MONGO_URI
  )

  .then(
    async () => {

      console.log(
        "✅ MongoDB Connected Successfully!"
      );

      console.log(
        "DATABASE:",
        mongoose.connection.name
      );

      // ---------------------------------------------
      // Show collections
      // ---------------------------------------------

      try {

        const collections =
          await mongoose
            .connection
            .db
            .listCollections()
            .toArray();

        collections.forEach(
          (collection) => {

            console.log(
              "COLLECTION:",
              collection.name
            );
          }
        );

      } catch (error) {

        console.error(
          "⚠️ Could not list collections:",
          error.message
        );
      }

      // ---------------------------------------------
      // Criminal ID check
      // ---------------------------------------------

      await assignMissingCriminalIds();

    }
  )

  .catch(
    (error) => {

      console.error(
        "❌ MongoDB Connection Error:",
        error.message
      );

    }
  );

// =====================================================
// ❌ ERROR HANDLER
// =====================================================

app.use(
  (
    err,
    req,
    res,
    next
  ) => {

    console.error(
      "❌ SERVER ERROR:",
      err
    );

    if (
      res.headersSent
    ) {

      return next(err);
    }

    res.status(500).json({

      success: false,

      message:
        "Internal server error",

      error:
        err.message

    });
  }
);

// =====================================================
// ❌ 404 HANDLER
// =====================================================

app.use(
  (
    req,
    res
  ) => {

    console.log(
      "❌ 404 ROUTE:",
      req.method,
      req.originalUrl
    );

    res.status(404).json({

      success: false,

      message:
        "API route not found",

      path:
        req.originalUrl

    });
  }
);

// =====================================================
// 🚀 SERVER
// =====================================================

const PORT =
  process.env.PORT || 5000;

app.listen(
  PORT,
  () => {

    console.log("");
    console.log(
      "=============================================="
    );

    console.log(
      `🚀 Server running on http://localhost:${PORT}`
    );

    console.log(
      `🎙️ Voice API: http://localhost:${PORT}/api/voices`
    );

    console.log(
      `🧪 Voice Direct Test: http://localhost:${PORT}/api/voices/test-direct`
    );

    console.log(
      `🔍 Face API: http://localhost:${PORT}/api/face-search`
    );

    console.log(
      "=============================================="
    );
    console.log("");
  }
);