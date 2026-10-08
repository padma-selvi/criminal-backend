const mongoose = require("mongoose");

const voiceRecordSchema = new mongoose.Schema(
  {
    voiceId: {
      type: String,
      unique: true,
      sparse: true,
    },

    criminalId: {
      type: String,
      default: "",
    },

    name: {
      type: String,
      default: "",
    },

    audio: {
      type: String,
      required: true,
    },

    originalName: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "VoiceRecord",
  voiceRecordSchema,
  "voice_records"
);