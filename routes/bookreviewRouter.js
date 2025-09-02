const express = require('express');
const Book = require('../models/book');
const { protect } = require('../middleware/auth'); // Assuming you have auth middleware to protect the route
const router = express.Router();

// @desc    Add a review and rating for a book
// @route   POST /api/books/review/:id
// @access  Private (must be logged in)
router.post('/:id', protect, async (req, res) => {
  try {
    const { reviewText, rating } = req.body;

    // Check if the rating is valid
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Find the book by its ID
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Add the review to the book
    const newReview = {
      userId: req.user._id, // Assuming the user is authenticated
      reviewText,
      rating,
      date: Date.now()
    };

    book.reviews.push(newReview);  // Add the new review to the reviews array
    book.reviewCount += 1;  // Increment the review count

    // Recalculate the average rating
    const totalRatings = book.reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRatings / book.reviews.length;
    book.averageRating = averageRating;

    // Save the updated book document
    await book.save();

    res.status(200).json({
      message: 'Review and rating added successfully',
      book
    });
  } catch (err) {
    res.status(500).json({
      message: 'Error adding review and rating',
      error: err.message
    });
  }
});

module.exports = router;
