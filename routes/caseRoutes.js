const express = require("express");
const router = express.Router();

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");

const Case = require("../models/Case");

// =====================================================
// 🎙️ VOICE RECORD COLLECTION
// =====================================================

function getVoiceRecordsCollection() {
  if (!mongoose.connection.db) {
    throw new Error(
      "MongoDB database connection is not ready"
    );
  }

  return mongoose.connection.db.collection(
    "voice_records"
  );
}

// =====================================================
// 📁 UPLOAD DIRECTORY
// =====================================================

const uploadDir = path.join(
  __dirname,
  "..",
  "uploads",
  "cases"
);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

// =====================================================
// 🎤 MULTER STORAGE
// =====================================================

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },

  filename: function (req, file, cb) {
    const ext = path.extname(
      file.originalname
    );

    const baseName = path
      .basename(
        file.originalname,
        ext
      )
      .replace(
        /[^a-zA-Z0-9_-]/g,
        "_"
      );

    const uniqueName =
      `${baseName}-${Date.now()}${ext}`;

    cb(null, uniqueName);
  },
});

// =====================================================
// 📦 MULTER
// =====================================================

const upload = multer({
  storage: storage,

  limits: {
    fileSize:
      100 * 1024 * 1024,
  },
});

// =====================================================
// 🗑️ DELETE PHYSICAL FILE
// =====================================================

function deletePhysicalFile(fileUrl) {
  try {
    if (!fileUrl) {
      return;
    }

    const fileName =
      path.basename(fileUrl);

    const filePath =
      path.join(
        uploadDir,
        fileName
      );

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);

      console.log(
        "🗑️ Deleted file:",
        fileName
      );
    }
  } catch (error) {
    console.error(
      "❌ File delete error:",
      error.message
    );
  }
}

// =====================================================
// 🌐 FILE URL
// =====================================================

function makeFileUrl(file) {
  if (!file) {
    return "";
  }

  return `/uploads/cases/${file.filename}`;
}

// =====================================================
// 📋 GET ALL CASES
// =====================================================

router.get(
  "/",
  async (req, res) => {
    try {
      const cases =
        await Case.find().sort({
          createdAt: -1,
        });

      return res.status(200).json(
        cases
      );
    } catch (error) {
      console.error(
        "❌ Get cases error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to get cases",
        error:
          error.message,
      });
    }
  }
);

// =====================================================
// 🔎 GET SINGLE CASE
// =====================================================

router.get(
  "/:caseId",
  async (req, res) => {
    try {
      const caseId =
        String(
          req.params.caseId ||
            ""
        ).trim();

      const caseData =
        await Case.findOne({
          caseId: caseId,
        });

      if (!caseData) {
        return res.status(404).json({
          success: false,
          message:
            "Case not found",
        });
      }

      return res.status(200).json(
        caseData
      );
    } catch (error) {
      console.error(
        "❌ Get single case error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to get case",
        error:
          error.message,
      });
    }
  }
);

// =====================================================
// ➕ ADD CASE
// =====================================================

