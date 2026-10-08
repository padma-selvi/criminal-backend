const express = require("express");
const router = express.Router();

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const Criminal = require("../models/Criminal");
const VoiceRecord = require("../models/VoiceRecord");

// =====================================================
// 📁 UPLOAD DIRECTORY
// =====================================================

const uploadDir = path.join(__dirname, "../uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// =====================================================
// 🎙️ MULTER STORAGE
// =====================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const ext =
      path.extname(file.originalname).toLowerCase() || ".wav";

    const filename =
      `voice-${Date.now()}-${Math.round(Math.random() * 1000000)}${ext}`;

    cb(null, filename);
  },
});

const upload = multer({
  storage: storage,

  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

// =====================================================
// 🧹 CLEAN AUDIO PATH
// =====================================================

function getAudioPath(audioValue) {
  if (!audioValue) {
    return null;
  }

  let value = String(audioValue).trim();

  // Remove full URL
  value = value.replace(/^https?:\/\/[^/]+\/?/i, "");

  // Convert Windows slash to normal slash
  value = value.replace(/\\/g, "/");

  // Remove starting slash
  value = value.replace(/^\/+/, "");

  // Remove uploads/
  value = value.replace(/^uploads\//i, "");

  // Remove possible /uploads
  value = value.replace(/^uploads\//i, "");

  const finalPath = path.resolve(uploadDir, value);

  return finalPath;
}

// =====================================================
// 🐍 PYTHON VOICE COMPARISON
// =====================================================

function compareVoicesWithPython(audio1, audio2) {
  return new Promise((resolve) => {
    const pythonScript = path.join(
      __dirname,
      "../voice_search.py"
    );

    console.log("");
    console.log("====================================");
    console.log("🐍 STARTING PYTHON VOICE SEARCH");
    console.log("====================================");

    console.log("Python script:", pythonScript);
    console.log("Query audio:", audio1);
    console.log("Candidate audio:", audio2);

    // -------------------------------------------------
    // CHECK PYTHON SCRIPT
    // -------------------------------------------------

    if (!fs.existsSync(pythonScript)) {
      console.error(
        "❌ voice_search.py not found:",
        pythonScript
      );

      return resolve({
        success: false,
        match: false,
        score: 0,
        message: "voice_search.py not found",
      });
    }

    // -------------------------------------------------
    // CHECK QUERY AUDIO
    // -------------------------------------------------

    if (!fs.existsSync(audio1)) {
      console.error(
        "❌ Query audio not found:",
        audio1
      );

      return resolve({
        success: false,
        match: false,
        score: 0,
        message: "Query audio file not found",
      });
    }

    // -------------------------------------------------
    // CHECK CANDIDATE AUDIO
    // -------------------------------------------------

    if (!fs.existsSync(audio2)) {
      console.error(
        "❌ Candidate audio not found:",
        audio2
      );

      return resolve({
        success: false,
        match: false,
        score: 0,
        message: "Candidate audio file not found",
      });
    }

    // -------------------------------------------------
    // START PYTHON
    // -------------------------------------------------

    const pythonProcess = spawn(
      "python",
      [
        pythonScript,
        audio1,
        audio2,
      ],
      {
        windowsHide: true,
      }
    );

    let stdoutData = "";
    let stderrData = "";

    // -------------------------------------------------
    // PYTHON STDOUT
    // -------------------------------------------------

    pythonProcess.stdout.on("data", (data) => {
      const text = data.toString();

      stdoutData += text;

      console.log(
        "🐍 Python STDOUT:",
        text.trim()
      );
    });

    // -------------------------------------------------
    // PYTHON STDERR
    // -------------------------------------------------

    pythonProcess.stderr.on("data", (data) => {
      const text = data.toString();

      stderrData += text;

      console.log(
        "🐍 Python LOG:",
        text.trim()
      );
    });

    // -------------------------------------------------
    // PYTHON ERROR
    // -------------------------------------------------

    pythonProcess.on("error", (error) => {
      console.error(
        "❌ Python process error:",
        error
      );

      resolve({
        success: false,
        match: false,
        score: 0,
        message:
          "Unable to start Python voice recognition",
      });
    });

    // -------------------------------------------------
    // PYTHON CLOSE
    // -------------------------------------------------

    pythonProcess.on("close", (code) => {
      console.log(
        "🐍 Python process exited with code:",
        code
      );

      console.log(
        "🐍 Raw Python output:",
        stdoutData
      );

      try {
        const lines = stdoutData
          .trim()
          .split(/\r?\n/)
          .filter(Boolean);

        let jsonResult = null;

        // Search JSON from last line
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const parsed = JSON.parse(lines[i]);

            if (
              parsed &&
              typeof parsed === "object"
            ) {
              jsonResult = parsed;
              break;
            }
          } catch (error) {
            // Ignore non JSON lines
          }
        }

        if (!jsonResult) {
          console.error(
            "❌ No valid JSON returned by Python"
          );

          console.error(
            "Python STDOUT:",
            stdoutData
          );

          console.error(
            "Python STDERR:",
            stderrData
          );

          return resolve({
            success: false,
            match: false,
            score: 0,
            message:
              "Python returned invalid response",
          });
        }

        const score = Number(
          jsonResult.score || 0
        );

        const match =
          Boolean(jsonResult.match);

        const success =
          Boolean(jsonResult.success);

        console.log(
          "===================================="
        );

        console.log(
          "🎙️ PYTHON RESULT"
        );

        console.log(
          "Success:",
          success
        );

        console.log(
          "Match:",
          match
        );

        console.log(
          "Score:",
          score
        );

        console.log(
          "===================================="
        );

        resolve({
          success,
          match,
          score,
          message:
            jsonResult.message || "",
        });

      } catch (error) {
        console.error(
          "❌ Python JSON parse error:",
          error
        );

        resolve({
          success: false,
          match: false,
          score: 0,
          message:
            "Failed to parse Python result",
        });
      }
    });
  });
}

// =====================================================
// 🎙️ VOICE SEARCH
// POST /api/voices/search
// =====================================================

router.post(
  "/search",
  upload.single("audio"),

  async (req, res) => {
    let queryAudioPath = null;

    try {
      console.log("");
      console.log("====================================");
      console.log("🎙️ VOICE SEARCH REQUEST");
      console.log("====================================");

      // =================================================
      // CHECK UPLOAD
      // =================================================

      if (!req.file) {
        console.log(
          "❌ No audio file received"
        );

        return res.status(400).json({
          success: false,
          match: false,
          score: 0,
          message:
            "No audio file uploaded.",
        });
      }

      // =================================================
      // QUERY AUDIO
      // =================================================

      queryAudioPath = req.file.path;

      console.log(
        "🎧 Uploaded audio:",
        req.file.originalname
      );

      console.log(
        "📁 Saved audio:",
        queryAudioPath
      );

      console.log(
        "📦 File size:",
        req.file.size
      );

      // =================================================
      // CHECK QUERY FILE
      // =================================================

      if (!fs.existsSync(queryAudioPath)) {
        return res.status(500).json({
          success: false,
          match: false,
          score: 0,
          message:
            "Uploaded audio file could not be found.",
        });
      }

      // =================================================
      // 🔥 GET VOICE RECORDS
      // =================================================

      const voiceRecords =
        await VoiceRecord.find({
          audio: {
            $exists: true,
            $nin: ["", null],
          },
        }).sort({
          createdAt: -1,
        });

      console.log(
        "🎙️ VoiceRecord count:",
        voiceRecords.length
      );

      // =================================================
      // NO VOICE RECORDS
      // =================================================

      if (
        !voiceRecords ||
        voiceRecords.length === 0
      ) {
        console.log(
          "❌ No VoiceRecord entries found"
        );

        return res.json({
          success: true,
          match: false,
          score: 0,
          criminal: null,
          voiceRecord: null,
          message:
            "No registered voice files found in VoiceRecord collection.",
        });
      }

      // =================================================
      // MATCH THRESHOLD
      // =================================================

      const MATCH_THRESHOLD = 0.10;

      let bestMatch = null;
      let bestVoiceRecord = null;
      let highestScore = 0;

      // =================================================
      // LOOP VOICE RECORDS
      // =================================================

      for (const record of voiceRecords) {
        try {
          console.log("");
          console.log(
            "------------------------------------"
          );

          console.log(
            "🎙️ Checking VoiceRecord"
          );

          console.log(
            "Voice ID:",
            record.voiceId
          );

          console.log(
            "Criminal ID:",
            record.criminalId
          );

          console.log(
            "Name:",
            record.name
          );

          console.log(
            "Case ID:",
            record.caseId
          );

          console.log(
            "Audio:",
            record.audio
          );

          // =================================================
          // GET AUDIO PATH
          // =================================================

          const candidateAudioPath =
            getAudioPath(record.audio);

          console.log(
            "📁 Candidate path:",
            candidateAudioPath
          );

          // =================================================
          // CHECK AUDIO PATH
          // =================================================

          if (
            !candidateAudioPath ||
            !fs.existsSync(candidateAudioPath)
          ) {
            console.log(
              "⚠️ Voice file does not exist."
            );

            continue;
          }

          // =================================================
          // CHECK DIRECTORY
          // =================================================

          const stat =
            fs.statSync(
              candidateAudioPath
            );

          if (stat.isDirectory()) {
            console.log(
              "⚠️ Candidate is directory."
            );

            continue;
          }

          // =================================================
          // PYTHON COMPARISON
          // =================================================

          const pyResult =
            await compareVoicesWithPython(
              queryAudioPath,
              candidateAudioPath
            );

          console.log(
            "🎯 Python result:",
            pyResult
          );

          const score =
            Number(
              pyResult?.score || 0
            );

          console.log(
            "📊 Score:",
            score
          );

          // =================================================
          // HIGHEST SCORE
          // =================================================

          if (
            score > highestScore
          ) {
            highestScore = score;

            bestVoiceRecord =
              record;
          }

          // =================================================
          // MATCH
          // =================================================

          if (
            pyResult?.match === true ||
            score >= MATCH_THRESHOLD
          ) {
            console.log(
              "✅ VOICE MATCH FOUND"
            );

            bestVoiceRecord =
              record;
          }

        } catch (candidateError) {
          console.error(
            `❌ Error checking VoiceRecord ${record.voiceId}:`,
            candidateError
          );

          continue;
        }
      }

      // =================================================
      // FIND CRIMINAL DETAILS
      // =================================================

      if (bestVoiceRecord) {
        console.log("");
        console.log(
          "===================================="
        );

        console.log(
          "🎯 BEST VOICE RECORD"
        );

        console.log(
          "Voice ID:",
          bestVoiceRecord.voiceId
        );

        console.log(
          "Criminal ID:",
          bestVoiceRecord.criminalId
        );

        console.log(
          "Name:",
          bestVoiceRecord.name
        );

        console.log(
          "Score:",
          highestScore
        );

        console.log(
          "===================================="
        );
      }

      // =================================================
      // GET CRIMINAL
      // =================================================

      let criminal = null;

      if (
        bestVoiceRecord &&
        bestVoiceRecord.criminalId
      ) {
        criminal =
          await Criminal.findOne({
            criminalId:
              bestVoiceRecord.criminalId,
          });
      }

      // =================================================
      // ALSO SEARCH BY NAME
      // =================================================

      if (
        !criminal &&
        bestVoiceRecord &&
        bestVoiceRecord.name
      ) {
        criminal =
          await Criminal.findOne({
            name:
              bestVoiceRecord.name,
          });
      }

      // =================================================
      // FINAL RESULT
      // =================================================

      console.log("");
      console.log(
        "===================================="
      );

      console.log(
        "🎙️ FINAL VOICE SEARCH RESULT"
      );

      console.log(
        "===================================="
      );

      console.log(
        "Highest score:",
        highestScore
      );

      console.log(
        "Voice Record:",
        bestVoiceRecord
          ? bestVoiceRecord.voiceId
          : "None"
      );

      console.log(
        "Criminal:",
        criminal
          ? criminal.name
          : "None"
      );

      // =================================================
      // MATCH SUCCESS
      // =================================================

      if (
        bestVoiceRecord &&
        highestScore >= MATCH_THRESHOLD
      ) {
        console.log(
          "✅ MATCH SUCCESS"
        );

        return res.json({
          success: true,
          match: true,

          score: highestScore,

          criminal:
            criminal || {
              criminalId:
                bestVoiceRecord.criminalId,

              name:
                bestVoiceRecord.name,
            },

          voiceRecord:
            bestVoiceRecord,

          message:
            "Voice successfully matched with a registered voice record.",
        });
      }

      // =================================================
      // NO MATCH
      // =================================================

      console.log(
        "❌ NO MATCH FOUND"
      );

      return res.json({
        success: true,
        match: false,
        score: highestScore,
        criminal: null,
        voiceRecord: null,

        message:
          "No matching voice found in registered voice records.",
      });

    } catch (error) {
      console.error("");
      console.error(
        "===================================="
      );

      console.error(
        "❌ VOICE SEARCH ERROR"
      );

      console.error(
        "===================================="
      );

      console.error(error);

      return res.status(500).json({
        success: false,
        match: false,
        score: 0,
        criminal: null,
        voiceRecord: null,

        message:
          "Internal server error during voice search.",

        error:
          error.message,
      });

    } finally {

      // =================================================
      // DELETE ONLY SEARCH AUDIO
      // =================================================

      if (
        queryAudioPath &&
        fs.existsSync(queryAudioPath)
      ) {
        try {
          fs.unlinkSync(
            queryAudioPath
          );

          console.log(
            "🗑️ Temporary query audio deleted."
          );

        } catch (deleteError) {
          console.error(
            "⚠️ Could not delete query audio:",
            deleteError.message
          );
        }
      }
    }
  }
);

// =====================================================
// EXPORT
// =====================================================

module.exports = router;