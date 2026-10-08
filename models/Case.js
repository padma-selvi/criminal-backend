const mongoose = require("mongoose");

const caseSchema = new mongoose.Schema(
  {
    // =========================================
    // CASE INFORMATION
    // =========================================

    caseId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    criminalId: {
      type: String,
      required: true,
      trim: true,
    },

    crimeType: {
      type: String,
      required: true,
      trim: true,
    },

    crimeDate: {
      type: Date,
      required: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    policeStation: {
      type: String,
      required: true,
      trim: true,
    },

    investigatingOfficer: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["Active", "Pending", "Solved"],
      default: "Active",
    },

    // =========================================
    // CRIME LOCATION
    // =========================================

    location: {
      type: String,
      required: true,
      trim: true,
    },

    district: {
      type: String,
      default: "",
      trim: true,
    },

    latitude: {
      type: Number,
      required: true,
    },

    longitude: {
      type: Number,
      required: true,
    },

    // =========================================
    // MAIN CASE PHOTO
    // =========================================

    photo: {
      type: String,
      default: "",
    },

    // =========================================
    // VOICE
    // =========================================

    voice: {
      type: String,
      default: "",
    },

    // =========================================
    // EVIDENCE PHOTOS
    // =========================================

    evidencePhotos: [
      {
        type: String,
      },
    ],

    // =========================================
    // EVIDENCE VIDEOS
    // =========================================

    evidenceVideos: [
      {
        type: String,
      },
    ],

    // =========================================
    // DOCUMENTS
    // Existing support
    // =========================================

    documents: [
      {
        name: {
          type: String,
          required: true,
        },

        fileUrl: {
          type: String,
          required: true,
        },

        type: {
          type: String,
          enum: [
            "photo",
            "voice",
            "document",
            "video",
            "evidence-photo",
            "evidence-video",
          ],
           default: "document",
        },
      },
    ],
  },

  // =========================================
  // AUTOMATIC CREATED / UPDATED TIME
  // =========================================

  {
    timestamps: true,
  }
);

// =========================================
// EXPORT MODEL
// =========================================

module.exports = mongoose.model(
  "Case",
  caseSchema,
  "cases"
);