router.post(
  "/",

  upload.fields([
    {
      name: "photo",
      maxCount: 1,
    },

    {
      name: "evidencePhotos",
      maxCount: 20,
    },

    {
      name: "evidenceVideos",
      maxCount: 10,
    },

    {
      name: "voice",
      maxCount: 1,
    },

    {
      name: "documents",
      maxCount: 20,
    },
  ]),

  async (req, res) => {
    try {
      console.log(
        "================================"
      );

      console.log(
        "➕ ADD CASE"
      );

      console.log(
        "================================"
      );

      const {
        caseId,
        criminalId,
        crimeType,
        crimeDate,
        description,
        policeStation,
        investigatingOfficer,
        status,
        location,
        district,
        latitude,
        longitude,
      } = req.body;

      // =================================================
      // DEBUG
      // =================================================

      console.log(
        "📦 BODY:",
        req.body
      );

      console.log(
        "📁 FILES:",
        req.files
          ? Object.keys(req.files)
          : []
      );

      if (req.files?.voice) {
        console.log(
          "🎙️ VOICE FILE:",
          req.files.voice[0].originalname
        );
      }

      // =================================================
      // VALIDATION
      // =================================================

      if (!caseId) {
        return res.status(400).json({
          success: false,
          message:
            "Case ID is required",
        });
      }

      if (!criminalId) {
        return res.status(400).json({
          success: false,
          message:
            "Criminal ID is required",
        });
      }

      // =================================================
      // DUPLICATE CASE CHECK
      // =================================================

      const existingCase =
        await Case.findOne({
          caseId: caseId,
        });

      if (existingCase) {
        return res.status(400).json({
          success: false,
          message:
            "Case ID already exists",
        });
      }

      // =================================================
      // MAIN PHOTO
      // =================================================

      let mainPhoto = "";

      if (
        req.files?.photo &&
        req.files.photo.length > 0
      ) {
        mainPhoto =
          makeFileUrl(
            req.files.photo[0]
          );
      }

      // =================================================
      // DOCUMENTS
      // =================================================

      const documents = [];

      // =================================================
      // MAIN PHOTO DOCUMENT
      // =================================================

      if (req.files?.photo) {
        req.files.photo.forEach(
          (file) => {
            documents.push({
              name:
                file.originalname,

              fileUrl:
                makeFileUrl(file),

              type: "photo",
            });
          }
        );
      }

      // =================================================
      // EVIDENCE PHOTOS
      // =================================================

      if (
        req.files?.evidencePhotos
      ) {
        req.files.evidencePhotos.forEach(
          (file) => {
            documents.push({
              name:
                file.originalname,

              fileUrl:
                makeFileUrl(file),

              type:
                "evidence-photo",
            });
          }
        );
      }

      // =================================================
      // EVIDENCE VIDEOS
      // =================================================

      if (
        req.files?.evidenceVideos
      ) {
        req.files.evidenceVideos.forEach(
          (file) => {
            documents.push({
              name:
                file.originalname,

              fileUrl:
                makeFileUrl(file),

              type:
                "evidence-video",
            });
          }
        );
      }

      // =================================================
      // 🎙️ VOICE
      // =================================================

      if (req.files?.voice) {
        req.files.voice.forEach(
          (file) => {
            documents.push({
              name:
                file.originalname,

              fileUrl:
                makeFileUrl(file),

              type: "voice",
            });
          }
        );
      }

      // =================================================
      // OTHER DOCUMENTS
      // =================================================

      if (
        req.files?.documents
      ) {
        req.files.documents.forEach(
          (file) => {
            documents.push({
              name:
                file.originalname,

              fileUrl:
                makeFileUrl(file),

              type: "document",
            });
          }
        );
      }

      // =================================================
      // CREATE CASE
      // =================================================

      const newCase =
        new Case({
          caseId: caseId,

          criminalId:
            criminalId,

          crimeType:
            crimeType || "",

          crimeDate:
            crimeDate || null,

          description:
            description || "",

          policeStation:
            policeStation || "",

          investigatingOfficer:
            investigatingOfficer ||
            "",

          status:
            status || "Active",

          location:
            location || "",

          district:
            district || "",

          latitude:
            latitude !==
            undefined
              ? Number(latitude)
              : 0,

          longitude:
            longitude !==
            undefined
              ? Number(longitude)
              : 0,

          photo:
            mainPhoto,

          voice: "",

          evidencePhotos: [],

          evidenceVideos: [],

          documents:
            documents,
        });

      // =================================================
      // EVIDENCE PHOTO ARRAY
      // =================================================

      newCase.evidencePhotos =
        documents
          .filter(
            (doc) =>
              doc.type ===
              "evidence-photo"
          )
          .map(
            (doc) =>
              doc.fileUrl
          );

      // =================================================
      // EVIDENCE VIDEO ARRAY
      // =================================================

      newCase.evidenceVideos =
        documents
          .filter(
            (doc) =>
              doc.type ===
              "evidence-video"
          )
          .map(
            (doc) =>
              doc.fileUrl
          );

      // =================================================
      // VOICE URL
      // =================================================

      const voiceDocuments =
        documents.filter(
          (doc) =>
            doc.type ===
            "voice"
        );

      const uploadedVoiceUrl =
        voiceDocuments.length > 0
          ? voiceDocuments[
              voiceDocuments.length -
                1
            ].fileUrl
          : "";

      newCase.voice =
        uploadedVoiceUrl;

      // =================================================
      // SAVE CASE
      // =================================================

      const savedCase =
        await newCase.save();

      console.log(
        "✅ CASE SAVED:",
        savedCase.caseId
      );

      // =================================================
      // 🎙️ SAVE NEW CASE VOICE RECORD
      // =================================================

      if (
        uploadedVoiceUrl &&
        req.files?.voice?.length > 0
      ) {
        try {
          const voiceFile =
            req.files.voice[0];

          const voiceCollection =
            getVoiceRecordsCollection();

          const voiceRecord = {
            voiceId:
              `VOICE_${Date.now()}`,

            criminalId:
              String(
                criminalId || ""
              ),

            caseId:
              String(
                caseId || ""
              ),

            name:
              voiceFile.originalname ||
              "",

            originalName:
              voiceFile.originalname ||
              "",

            audio:
              uploadedVoiceUrl,

            // ⭐ IMPORTANT
            // Only these records
            // are used by Voice Search.
            source:
              "case_voice",

            createdAt:
              new Date(),

            updatedAt:
              new Date(),
          };

          console.log(
            "🎙️ SAVING NEW CASE VOICE RECORD:"
          );

          console.log(
            voiceRecord
          );

          await voiceCollection.insertOne(
            voiceRecord
          );

          console.log(
            "✅ New VoiceRecord created:",
            voiceRecord.voiceId
          );
        } catch (
          voiceError
        ) {
          console.error(
            "❌ VoiceRecord save error:",
            voiceError
          );
        }
      } else {
        console.log(
          "ℹ️ No voice file uploaded."
        );
      }

      // =================================================
      // SUCCESS
      // =================================================

      console.log(
        "✅ Case created:",
        savedCase.caseId
      );

      return res.status(201).json({
        success: true,

        message:
          "Case created successfully",

        case:
          savedCase,
      });
    } catch (error) {
      console.error(
        "❌ Add case error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to create case",

        error:
          error.message,
      });
    }
  }
);

