
const mongoose = require("mongoose");

const criminalSchema = new mongoose.Schema(
  {
    criminalId: {
      type: String,
      required: true,
      unique: true,
    },

    name: {
      type: String,
      required: true,
    },

    age: {
      type: Number,
      required: true,
    },

    gender: {
      type: String,
      required: true,
    },

    crime: {
      type: String,
      required: true,
    },

    firNumber: {
      type: String,
      required: true,
    },

    address: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      default: "",
    },

    // 📷 CRIMINAL PHOTO
    image: {
      type: String,
      default: "",
    },

    // 🎤 CRIMINAL VOICE
    voice: {
      type: String,
      default: "",
    },
  },

  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Criminal",
  criminalSchema,
  "criminals"
);

