const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const Criminal = require("../models/Criminal");

const router = express.Router();

// =====================================================
// UPLOAD FOLDER
// =====================================================

const uploadPath = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// =====================================================
// MULTER STORAGE
// =====================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";

    const filename =
      "face-search-" +
      Date.now() +
      "-" +
      Math.round(Math.random() * 1000000) +
      ext;

    cb(null, filename);
  },
});

// =====================================================
// MULTER
// =====================================================

const upload = multer({
  storage: storage,

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    console.log("📄 Uploaded file:");
    console.log("   Original name:", file.originalname);
    console.log("   MIME type:", file.mimetype);

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(
        new Error(
          "Only JPG, JPEG, PNG and WEBP images are allowed"
        )
      );
    }

    cb(null, true);
  },
});

// =====================================================
// POST /api/face-search
// =====================================================

router.post("/", upload.single("photo"), async (req, res) => {
  let uploadedFile = null;

  try {
    console.log("\n====================================");
    console.log("🔍 FACE SEARCH REQUEST");
    console.log("====================================");

    // =================================================
    // CHECK UPLOAD
    // =================================================

    if (!req.file) {
      return res.status(400).json({
        success: false,
        match: false,
        criminal: null,
        message: "Please upload a face photo",
      });
    }

    uploadedFile = path.resolve(req.file.path);

    console.log("📷 Query photo:");
    console.log(uploadedFile);

    console.log("📄 Original file:");
    console.log(req.file.originalname);

    console.log("📦 MIME:");
    console.log(req.file.mimetype);

    console.log("📏 File size:");
    console.log(req.file.size, "bytes");

    // =================================================
    // CHECK FILE EXISTS
    // =================================================

    if (!fs.existsSync(uploadedFile)) {
      console.error(
        "❌ Uploaded file does not exist:",
        uploadedFile
      );

      return res.status(400).json({
        success: false,
        match: false,
        criminal: null,
        message: "Uploaded image was not saved correctly",
      });
    }

    // =================================================
    // CHECK FILE SIZE
    // =================================================

    const fileStats = fs.statSync(uploadedFile);

    console.log(
      "📦 Actual saved size:",
      fileStats.size,
      "bytes"
    );

    if (fileStats.size === 0) {
      console.error("❌ Uploaded file is empty");

      return res.status(400).json({
        success: false,
        match: false,
        criminal: null,
        message: "Uploaded image is empty",
      });
    }

    // =================================================
    // GET CRIMINALS
    // =================================================

    const criminals = await Criminal.find()
      .select(
        "criminalId name age gender crime address description image photo"
      )
      .lean();

    console.log(
      "👤 Criminal records found:",
      criminals.length
    );

    // =================================================
    // BUILD CANDIDATES
    // =================================================

    const candidates = [];

    for (const criminal of criminals) {
      let storedImage = "";

      if (criminal.image) {
        storedImage = criminal.image;
      } else if (criminal.photo) {
        storedImage = criminal.photo;
      }

      if (!storedImage) {
        console.log(
          "⚠️ No image for:",
          criminal.name
        );

        continue;
      }

      const imageName = path.basename(storedImage);

      const imagePath = path.resolve(
        uploadPath,
        imageName
      );

      if (!fs.existsSync(imagePath)) {
        console.log(
          "⚠️ Photo not found:",
          imagePath
        );

        continue;
      }

      const stats = fs.statSync(imagePath);

      if (stats.size === 0) {
        console.log(
          "⚠️ Empty candidate photo:",
          imagePath
        );

        continue;
      }

      candidates.push({
        criminalId:
          criminal.criminalId || "",

        name:
          criminal.name || "",

        age:
          criminal.age || "",

        gender:
          criminal.gender || "",

        crime:
          criminal.crime || "",

        address:
          criminal.address || "",

        description:
          criminal.description || "",

        image:
          criminal.image ||
          criminal.photo ||
          "",

        imagePath:
          imagePath,
      });
    }

    console.log(
      "📸 Candidate photos:",
      candidates.length
    );

    // =================================================
    // NO CANDIDATES
    // =================================================

    if (candidates.length === 0) {
      return res.status(200).json({
        success: true,
        match: false,
        criminal: null,
        score: 0,
        message:
          "No criminal photos available for comparison",
      });
    }

    // =================================================
    // PYTHON FILE
    // =================================================

    const pythonFile = path.resolve(
      __dirname,
      "..",
      "face_search.py"
    );

    if (!fs.existsSync(pythonFile)) {
      return res.status(500).json({
        success: false,
        match: false,
        criminal: null,
        message: "face_search.py not found",
      });
    }

    console.log(
      "🐍 Python file:",
      pythonFile
    );

    // =================================================
    // PYTHON INPUT
    // =================================================

    const pythonInput = JSON.stringify({
      queryPath: uploadedFile,
      candidates: candidates,
    });

    // =================================================
    // START PYTHON
    // =================================================

    const pythonProcess = spawn(
      "python",
      [pythonFile],
      {
        windowsHide: true,
      }
    );

    let stdout = "";
    let stderr = "";

    // =================================================
    // STDOUT
    // =================================================

    pythonProcess.stdout.on(
      "data",
      (data) => {
        const output = data.toString();

        stdout += output;

        console.log(
          "🐍 Python:",
          output
        );
      }
    );

    // =================================================
    // STDERR
    // =================================================

    pythonProcess.stderr.on(
      "data",
      (data) => {
        const output = data.toString();

        stderr += output;

        console.error(
          "🐍 Python ERROR:",
          output
        );
      }
    );

    // =================================================
    // SEND DATA
    // =================================================

    pythonProcess.stdin.write(
      pythonInput
    );

    pythonProcess.stdin.end();

    // =================================================
    // PYTHON CLOSE
    // =================================================

    pythonProcess.on(
      "close",
      (code) => {
        console.log(
          "🐍 Python exited:",
          code
        );

        console.log(
          "🐍 Final Python output:",
          stdout
        );

        // =================================================
        // PYTHON FAILED
        // =================================================

        if (code !== 0) {
          return res.status(500).json({
            success: false,
            match: false,
            criminal: null,

            message:
              "Face recognition process failed",

            pythonError:
              stderr,
          });
        }

        // =================================================
        // EMPTY OUTPUT
        // =================================================

        if (!stdout.trim()) {
          return res.status(500).json({
            success: false,
            match: false,
            criminal: null,

            message:
              "Face recognition returned empty response",
          });
        }

        // =================================================
        // PARSE JSON
        // =================================================

        try {
          const lines = stdout
            .trim()
            .split(/\r?\n/)
            .filter(Boolean);

          const lastLine =
            lines[lines.length - 1];

          console.log(
            "📦 JSON line:",
            lastLine
          );

          const result =
            JSON.parse(lastLine);

          console.log(
            "📦 Python result:",
            result
          );

          // =================================================
          // MATCH FOUND
          // =================================================

          if (
            result.success === true &&
            result.match === true &&
            result.criminal
          ) {
            const matched =
              result.criminal;

            console.log(
              "===================================="
            );

            console.log(
              "✅ FACE MATCH FOUND"
            );

            console.log(
              "🆔 Criminal ID:",
              matched.criminalId
            );

            console.log(
              "👤 Name:",
              matched.name
            );

            console.log(
              "🎯 Score:",
              result.score
            );

            console.log(
              "===================================="
            );

            return res.status(200).json({
              success: true,
              match: true,

              score:
                Number(result.score) || 0,

              criminal: {
                criminalId:
                  matched.criminalId || "",

                name:
                  matched.name || "",

                age:
                  matched.age || "",

                gender:
                  matched.gender || "",

                crime:
                  matched.crime || "",

                address:
                  matched.address || "",

                description:
                  matched.description || "",

                image:
                  matched.image ||
                  matched.photo ||
                  "",
              },

              message:
                "Face match found",
            });
          }

          // =================================================
          // NO MATCH
          // =================================================

          return res.status(200).json({
            success: true,
            match: false,

            score:
              Number(result.score) || 0,

            criminal: null,

            message:
              result.message ||
              "No matching face found",
          });

        } catch (parseError) {
          console.error(
            "❌ JSON Parse Error:",
            parseError
          );

          return res.status(500).json({
            success: false,
            match: false,
            criminal: null,

            message:
              "Face recognition returned invalid JSON",

            pythonOutput:
              stdout,

            pythonError:
              stderr,
          });
        }
      }
    );

    // =================================================
    // PYTHON PROCESS ERROR
    // =================================================

    pythonProcess.on(
      "error",
      (error) => {
        console.error(
          "❌ Python process error:",
          error
        );

        return res.status(500).json({
          success: false,
          match: false,
          criminal: null,

          message:
            "Unable to start face recognition",

          error:
            error.message,
        });
      }
    );

  } catch (error) {
    console.error(
      "❌ Face Search Error:",
      error
    );

    return res.status(500).json({
      success: false,
      match: false,
      criminal: null,

      message:
        "Face search failed",

      error:
        error.message,
    });
  }
});

// =====================================================
// MULTER ERROR HANDLER
// =====================================================

router.use((error, req, res, next) => {
  console.error(
    "❌ FACE UPLOAD ERROR:",
    error
  );

  return res.status(400).json({
    success: false,
    match: false,
    criminal: null,

    message:
      error.message ||
      "Image upload failed",
  });
});

module.exports = router;