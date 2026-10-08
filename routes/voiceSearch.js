const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const Criminal = require("../models/Criminal");

const router = express.Router();

// =====================================================
// UPLOAD DIRECTORY
// =====================================================

const uploadPath = path.join(
  __dirname,
  "..",
  "uploads"
);

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, {
    recursive: true,
  });
}

// =====================================================
// MULTER
// =====================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);

    const filename =
      "voice-search-" +
      Date.now() +
      "-" +
      Math.round(Math.random() * 1000000) +
      ext;

    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

// =====================================================
// POST /api/voices/search
// =====================================================

router.post(
  "/search",
  upload.single("audio"),
  async (req, res) => {
    try {
      console.log("");
      console.log("====================================");
      console.log("🎙️ VOICE SEARCH REQUEST");
      console.log("====================================");

      // -------------------------------------------------
      // CHECK QUERY AUDIO
      // -------------------------------------------------

      if (!req.file) {
        return res.status(400).json({
          success: false,
          match: false,
          criminal: null,
          score: 0,
          message: "Please upload an audio file",
        });
      }

      const queryAudioPath = path.resolve(
        req.file.path
      );

      console.log(
        "🎵 Query audio:",
        queryAudioPath
      );

      // -------------------------------------------------
      // GET CRIMINALS
      // -------------------------------------------------

      const criminals =
        await Criminal.find()
          .select(
            "criminalId name age gender crime address description image photo voice audio voiceAudio firNumber"
          )
          .lean();

      console.log(
        "👤 Criminal records:",
        criminals.length
      );

      // -------------------------------------------------
      // BUILD CANDIDATES
      // -------------------------------------------------

      const candidates = [];

      for (const criminal of criminals) {
        let storedAudio = "";

        if (criminal.voiceAudio) {
          storedAudio = criminal.voiceAudio;
        } else if (criminal.voice) {
          storedAudio = criminal.voice;
        } else if (criminal.audio) {
          storedAudio = criminal.audio;
        }

        if (!storedAudio) {
          continue;
        }

        const audioName = path.basename(
          String(storedAudio).trim()
        );

        const candidateAudioPath =
          path.resolve(
            uploadPath,
            audioName
          );

        console.log(
          "🎙️ Candidate:",
          criminal.name,
          "=>",
          candidateAudioPath
        );

        if (
          !fs.existsSync(candidateAudioPath)
        ) {
          console.log(
            "⚠️ Audio not found:",
            candidateAudioPath
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

          firNumber:
            criminal.firNumber || "",

          address:
            criminal.address || "",

          description:
            criminal.description || "",

          image:
            criminal.image ||
            criminal.photo ||
            "",

          voice:
            storedAudio,

          audioPath:
            candidateAudioPath,
        });
      }

      console.log(
        "🎙️ Candidate audio files:",
        candidates.length
      );

      // -------------------------------------------------
      // NO CANDIDATES
      // -------------------------------------------------

      if (candidates.length === 0) {
        return res.status(200).json({
          success: true,
          match: false,
          criminal: null,
          score: 0,
          message:
            "No criminal voice recordings available",
        });
      }

      // -------------------------------------------------
      // PYTHON FILE
      // -------------------------------------------------

      const pythonFile = path.join(
        __dirname,
        "..",
        "voice_search.py"
      );

      if (!fs.existsSync(pythonFile)) {
        return res.status(500).json({
          success: false,
          match: false,
          criminal: null,
          score: 0,
          message:
            "voice_search.py not found",
        });
      }

      // -------------------------------------------------
      // COMPARE
      // -------------------------------------------------

      let bestMatch = null;
      let bestScore = -Infinity;

      for (const candidate of candidates) {
        console.log("");
        console.log(
          "------------------------------------"
        );

        console.log(
          "🎙️ Comparing:",
          candidate.name
        );

        console.log(
          "Query:",
          queryAudioPath
        );

        console.log(
          "Candidate:",
          candidate.audioPath
        );

        const result =
          await runPythonVoiceSearch(
            pythonFile,
            queryAudioPath,
            candidate.audioPath
          );

        console.log(
          "🐍 Result:",
          result
        );

        if (
          !result ||
          result.success !== true
        ) {
          console.log(
            "⚠️ Comparison failed:",
            candidate.name
          );

          continue;
        }

        const score =
          Number(result.score) || 0;

        if (score > bestScore) {
          bestScore = score;

          bestMatch = {
            candidate,
            score,
            match:
              result.match === true,
          };
        }
      }

      // -------------------------------------------------
      // NOTHING COMPARED
      // -------------------------------------------------

      if (!bestMatch) {
        return res.status(200).json({
          success: true,
          match: false,
          criminal: null,
          score: 0,
          message:
            "Voice files could not be compared",
        });
      }

      console.log("");
      console.log("====================================");
      console.log(
        "🏆 BEST PERSON:",
        bestMatch.candidate.name
      );
      console.log(
        "🏆 BEST SCORE:",
        bestMatch.score
      );
      console.log(
        "🏆 MATCH:",
        bestMatch.match
      );
      console.log("====================================");

      // -------------------------------------------------
      // MATCH FOUND
      // -------------------------------------------------

      if (bestMatch.match === true) {
        const matched =
          bestMatch.candidate;

        return res.status(200).json({
          success: true,
          match: true,
          score: bestMatch.score,

          criminal: {
            criminalId:
              matched.criminalId,

            name:
              matched.name,

            age:
              matched.age,

            gender:
              matched.gender,

            crime:
              matched.crime,

            firNumber:
              matched.firNumber,

            address:
              matched.address,

            description:
              matched.description,

            image:
              matched.image,

            voice:
              matched.voice,

            audio:
              matched.voice,

            voiceAudio:
              matched.voice,
          },

          message:
            "Voice match found",
        });
      }

      // -------------------------------------------------
      // NO MATCH
      // -------------------------------------------------

      return res.status(200).json({
        success: true,
        match: false,
        score: bestMatch.score,
        criminal: null,
        message:
          "No matching voice found",
      });

    } catch (error) {
      console.error(
        "❌ Voice Search Error:",
        error
      );

      return res.status(500).json({
        success: false,
        match: false,
        criminal: null,
        score: 0,
        message:
          "Voice search failed",
        error:
          error.message,
      });
    }
  }
);

