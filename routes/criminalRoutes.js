const express = require("express");
const router = express.Router();

const Criminal = require("../models/Criminal");
const Notification = require("../models/Notification");

const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { runFaceSearch } = require("../faceDemo");

// =====================================================
// UPLOAD FOLDER
// =====================================================

const uploadPath = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, {
    recursive: true,
  });
}

// =====================================================
// MULTER STORAGE
// =====================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const fileName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1000000000) +
      path.extname(file.originalname);

    cb(null, fileName);
  },
});

// =====================================================
// FILE FILTER
// =====================================================

const fileFilter = (req, file, cb) => {
  const isImage =
    file.mimetype &&
    file.mimetype.startsWith("image/");

  const isAudio =
    file.mimetype &&
    file.mimetype.startsWith("audio/");

  if (isImage || isAudio) {
    cb(null, true);
  } else {
    cb(
      new Error("Only image and audio files are allowed"),
      false
    );
  }
};

// =====================================================
// MULTER
// =====================================================

const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

// =====================================================
// GET ALL CRIMINALS
// =====================================================

router.get("/", async (req, res) => {
  try {
    const criminals = await Criminal.find()
      .sort({
        createdAt: -1,
      })
      .lean();

    res.status(200).json(criminals);
  } catch (error) {
    console.error("❌ Get Criminals Error:", error);

    res.status(500).json({
      message: "Failed to fetch criminals",
      error: error.message,
    });
  }
});

// =====================================================
// SEARCH CRIMINAL BY NAME
// =====================================================

router.get("/search", async (req, res) => {
  try {
    const { name } = req.query;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Please enter criminal name",
      });
    }

    const criminal = await Criminal.findOne({
      name: {
        $regex: name.trim(),
        $options: "i",
      },
    })
      .select(
        "criminalId name crime image photo voice"
      )
      .lean();

    if (!criminal) {
      return res.status(404).json({
        message: "Criminal not found",
      });
    }

    res.status(200).json({
      criminalId: criminal.criminalId,
      name: criminal.name,
      crime: criminal.crime,
      photo:
        criminal.photo ||
        criminal.image ||
        "",
      voice:
        criminal.voice ||
        "",
    });
  } catch (error) {
    console.error("❌ Search Error:", error);

    res.status(500).json({
      message: "Criminal search failed",
      error: error.message,
    });
  }
});

// =====================================================
// FACE SEARCH
// =====================================================

router.post(
  "/face-search",
  upload.single("photo"),
  async (req, res) => {
    let uploadedQueryPath = null;

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          match: false,
          message: "Please upload a face photo",
        });
      }

      uploadedQueryPath = req.file.path;

      const criminals = await Criminal.find()
        .select(
          "criminalId name age gender crime firNumber address image photo voice"
        )
        .lean();

      const candidates = [];

      for (const criminal of criminals) {
        let imagePathFromDB =
          criminal.image ||
          criminal.photo ||
          "";

        if (!imagePathFromDB) {
          continue;
        }

        imagePathFromDB = String(
          imagePathFromDB
        ).replace(/\\/g, "/");

        const imageName =
          path.basename(imagePathFromDB);

        const realImagePath =
          path.join(
            uploadPath,
            imageName
          );

        if (!fs.existsSync(realImagePath)) {
          continue;
        }

        candidates.push({
          criminalId:
            criminal.criminalId || "",

          name:
            criminal.name || "",

          crime:
            criminal.crime || "",

          image:
            imagePathFromDB,

          imagePath:
            realImagePath,
        });
      }

      if (candidates.length === 0) {
        if (
          uploadedQueryPath &&
          fs.existsSync(uploadedQueryPath)
        ) {
          fs.unlinkSync(uploadedQueryPath);
        }

        return res.status(200).json({
          success: true,
          match: false,
          score: 0,
          criminal: null,
          message:
            "No criminal photos available for comparison",
        });
      }

      const pythonResult =
        await runFaceSearch(
          uploadedQueryPath,
          candidates
        );

      if (
        uploadedQueryPath &&
        fs.existsSync(uploadedQueryPath)
      ) {
        fs.unlinkSync(uploadedQueryPath);
      }

      uploadedQueryPath = null;

      if (
        !pythonResult ||
        !pythonResult.success
      ) {
        return res.status(500).json({
          success: false,
          match: false,
          message:
            pythonResult?.message ||
            "Face recognition failed",
        });
      }

      if (
        pythonResult.match === true &&
        pythonResult.criminal
      ) {
        const matchedCriminal =
          await Criminal.findOne({
            criminalId:
              pythonResult.criminal.criminalId,
          }).lean();

        if (!matchedCriminal) {
          return res.status(200).json({
            success: true,
            match: false,
            score:
              pythonResult.score || 0,
            criminal: null,
            message:
              "Matching face found, but criminal record was not found",
          });
        }

        return res.status(200).json({
          success: true,
          match: true,
          score:
            pythonResult.score || 0,

          criminal: {
            criminalId:
              matchedCriminal.criminalId,

            name:
              matchedCriminal.name,

            age:
              matchedCriminal.age,

            gender:
              matchedCriminal.gender,

            crime:
              matchedCriminal.crime,

            firNumber:
              matchedCriminal.firNumber,

            address:
              matchedCriminal.address,

            image:
              matchedCriminal.image ||
              matchedCriminal.photo ||
              "",

            voice:
              matchedCriminal.voice ||
              "",
          },

          message:
            "Matching criminal record found",
        });
      }

      return res.status(200).json({
        success: true,
        match: false,
        score:
          pythonResult.score || 0,
        criminal: null,
        message:
          "No matching criminal record was found",
      });
    } catch (error) {
      console.error(
        "❌ FACE SEARCH ERROR:",
        error
      );

      if (
        uploadedQueryPath &&
        fs.existsSync(uploadedQueryPath)
      ) {
        try {
          fs.unlinkSync(
            uploadedQueryPath
          );
        } catch (cleanupError) {
          console.error(
            "Cleanup Error:",
            cleanupError.message
          );
        }
      }

      res.status(500).json({
        success: false,
        match: false,
        message:
          "Face recognition failed",
        error:
          error.message,
      });
    }
  }
);

