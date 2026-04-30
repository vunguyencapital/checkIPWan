const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
require('./helpers/BackgroundTaskHelper');

const app = express();

// Allow cross-origin requests
app.use(cors());

// Configure the storage and upload destination using multer
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage
});

// File upload route
app.post('/upload', upload.single('file'), (req, res) => {
  res.json({ message: 'File uploaded successfully.' });
});

app.get('/', (req, res) => {
    return res.status(200).send('Hello World! checking cicd')
});

const PORT = 13000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
