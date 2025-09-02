const express = require('express');
const router = express.Router();
const authorController = require('../controllers/authorController');

// Route to get author details
router.get('/author/:id', (req, res, next) => {
  console.log('GET /author/:id hit with', req.params.id);
  next();
}, authorController.getAuthorDetails);
    

// Route to rate an author
router.post('/author/:id/rate', authorController.rateAuthor);

// Route to write a review for an author
router.post('/author/:id/review', authorController.writeReview);

// Optional: Route to get all reviews for an author
router.get('/author/:id/reviews', authorController.getAllReviews);

module.exports = router;