// =====================================================
// ✏️ UPDATE CASE
// =====================================================

router.put(
  "/:caseId",

  upload.fields([
    {
      name: "photo",
      maxCount: 1,
    },

    {
      name: "evidencePhotos",
      maxCount: 20,
    },

    {
      name: "evidenceVideos",
      maxCount: 10,
    },

    {
      name: "voice",
      maxCount: 1,
    },

    {
      name: "documents",
      maxCount: 20,
    },
  ]),

  async (req, res) => {
    try {
      const caseId =
        String(
          req.params.caseId ||
            ""
        ).trim();

      const caseData =
        await Case.findOne({
          caseId:
            caseId,
        });

      if (!caseData) {
        return res.status(404).json({
          success: false,
          message:
            "Case not found",
        });
      }

      // =================================================
      // BASIC FIELDS
      // =================================================

      const fields = [
        "criminalId",
        "crimeType",
        "crimeDate",
        "description",
        "policeStation",
        "investigatingOfficer",
        "status",
        "location",
        "district",
      ];

      fields.forEach(
        (field) => {
          if (
            req.body[field] !==
            undefined
          ) {
            caseData[field] =
              req.body[field];
          }
        }
      );

      // =================================================
      // LATITUDE
      // =================================================

      if (
        req.body.latitude !==
        undefined
      ) {
        const latitude =
          Number(
            req.body.latitude
          );

        if (
          Number.isFinite(
            latitude
          )
        ) {
          caseData.latitude =
            latitude;
        }
      }

      // =================================================
      // LONGITUDE
      // =================================================

      if (
        req.body.longitude !==
        undefined
      ) {
        const longitude =
          Number(
            req.body.longitude
          );

        if (
          Number.isFinite(
            longitude
          )
        ) {
          caseData.longitude =
            longitude;
        }
      }

      // =================================================
      // PHOTO
      // =================================================

      const newPhoto =
        req.files?.photo?.[0] ||
        null;

      const deleteExistingPhoto =
        String(
          req.body
            .deleteExistingPhoto ||
            "false"
        ).toLowerCase() ===
        "true";

      // =================================================
      // REMOVED DOCUMENTS
      // =================================================

      let removedDocuments = [];

      if (
        req.body.removedDocuments
      ) {
        try {
          removedDocuments =
            JSON.parse(
              req.body
                .removedDocuments
            );
        } catch (
          error
        ) {
          removedDocuments =
            [];
        }
      }

      if (
        !Array.isArray(
          removedDocuments
        )
      ) {
        removedDocuments =
          [];
      }

      // =================================================
      // DELETE REMOVED DOCUMENTS
      // =================================================

      for (
        const removed of
        removedDocuments
      ) {
        if (
          !removed ||
          !removed.fileUrl
        ) {
          continue;
        }

        const removedUrl =
          removed.fileUrl;

        deletePhysicalFile(
          removedUrl
        );

        if (
          caseData.photo ===
          removedUrl
        ) {
          caseData.photo =
            "";
        }

        // =================================================
        // DELETE LINKED VOICE
        // =================================================

        if (
          removed.type ===
          "voice"
        ) {
          try {
            const voiceCollection =
              getVoiceRecordsCollection();

            await voiceCollection.deleteMany(
              {
                caseId:
                  String(
                    caseId
                  ),

                audio:
                  removedUrl,
              }
            );

            console.log(
              "🎙️ Removed VoiceRecord:",
              removedUrl
            );
          } catch (
            voiceError
          ) {
            console.error(
              "❌ VoiceRecord delete error:",
              voiceError.message
            );
          }
        }

        caseData.documents =
          caseData.documents.filter(
            (doc) =>
              doc.fileUrl !==
              removedUrl
          );
      }

      // =================================================
      // REPLACE PHOTO
      // =================================================

      if (newPhoto) {
        if (
          caseData.photo
        ) {
          deletePhysicalFile(
            caseData.photo
          );
        }

        caseData.documents =
          caseData.documents.filter(
            (doc) => {
              if (
                doc.type ===
                "photo"
              ) {
                if (
                  doc.fileUrl
                ) {
                  deletePhysicalFile(
                    doc.fileUrl
                  );
                }

                return false;
              }

              return true;
            }
          );

        const newPhotoUrl =
          makeFileUrl(
            newPhoto
          );

        caseData.photo =
          newPhotoUrl;

        caseData.documents.push({
          name:
            newPhoto.originalname,

          fileUrl:
            newPhotoUrl,

          type: "photo",
        });
      }

      // =================================================
      // DELETE EXISTING PHOTO
      // =================================================

      else if (
        deleteExistingPhoto
      ) {
        if (
          caseData.photo
        ) {
          deletePhysicalFile(
            caseData.photo
          );
        }

        caseData.documents =
          caseData.documents.filter(
            (doc) => {
              if (
                doc.type ===
                "photo"
              ) {
                if (
                  doc.fileUrl
                ) {
                  deletePhysicalFile(
                    doc.fileUrl
                  );
                }

                return false;
              }

              return true;
            }
          );

        caseData.photo =
          "";
      }

      // =================================================
      // NEW EVIDENCE PHOTOS
      // =================================================

      if (
        req.files
          ?.evidencePhotos
          ?.length
      ) {
        req.files.evidencePhotos.forEach(
          (file) => {
            caseData.documents.push({
              name:
                file.originalname,

              fileUrl:
                makeFileUrl(file),

              type:
                "evidence-photo",
            });
          }
        );
      }

      // =================================================
      // NEW EVIDENCE VIDEOS
      // =================================================

      if (
        req.files
          ?.evidenceVideos
          ?.length
      ) {
        req.files.evidenceVideos.forEach(
          (file) => {
            caseData.documents.push({
              name:
                file.originalname,

              fileUrl:
                makeFileUrl(file),

              type:
                "evidence-video",
            });
          }
        );
      }

      // =================================================
      // 🎙️ NEW VOICE
      // =================================================

      let newVoiceFileUploaded =
        false;

      if (
        req.files?.voice?.length
      ) {
        req.files.voice.forEach(
          (file) => {
            caseData.documents.push({
              name:
                file.originalname,

              fileUrl:
                makeFileUrl(file),

              type: "voice",
            });
          }
        );

        newVoiceFileUploaded =
          true;
      }

      // =================================================
      // NEW DOCUMENTS
      // =================================================

      if (
        req.files
          ?.documents
          ?.length
      ) {
        req.files.documents.forEach(
          (file) => {
            caseData.documents.push({
              name:
                file.originalname,

              fileUrl:
                makeFileUrl(file),

              type: "document",
            });
          }
        );
      }

      // =================================================
      // UPDATE EVIDENCE PHOTOS
      // =================================================

      caseData.evidencePhotos =
        caseData.documents
          .filter(
            (doc) =>
              doc.type ===
              "evidence-photo"
          )
          .map(
            (doc) =>
              doc.fileUrl
          );

      // =================================================
      // UPDATE EVIDENCE VIDEOS
      // =================================================

      caseData.evidenceVideos =
        caseData.documents
          .filter(
            (doc) =>
              doc.type ===
              "evidence-video"
          )
          .map(
            (doc) =>
              doc.fileUrl
          );

      // =================================================
      // UPDATE VOICE
      // =================================================

      const voiceDocuments =
        caseData.documents.filter(
          (doc) =>
            doc.type ===
            "voice"
        );

      const latestVoiceUrl =
        voiceDocuments.length
          ? voiceDocuments[
              voiceDocuments.length -
                1
            ].fileUrl
          : "";

      caseData.voice =
        latestVoiceUrl;

      // =================================================
      // 🎙️ CREATE NEW VOICE RECORD
      // =================================================

      if (
        newVoiceFileUploaded &&
        latestVoiceUrl
      ) {
        try {
          const voiceFile =
            req.files
              ?.voice?.[0];

          if (voiceFile) {
            const voiceCollection =
              getVoiceRecordsCollection();

            const voiceRecord = {
              voiceId:
                `VOICE_${Date.now()}`,

              criminalId:
                String(
                  caseData
                    .criminalId ||
                    ""
                ),

              caseId:
                String(
                  caseData
                    .caseId ||
                    caseId
                ),

              name:
                voiceFile
                  .originalname ||
                "",

              originalName:
                voiceFile
                  .originalname ||
                "",

              audio:
                latestVoiceUrl,

              // ⭐ IMPORTANT
              source:
                "case_voice",

              createdAt:
                new Date(),

              updatedAt:
                new Date(),
            };

            await voiceCollection.insertOne(
              voiceRecord
            );

            console.log(
              "🎙️ Updated VoiceRecord created:",
              voiceRecord.voiceId
            );
          }
        } catch (
          voiceError
        ) {
          console.error(
            "❌ Update VoiceRecord error:",
            voiceError.message
          );
        }
      }

      // =================================================
      // SAVE CASE
      // =================================================

      const updatedCase =
        await caseData.save();

      return res.status(200).json({
        success: true,

        message:
          "Case updated successfully",

        case:
          updatedCase,
      });
    } catch (error) {
      console.error(
        "❌ Update case error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to update case",

        error:
          error.message,
      });
    }
  }
);

