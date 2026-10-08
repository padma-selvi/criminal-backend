const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadPath = path.join(__dirname, "..", "uploads");

// uploads folder illana create pannum
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadPath);
    },

    filename: (req, file, cb) => {
        const fileName =
            Date.now() + path.extname(file.originalname);

        cb(null, fileName);
    },
});

const upload = multer({ storage });

module.exports = upload;