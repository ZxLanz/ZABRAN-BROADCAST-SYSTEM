import multer from "multer";

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
  fileFilter(req, file, cb) {
    const allowed = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Format file tidak didukung!"), false);
    }

    cb(null, true);
  },
});
