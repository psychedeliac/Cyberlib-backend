const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const app = express();

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/userRoutes');
const bookRoutes = require('./routes/bookRoutes');
const profileRoutes = require('./routes/profileRoutes');
const popularBooksRoutes = require('./routes/popularbookRoutes');
const userBooksRoutes = require('./routes/userbookRoutes');
const popularAuthorsRoutes = require('./routes/popularAuthorsRoutes');
const bookDetailRoutes = require('./routes/bookdetailRouter');
const bookReviewRouter = require('./routes/bookreviewRouter');
const chatbotRoutes = require('./routes/chatbotRoutes');
const chatRoutes = require('./routes/chatRoutes');
const authorRoutes = require('./routes/authorRoutes');

// Ensure the uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// ✅ Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB error:', err));
app.use(cors());
app.use(express.json()); // replaces body-parser.json()
// Serve static files from the 'uploads' folder
app.use('/uploads', express.static(uploadsDir));

// Register Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/popular-books', popularBooksRoutes);
app.use('/api/user/books', userBooksRoutes);
app.use('/api/popular-authors', popularAuthorsRoutes);
app.use('/api/books', bookDetailRoutes);
app.use('/api/books/review', bookReviewRouter);  
app.use('/api', chatbotRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/authors', authorRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// ✅ Use PORT from .env or default to 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));