// =====================================================
// 🗑️ DELETE CASE
// =====================================================

router.delete(
  "/:caseId",

  async (req, res) => {
    try {
      const caseId =
        String(
          req.params.caseId ||
            ""
        ).trim();

      const caseData =
        await Case.findOne({
          caseId:
            caseId,
        });

      if (!caseData) {
        return res.status(404).json({
          success: false,
          message:
            "Case not found",
        });
      }

      // =================================================
      // DELETE MAIN PHOTO
      // =================================================

      if (
        caseData.photo
      ) {
        deletePhysicalFile(
          caseData.photo
        );
      }

      // =================================================
      // DELETE ALL CASE FILES
      // =================================================

      if (
        Array.isArray(
          caseData.documents
        )
      ) {
        caseData.documents.forEach(
          (doc) => {
            if (
              doc.fileUrl &&
              doc.fileUrl !==
                caseData.photo
            ) {
              deletePhysicalFile(
                doc.fileUrl
              );
            }
          }
        );
      }

      // =================================================
      // DELETE LINKED VOICE RECORDS
      // =================================================

      try {
        const voiceCollection =
          getVoiceRecordsCollection();

        const voiceDeleteResult =
          await voiceCollection.deleteMany(
            {
              caseId:
                String(
                  caseId
                ),
            }
          );

        console.log(
          "🎙️ Linked VoiceRecords deleted:",
          voiceDeleteResult.deletedCount,
          "for case:",
          caseId
        );
      } catch (
        voiceError
      ) {
        console.error(
          "❌ VoiceRecord delete error:",
          voiceError.message
        );
      }

      // =================================================
      // DELETE CASE
      // =================================================

      await Case.deleteOne({
        caseId:
          caseId,
      });

      console.log(
        "🗑️ Case and linked voices deleted:",
        caseId
      );

      // =================================================
      // SUCCESS
      // =================================================

      return res.status(200).json({
        success: true,

        message:
          "Case deleted successfully",
      });
    } catch (error) {
      console.error(
        "❌ Delete case error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to delete case",

        error:
          error.message,
      });
    }
  }
);

// =====================================================
// ❌ MULTER ERROR HANDLER
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
      console.error(
        "❌ Multer error:",
        error.message
      );

      return res.status(400).json({
        success: false,

        message:
          `Upload error: ${error.message}`,
      });
    }

    if (error) {
      console.error(
        "❌ Route error:",
        error.message
      );

      return res.status(500).json({
        success: false,

        message:
          "Server error",

        error:
          error.message,
      });
    }

    next();
  }
);

// =====================================================
// EXPORT
// =====================================================

module.exports = router;