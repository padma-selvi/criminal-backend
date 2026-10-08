// =====================================================
// 🎙️ VOICE ROUTES
// =====================================================

const express = require("express");
const router = express.Router();

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const mongoose = require("mongoose");

// =====================================================
// 📦 MODELS
// =====================================================

const Criminal = require("../models/Criminal");

// =====================================================
// 📁 DIRECTORIES
// =====================================================

const BACKEND_DIR = path.join(__dirname, "..");

const UPLOAD_DIR = path.join(
  BACKEND_DIR,
  "uploads"
);

const CASE_UPLOAD_DIR = path.join(
  UPLOAD_DIR,
  "cases"
);

const VOICE_WAV_DIR = path.join(
  UPLOAD_DIR,
  "voice_wav"
);

const PYTHON_SCRIPT = path.join(
  BACKEND_DIR,
  "voice_search.py"
);

// =====================================================
// 📁 CREATE DIRECTORIES
// =====================================================

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, {
    recursive: true
  });
}

if (!fs.existsSync(CASE_UPLOAD_DIR)) {
  fs.mkdirSync(CASE_UPLOAD_DIR, {
    recursive: true
  });
}

if (!fs.existsSync(VOICE_WAV_DIR)) {
  fs.mkdirSync(VOICE_WAV_DIR, {
    recursive: true
  });
}

// =====================================================
// 🎤 MULTER STORAGE
// =====================================================

const storage = multer.diskStorage({

  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },

  filename: function (req, file, cb) {

    const ext = path
      .extname(file.originalname)
      .toLowerCase();

    const baseName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_");

    const filename =
      baseName +
      "-" +
      Date.now() +
      ext;

    cb(null, filename);
  }

});

// =====================================================
// 🎧 FILE FILTER
// =====================================================

const fileFilter = function (
  req,
  file,
  cb
) {

  const allowedExtensions = [
    ".wav",
    ".mp3",
    ".m4a",
    ".webm",
    ".ogg",
    ".flac"
  ];

  const ext = path
    .extname(file.originalname)
    .toLowerCase();

  if (
    allowedExtensions.includes(ext)
  ) {

    cb(null, true);

  } else {

    cb(
      new Error(
        "Only audio files are allowed"
      ),
      false
    );

  }
};

// =====================================================
// 🎙️ MULTER
// =====================================================

const upload = multer({

  storage: storage,

  fileFilter: fileFilter,

  limits: {
    fileSize: 25 * 1024 * 1024
  }

});

// =====================================================
// 🔗 MONGODB
// =====================================================

const MONGO_URI =
  "mongodb://127.0.0.1:27017";

const DB_NAME =
  "criminal_face_db";

async function getVoiceCollection() {

  if (
    mongoose.connection.readyState !== 1
  ) {

    await mongoose.connect(
      MONGO_URI,
      {
        dbName: DB_NAME
      }
    );

  }

  // IMPORTANT:
  // CaseRoutes uses voice_records
  return mongoose.connection.db.collection(
    "voice_records"
  );
}

// =====================================================
// 🧹 GET AUDIO PATH
// =====================================================