// =====================================================
// RUN PYTHON
// =====================================================

function runPythonVoiceSearch(
  pythonFile,
  queryAudioPath,
  candidateAudioPath
) {
  return new Promise((resolve) => {

    console.log(
      "🐍 Starting Python..."
    );

    // IMPORTANT:
    // Send paths as command-line arguments
    // NOT through stdin.

    const pythonProcess = spawn(
      "python",
      [
        pythonFile,
        queryAudioPath,
        candidateAudioPath,
      ],
      {
        windowsHide: true,
      }
    );

    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on(
      "data",
      (data) => {
        const output =
          data.toString();

        stdout += output;

        console.log(
          "🐍 Python:",
          output
        );
      }
    );

    pythonProcess.stderr.on(
      "data",
      (data) => {
        const output =
          data.toString();

        stderr += output;

        console.error(
          "🐍 Python ERROR:",
          output
        );
      }
    );

    pythonProcess.on(
      "close",
      (code) => {

        console.log(
          "🐍 Python exited:",
          code
        );

        if (code !== 0) {
          resolve({
            success: false,
            message:
              "Python voice recognition failed",
            error:
              stderr,
          });

          return;
        }

        if (!stdout.trim()) {
          resolve({
            success: false,
            message:
              "Python returned empty response",
          });

          return;
        }

        try {
          const lines =
            stdout
              .trim()
              .split(/\r?\n/)
              .filter(Boolean);

          const lastLine =
            lines[lines.length - 1];

          const result =
            JSON.parse(lastLine);

          resolve(result);

        } catch (error) {

          console.error(
            "❌ JSON Parse Error:",
            error
          );

          resolve({
            success: false,
            message:
              "Invalid Python JSON response",
            pythonOutput:
              stdout,
            pythonError:
              stderr,
          });
        }
      }
    );

    pythonProcess.on(
      "error",
      (error) => {

        console.error(
          "❌ Python spawn error:",
          error
        );

        resolve({
          success: false,
          message:
            "Unable to start Python",
          error:
            error.message,
        });
      }
    );
  });
}

module.exports = router;