// =====================================================
// GET SINGLE CRIMINAL
// =====================================================

router.get(
  "/:criminalId",
  async (req, res) => {
    try {
      const criminal =
        await Criminal.findOne({
          criminalId:
            String(
              req.params.criminalId
            ).trim(),
        }).lean();

      if (!criminal) {
        return res.status(404).json({
          message:
            "Criminal not found",
        });
      }

      res.status(200).json(
        criminal
      );
    } catch (error) {
      console.error(
        "❌ Get Criminal Error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to fetch criminal",
        error:
          error.message,
      });
    }
  }
);

// =====================================================
// ADD NEW CRIMINAL
// PHOTO OPTIONAL
// VOICE OPTIONAL
// DESCRIPTION REMOVED
// =====================================================

router.post(
  "/add",

  upload.fields([
    {
      name: "image",
      maxCount: 1,
    },

    {
      name: "voice",
      maxCount: 1,
    },
  ]),

  async (req, res) => {
    try {
      console.log(
        "📥 New Criminal Data:",
        req.body
      );

      console.log(
        "📂 Uploaded Files:",
        req.files
      );

      // =================================================
      // GET FORM DATA
      // =================================================

      const name =
        String(
          req.body.name || ""
        ).trim();

      const age =
        String(
          req.body.age || ""
        ).trim();

      const gender =
        String(
          req.body.gender || ""
        ).trim();

      const crime =
        String(
          req.body.crime || ""
        ).trim();

      const firNumber =
        String(
          req.body.firNumber || ""
        ).trim();

      const address =
        String(
          req.body.address || ""
        ).trim();

      // =================================================
      // REQUIRED VALIDATION
      // PHOTO IS NOT REQUIRED
      // DESCRIPTION IS NOT REQUIRED
      // =================================================

      if (
        !name ||
        !age ||
        !gender ||
        !crime ||
        !firNumber ||
        !address
      ) {
        return res.status(400).json({
          message:
            "Please fill all required fields",
        });
      }

      // =================================================
      // VALIDATE AGE
      // =================================================

      const numericAge =
        Number(age);

      if (
        !Number.isInteger(
          numericAge
        ) ||
        numericAge <= 0
      ) {
        return res.status(400).json({
          message:
            "Please enter a valid age",
        });
      }

      // =================================================
      // GET EXISTING CRIMINAL IDS
      // =================================================

      const criminals =
        await Criminal.find()
          .select("criminalId")
          .lean();

      let maxNumber = 0;

      criminals.forEach(
        (criminal) => {
          if (
            !criminal.criminalId
          ) {
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

      // =================================================
      // AUTOMATIC CRIMINAL ID
      // =================================================

      const criminalId =
        `CR-${String(
          maxNumber + 1
        ).padStart(3, "0")}`;

      console.log(
        "🆔 Generated Criminal ID:",
        criminalId
      );

      // =================================================
      // IMAGE OPTIONAL
      // =================================================

      const imageFile =
        req.files?.image?.[0];

      let imageUrl = "";

      if (imageFile) {
        imageUrl =
          `/uploads/${imageFile.filename}`;

        console.log(
          "🖼️ Image Saved:",
          imageUrl
        );
      } else {
        console.log(
          "ℹ️ No criminal photo uploaded"
        );
      }

      // =================================================
      // VOICE OPTIONAL
      // =================================================

      const voiceFile =
        req.files?.voice?.[0];

      let voiceUrl = "";

      if (voiceFile) {
        voiceUrl =
          `/uploads/${voiceFile.filename}`;

        console.log(
          "🎤 Voice Saved:",
          voiceUrl
        );
      }

      // =================================================
      // CREATE CRIMINAL
      // =================================================

      const newCriminal =
        new Criminal({
          criminalId,

          name,

          age:
            numericAge,

          gender,

          crime,

          firNumber,

          address,

          image:
            imageUrl,

          voice:
            voiceUrl,
        });

      // =================================================
      // SAVE
      // =================================================

      const savedCriminal =
        await newCriminal.save();

      console.log(
        "✅ Criminal Saved:",
        savedCriminal.criminalId
      );

      // =================================================
      // NOTIFICATION
      // =================================================

      try {
        await Notification.create({
          title:
            "New Criminal Added",

          message:
            `${savedCriminal.criminalId} - ${savedCriminal.name} has been added successfully.`,

          type:
            "criminal",

          role:
            "all",

          read:
            false,

          isRead:
            false,
        });
      } catch (
        notificationError
      ) {
        console.error(
          "⚠️ Notification Error:",
          notificationError.message
        );
      }

      // =================================================
      // RESPONSE
      // =================================================

      return res.status(201).json({
        message:
          "Criminal added successfully",

        criminal:
          savedCriminal,
      });
    } catch (error) {
      console.error(
        "❌ Add Criminal Error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to add criminal",

        error:
          error.message,
      });
    }
  }
);

// =====================================================
// DELETE CRIMINAL
// =====================================================

router.delete(
  "/:criminalId",
  async (req, res) => {
    try {
      const criminalId =
        String(
          req.params.criminalId
        ).trim();

      const deletedCriminal =
        await Criminal.findOneAndDelete({
          criminalId,
        });

      if (!deletedCriminal) {
        return res.status(404).json({
          message:
            "Criminal not found",
        });
      }

      // =================================================
      // DELETE IMAGE
      // =================================================

      if (
        deletedCriminal.image
      ) {
        const imageName =
          path.basename(
            deletedCriminal.image
          );

        const imagePath =
          path.join(
            uploadPath,
            imageName
          );

        if (
          fs.existsSync(
            imagePath
          )
        ) {
          fs.unlinkSync(
            imagePath
          );
        }
      }

      // =================================================
      // DELETE VOICE
      // =================================================

      if (
        deletedCriminal.voice
      ) {
        const voiceName =
          path.basename(
            deletedCriminal.voice
          );

        const voicePath =
          path.join(
            uploadPath,
            voiceName
          );

        if (
          fs.existsSync(
            voicePath
          )
        ) {
          fs.unlinkSync(
            voicePath
          );
        }
      }

      // =================================================
      // NOTIFICATION
      // =================================================

      try {
        await Notification.create({
          title:
            "Criminal Deleted",

          message:
            `${criminalId} - ${deletedCriminal.name} has been deleted.`,

          type:
            "criminal",

          role:
            "all",

          read:
            false,

          isRead:
            false,
        });
      } catch (
        notificationError
      ) {
        console.error(
          "⚠️ Delete Notification Error:",
          notificationError.message
        );
      }

      res.status(200).json({
        message:
          "Criminal deleted successfully",
      });
    } catch (error) {
      console.error(
        "❌ Delete Criminal Error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to delete criminal",

        error:
          error.message,
      });
    }
  }
);

// =====================================================
// MULTER ERROR HANDLER
// =====================================================

router.use(
  (
    error,
    req,
    res,
    next
  ) => {
    if (
      error instanceof
      multer.MulterError
    ) {
      return res.status(400).json({
        message:
          "File upload error",

        error:
          error.message,
      });
    }

    if (error) {
      return res.status(400).json({
        message:
          error.message,
      });
    }

    next();
  }
);

// =====================================================
// EXPORT
// =====================================================

module.exports =
  router;