function getAudioPath(audio) {

  if (!audio) {
    return null;
  }

  let clean = String(audio).trim();

  if (!clean) {
    return null;
  }

  // Remove full localhost URL
  clean = clean.replace(
    /^https?:\/\/[^/]+/i,
    ""
  );

  // Windows slash -> /
  clean = clean.replace(/\\/g, "/");

  // Remove starting slash
  clean = clean.replace(/^\/+/, "");

  // -----------------------------------------------
  // uploads/cases/file.wav
  // -----------------------------------------------

  if (
    clean
      .toLowerCase()
      .startsWith("uploads/")
  ) {

    return path.join(
      BACKEND_DIR,
      clean.replace(/\//g, path.sep)
    );

  }

  // -----------------------------------------------
  // cases/file.wav
  // -----------------------------------------------

  if (
    clean
      .toLowerCase()
      .startsWith("cases/")
  ) {

    return path.join(
      UPLOAD_DIR,
      clean.replace(/\//g, path.sep)
    );

  }

  // -----------------------------------------------
  // filename.wav
  // -----------------------------------------------

  return path.join(
    UPLOAD_DIR,
    clean.replace(/\//g, path.sep)
  );
}

// =====================================================
// 🌐 GET AUDIO URL
// =====================================================

function getAudioUrl(audio) {

  if (!audio) {
    return "";
  }

  let value = String(audio).trim();

  if (!value) {
    return "";
  }

  // Already URL
  if (
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {

    return value;

  }

  value = value.replace(/\\/g, "/");

  // Full Windows path
  const uploadIndex =
    value.toLowerCase().indexOf(
      "/uploads/"
    );

  if (uploadIndex !== -1) {

    value =
      value.substring(
        uploadIndex
      );

  }

  // uploads/...
  if (
    value
      .toLowerCase()
      .startsWith("uploads/")
  ) {

    value =
      "/" + value;

  }

  // Already /uploads/...
  if (
    !value.startsWith("/")
  ) {

    value =
      "/" + value;

  }

  return value;
}

// =====================================================
// 🎧 CONVERT AUDIO TO WAV
// =====================================================

function convertToWav(
  inputPath,
  label = "audio"
) {

  return new Promise(
    (resolve, reject) => {

      if (
        !inputPath ||
        !fs.existsSync(inputPath)
      ) {

        return reject(
          new Error(
            `${label} input file not found`
          )
        );

      }

      const baseName =
        path.basename(
          inputPath,
          path.extname(inputPath)
        );

      const outputPath =
        path.join(
          VOICE_WAV_DIR,
          `${baseName}-${Date.now()}.wav`
        );

      console.log("");
      console.log(
        "🎧 FFmpeg conversion started"
      );
      console.log(
        "Input:",
        inputPath
      );
      console.log(
        "Output:",
        outputPath
      );

      const ffmpeg = spawn(
        "ffmpeg",
        [
          "-y",

          "-i",
          inputPath,

          "-vn",

          "-ac",
          "1",

          "-ar",
          "16000",

          "-sample_fmt",
          "s16",

          outputPath
        ],
        {
          windowsHide: true
        }
      );

      let stderr = "";

      ffmpeg.stderr.on(
        "data",
        data => {

          stderr +=
            data.toString();

        }
      );

      ffmpeg.on(
        "error",
        error => {

          console.error(
            "❌ FFmpeg spawn error:",
            error.message
          );

          reject(error);

        }
      );

      ffmpeg.on(
        "close",
        code => {

          console.log(
            "🎧 FFmpeg exit code:",
            code
          );

          if (
            code === 0 &&
            fs.existsSync(outputPath)
          ) {

            const stats =
              fs.statSync(outputPath);

            if (
              stats.size > 0
            ) {

              console.log(
                "✅ WAV created:",
                outputPath
              );

              resolve(outputPath);

              return;

            }

          }

          console.error(
            "❌ FFmpeg conversion failed"
          );

          console.error(
            stderr
          );

          reject(
            new Error(
              "Audio conversion to WAV failed"
            )
          );

        }
      );

    }
  );
}

// =====================================================
// 🧹 DELETE FILE SAFELY
// =====================================================

function deleteFile(filePath) {

  try {

    if (
      filePath &&
      fs.existsSync(filePath)
    ) {

      fs.unlinkSync(filePath);

      console.log(
        "🗑️ Deleted:",
        filePath
      );

    }

  } catch (error) {

    console.log(
      "⚠️ Delete failed:",
      error.message
    );

  }
}

// =====================================================
// 👤 FIND CRIMINAL
// =====================================================

async function findCriminalForVoiceRecord(
  record
) {

  try {

    // ---------------------------------------------
    // 1️⃣ criminalId
    // ---------------------------------------------

    if (record.criminalId) {

      const criminal =
        await Criminal.findOne({
          criminalId:
            record.criminalId
        }).lean();

      if (criminal) {
        return criminal;
      }

    }

    // ---------------------------------------------
    // 2️⃣ caseId
    // ---------------------------------------------

    if (record.caseId) {

      try {

        const casesCollection =
          mongoose.connection.db.collection(
            "cases"
          );

        const caseData =
          await casesCollection.findOne({
            caseId:
              record.caseId
          });

        if (
          caseData &&
          caseData.criminalId
        ) {

          const criminal =
            await Criminal.findOne({
              criminalId:
                caseData.criminalId
            }).lean();

          if (criminal) {
            return criminal;
          }

        }

      } catch (caseError) {

        console.log(
          "⚠️ Case lookup failed:",
          caseError.message
        );

      }

    }

    // ---------------------------------------------
    // 3️⃣ name
    // ---------------------------------------------

    if (record.name) {

      const criminal =
        await Criminal.findOne({
          name: record.name
        }).lean();

      if (criminal) {
        return criminal;
      }

    }

    return null;

  } catch (error) {

    console.log(
      "⚠️ Criminal lookup error:",
      error.message
    );

    return null;
  }

}

// =====================================================
// 🏠 TEST
// =====================================================

router.get(
  "/test",
  (req, res) => {

    res.json({
      success: true,
      message:
        "Voice API working successfully"
    });

  }
);

// =====================================================
// 🎙️ GET VOICE RECORDS
// =====================================================

router.get(
  "/",
  async (req, res) => {

    try {

      const collection =
        await getVoiceCollection();

      const records =
        await collection
          .find({})
          .sort({
            createdAt: -1
          })
          .toArray();

      const result =
        records.map(
          record => {

            return {
              ...record,

              audioUrl:
                getAudioUrl(
                  record.audio
                )
            };

          }
        );

      console.log(
        "🎙️ Voice records:",
        result.length
      );

      res.json({

        success: true,

        count:
          result.length,

        records:
          result

      });

    } catch (error) {

      console.error(
        "❌ GET VOICES ERROR:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Failed to load voice records",

        error:
          error.message

      });

    }

  }
);

// =====================================================
// 🔍 VOICE SEARCH
// =====================================================

router.post(
  "/search",
  upload.single("audio"),
  async (req, res) => {

    console.log("");
    console.log(
      "===================================="
    );
    console.log(
      "🎙️ VOICE SEARCH STARTED"
    );
    console.log(
      "===================================="
    );

    let queryAudioPath = null;
    let queryWavPath = null;

    const temporaryCandidateWavs = [];

    try {

      // =================================================
      // CHECK QUERY AUDIO
      // =================================================

      if (!req.file) {

        return res.status(400).json({

          success: false,
          match: false,
          score: 0,

          message:
            "No audio file uploaded"

        });

      }

      queryAudioPath =
        req.file.path;

      console.log(
        "🎵 Query audio:",
        queryAudioPath
      );

      console.log(
        "📦 File size:",
        req.file.size
      );

      console.log(
        "🎧 MIME:",
        req.file.mimetype
      );

      // =================================================
      // FILE EXISTS
      // =================================================

      if (
        !fs.existsSync(
          queryAudioPath
        )
      ) {

        return res.status(400).json({

          success: false,
          match: false,
          score: 0,

          message:
            "Uploaded audio file not found"

        });

      }

      // =================================================
      // 🔥 CONVERT QUERY TO WAV
      // =================================================

      console.log("");
      console.log(
        "🎧 Converting query audio to WAV..."
      );

      queryWavPath =
        await convertToWav(
          queryAudioPath,
          "Query audio"
        );

      console.log(
        "✅ Query WAV:",
        queryWavPath
      );

      // =================================================
      // MONGODB
      // =================================================

      const collection =
        await getVoiceCollection();

      console.log(
        "✅ Voice MongoDB Connected"
      );

      // =================================================
      // IMPORTANT:
      // ONLY CASE-LINKED VOICE RECORDS
      //
      // Old voice records such as VR-001 etc.
      // usually do not have caseId.
      // =================================================

      const voiceRecords =
        await collection
          .find({
            caseId: {
              $exists: true,
              $nin: [
                "",
                null
              ]
            }
          })
          .sort({
            createdAt: -1
          })
          .toArray();

      console.log(
        "🎙️ Case-linked voice records:",
        voiceRecords.length
      );

      // =================================================
      // FIND VALID FILES
      // =================================================

      const validVoiceRecords = [];

      for (
        const record of voiceRecords
      ) {

        const audioValue =
          record.audio;

        const candidatePath =
          getAudioPath(
            audioValue
          );

        console.log("");
        console.log(
          "------------------------------------"
        );

        console.log(
          "🎙️ Candidate:"
        );

        console.log(
          "Voice ID:",
          record.voiceId ||
            record._id
        );

        console.log(
          "Criminal ID:",
          record.criminalId ||
            "N/A"
        );

        console.log(
          "Case ID:",
          record.caseId ||
            "N/A"
        );

        console.log(
          "DB Audio:",
          audioValue
        );

        console.log(
          "Full Path:",
          candidatePath
        );

        if (
          candidatePath &&
          fs.existsSync(
            candidatePath
          )
        ) {

          const stats =
            fs.statSync(
              candidatePath
            );

          if (
            stats.isFile() &&
            stats.size > 0
          ) {

            console.log(
              "File: EXISTS ✅"
            );

            console.log(
              "Size:",
              stats.size
            );

            validVoiceRecords.push({
              ...record,
              candidatePath
            });

          } else {

            console.log(
              "File: INVALID ❌"
            );

          }

        } else {

          console.log(
            "File: NOT FOUND ❌"
          );

        }

      }

      console.log("");
      console.log(
        "🎙️ Valid case voice files:",
        validVoiceRecords.length
      );

      // =================================================
      // NO FILES
      // =================================================

      if (
        validVoiceRecords.length === 0
      ) {

        deleteFile(
          queryAudioPath
        );

        deleteFile(
          queryWavPath
        );

        return res.json({

          success: true,

          match: false,

          score: 0,

          message:
            "No valid case voice records found"

        });

      }

      // =================================================
      // BEST MATCH
      // =================================================

      let bestMatch = null;
      let bestScore = -Infinity;

      // =================================================
      // LOOP CANDIDATES
      // =================================================

      for (
        const record of validVoiceRecords
      ) {

        let candidateWavPath = null;

        try {

          console.log("");
          console.log(
            "===================================="
          );

          console.log(
            "🎧 Converting candidate to WAV"
          );

          console.log(
            "Candidate:",
            record.candidatePath
          );

          // ---------------------------------------------
          // Convert candidate
          // ---------------------------------------------

          candidateWavPath =
            await convertToWav(
              record.candidatePath,
              "Candidate audio"
            );

          temporaryCandidateWavs.push(
            candidateWavPath
          );

          console.log(
            "✅ Candidate WAV:",
            candidateWavPath
          );

          // ---------------------------------------------
          // Python
          // ---------------------------------------------

          console.log("");
          console.log(
            "🐍 COMPARING VOICE"
          );

          console.log(
            "Query WAV:",
            queryWavPath
          );

          console.log(
            "Candidate WAV:",
            candidateWavPath
          );

          const pythonProcess =
            spawn(
              "python",
              [
                PYTHON_SCRIPT,
                queryWavPath,
                candidateWavPath
              ],
              {
                cwd: BACKEND_DIR,
                windowsHide: true
              }
            );

          let stdout = "";
          let stderr = "";

          pythonProcess.stdout.on(
            "data",
            data => {

              const text =
                data.toString();

              stdout += text;

              console.log(
                "🐍 Python:",
                text.trim()
              );

            }
          );

          pythonProcess.stderr.on(
            "data",
            data => {

              const text =
                data.toString();

              stderr += text;

              console.log(
                "🐍 Python STDERR:",
                text.trim()
              );

            }
          );

          const pythonResult =
            await new Promise(
              resolve => {

                let finished = false;

                pythonProcess.on(
                  "close",
                  code => {

                    if (finished) {
                      return;
                    }

                    finished = true;

                    console.log(
                      "🐍 Python exit code:",
                      code
                    );

                    resolve({
                      code,
                      stdout,
                      stderr
                    });

                  }
                );

                pythonProcess.on(
                  "error",
                  error => {

                    if (finished) {
                      return;
                    }

                    finished = true;

                    console.error(
                      "❌ Python spawn error:",
                      error
                    );

                    resolve({

                      code: -1,

                      stdout,

                      stderr:
                        stderr +
                        "\n" +
                        error.message

                    });

                  }
                );

              }
            );

          // ---------------------------------------------
          // Parse Python JSON
          // ---------------------------------------------

          let pythonData = null;

          const lines =
            pythonResult.stdout
              .split(/\r?\n/)
              .map(
                line =>
                  line.trim()
              )
              .filter(Boolean);

          for (
            let i =
              lines.length - 1;
            i >= 0;
            i--
          ) {

            try {

              const parsed =
                JSON.parse(
                  lines[i]
                );

              if (
                parsed &&
                typeof parsed ===
                  "object"
              ) {

                pythonData =
                  parsed;

                break;

              }

            } catch (e) {

              // Ignore normal Python log lines

            }

          }

          // ---------------------------------------------
          // Python failed
          // ---------------------------------------------

          if (!pythonData) {

            console.log(
              "❌ Python returned no JSON"
            );

            console.log(
              "Python exit:",
              pythonResult.code
            );

            console.log(
              "Python stderr:",
              pythonResult.stderr
            );

            continue;

          }

          console.log(
            "📊 Python result:",
            pythonData
          );

          // ---------------------------------------------
          // Score
          // ---------------------------------------------

          let score =
            Number(
              pythonData.score
            );

          if (
            !Number.isFinite(score)
          ) {

            score = 0;

          }

          const isMatch =
            pythonData.match === true;

          console.log(
            "📊 Score:",
            score
          );

          console.log(
            "🎯 Match:",
            isMatch
          );

          // ---------------------------------------------
          // BEST MATCH
          // ---------------------------------------------

          if (
            isMatch &&
            score > bestScore
          ) {

            bestScore =
              score;

            bestMatch = {

              record,

              score

            };

          }

        } catch (candidateError) {

          console.error(
            "❌ Candidate processing error:",
            candidateError.message
          );

        }

      }

      // =================================================
      // CLEAN QUERY FILES
      // =================================================

      deleteFile(
        queryAudioPath
      );

      deleteFile(
        queryWavPath
      );

      // =================================================
      // CLEAN CANDIDATE WAV FILES
      // =================================================

      for (
        const tempWav of
          temporaryCandidateWavs
      ) {

        deleteFile(
          tempWav
        );

      }

      // =================================================
      // NO MATCH
      // =================================================

      if (!bestMatch) {

        console.log("");
        console.log(
          "❌ NO MATCH FOUND"
        );

        return res.json({

          success: true,

          match: false,

          score: 0,

          message:
            "No matching voice found"

        });

      }

      // =================================================
      // MATCH FOUND
      // =================================================

      const matchedRecord =
        bestMatch.record;

      const criminal =
        await findCriminalForVoiceRecord(
          matchedRecord
        );

      console.log("");
      console.log(
        "===================================="
      );

      console.log(
        "🎯 VOICE MATCH FOUND"
      );

      console.log(
        "===================================="
      );

      console.log(
        "Voice ID:",
        matchedRecord.voiceId ||
          matchedRecord._id
      );

      console.log(
        "Criminal ID:",
        matchedRecord.criminalId ||
          "N/A"
      );

      console.log(
        "Case ID:",
        matchedRecord.caseId ||
          "N/A"
      );

      console.log(
        "Score:",
        bestMatch.score
      );

      // =================================================
      // RESPONSE
      // =================================================

      return res.json({

        success: true,

        match: true,

        score:
          bestMatch.score,

        message:
          "Matching voice found",

        voice: {

          voiceId:
            matchedRecord.voiceId ||
            matchedRecord._id,

          criminalId:
            matchedRecord.criminalId ||
            "",

          caseId:
            matchedRecord.caseId ||
            "",

          name:
            matchedRecord.name ||
            (
              criminal
                ? criminal.name
                : ""
            ),

          audio:
            getAudioUrl(
              matchedRecord.audio
            ),

          audioUrl:
            getAudioUrl(
              matchedRecord.audio
            )

        },

        criminal:
          criminal
            ? {

                criminalId:
                  criminal.criminalId,

                name:
                  criminal.name,

                age:
                  criminal.age,

                gender:
                  criminal.gender,

                crime:
                  criminal.crime,

                fir:
                  criminal.fir,

                address:
                  criminal.address,

                description:
                  criminal.description,

                image:
                  criminal.image ||
                  criminal.photo ||
                  ""

              }
            : null

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

      console.error(
        error
      );

      // Cleanup
      deleteFile(
        queryAudioPath
      );

      deleteFile(
        queryWavPath
      );

      for (
        const tempWav of
          temporaryCandidateWavs
      ) {

        deleteFile(
          tempWav
        );

      }

      return res.status(500).json({

        success: false,

        match: false,

        score: 0,

        message:
          "Voice search failed",

        error:
          error.message

      });

    }

  }
);

// =====================================================
// ❌ MULTER ERROR HANDLER
// =====================================================

router.use(
  (error, req, res, next) => {

    if (
      error instanceof
      multer.MulterError
    ) {

      return res.status(400).json({

        success: false,

        match: false,

        message:
          "Audio upload error",

        error:
          error.message

      });

    }

    if (error) {

      return res.status(400).json({

        success: false,

        match: false,

        message:
          "Voice upload failed",

        error:
          error.message

      });

    }

    next();

  }
);

// =====================================================
// EXPORT
// =====================================================

module.exports = router;