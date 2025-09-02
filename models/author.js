const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' }); // Load environment variables from .env

// Use the MongoDB URI from environment variable or fallback to localhost
const mongoURI = process.env.MONGO_URI;

const authorSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  birth_date: String,
  death_date: String,
  top_work: String,
  work_count: { 
    type: Number, 
    default: 0 
  },
  bio: String,
  subjects: [String], // Similar to 'categories' in Book
  website: String,    // Similar to 'previewLink' in Book
  rating: { 
    type: Number, 
    min: 1, 
    max: 5 
  },
  reviewCount: { 
    type: Number, 
    default: 0 
  },
  image: { 
    type: String, 
    default: '' // URL of the author's image
  },
  reviews: [ // New field to store reviews
    {
      rating: { type: Number, min: 1, max: 5 }, // Rating between 1 and 5
      reviewText: { type: String, required: true }, // Review text
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional: If you want to track the user who wrote the review
      createdAt: { type: Date, default: Date.now } // Timestamp of when the review was created
    }
  ]
}, { 
  timestamps: true // Adds createdAt/updatedAt fields (optional)
});

// Create a text index for name and top_work for better search functionality
authorSchema.index({ name: 'text', top_work: 'text' });

// Create the Author model using the schema
const Author = mongoose.model('Author', authorSchema);

// Export the Author model
module.exports = Author;
