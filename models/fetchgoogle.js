require('dotenv').config({ path: '../.env' });
const axios = require('axios');
const mongoose = require('mongoose');
const Book = require('./book');
const Author = require('./author');

// Configuration
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  throw new Error("MONGO_URI is not defined in .env file");
}

const GENRES = [
  'Philosophical Fiction', 'Science Fiction', 'Fantasy', 'Mystery', 'Historical',
  'Thriller', 'Romance', 'Biography', 'Self-Help', 'Dystopian',
  'Horror', 'Adventure', 'Classic', 'Satire', 'Psychological Drama', 'Erotica'
];

const TOTAL_BOOKS_PER_GENRE = 200;
const BATCH_SIZE = 40;
const WIKIMEDIA_API = 'https://en.wikipedia.org/w/api.php';
const OPEN_LIBRARY_API = 'https://openlibrary.org/search/authors.json';
const DELAY_BETWEEN_REQUESTS = 200; // ms to avoid rate limiting

// Global cache to track processed authors
const processedAuthors = new Set();

// Utility function to delay execution
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch author image from Wikipedia
async function getWikipediaImage(authorName) {
  try {
    await delay(DELAY_BETWEEN_REQUESTS);
    const response = await axios.get(WIKIMEDIA_API, {
      params: {
        action: 'query',
        format: 'json',
        prop: 'pageimages',
        piprop: 'original',
        titles: authorName,
        formatversion: 2
      }
    });

    const pages = response.data.query?.pages;
    if (pages && pages[0]?.original) {
      return pages[0].original.source;
    }

    // Try with "_(author)" suffix
    await delay(DELAY_BETWEEN_REQUESTS);
    const suffixResponse = await axios.get(WIKIMEDIA_API, {
      params: {
        action: 'query',
        format: 'json',
        prop: 'pageimages',
        piprop: 'original',
        titles: `${authorName}_(author)`,
        formatversion: 2
      }
    });

    const suffixPages = suffixResponse.data.query?.pages;
    if (suffixPages && suffixPages[0]?.original) {
      return suffixPages[0].original.source;
    }

    return '';
  } catch (error) {
    console.log(`Wikipedia image search failed for ${authorName}:`, error.message);
    return '';
  }
}

// Fetch and create author document
async function getAuthorInfo(authorName) {
  try {
    const existingAuthor = await Author.findOne({ name: authorName });
    if (existingAuthor) {
      processedAuthors.add(authorName);
      return true;
    }

    if (processedAuthors.has(authorName)) {
      return true;
    }

    processedAuthors.add(authorName);

    const olResponse = await axios.get(OPEN_LIBRARY_API, {
      params: { q: authorName }
    });

    if (!olResponse.data.docs || olResponse.data.docs.length === 0) {
      return true;
    }

    const authorData = olResponse.data.docs[0];
    let imageUrl = await getWikipediaImage(authorName);

    if (!imageUrl && authorData.key) {
      imageUrl = `https://covers.openlibrary.org/a/olid/${authorData.key.replace('/a/', '')}-L.jpg`;
    }

    const authorDoc = {
      name: authorName,
      birth_date: authorData.birth_date || '',
      death_date: authorData.death_date || '',
      top_work: authorData.top_work || '',
      work_count: authorData.work_count || 0,
      bio: authorData.bio ? (Array.isArray(authorData.bio) ? authorData.bio[0] : authorData.bio) : '',
      website: '',
      rating: authorData.ratings_average ? 
             Math.min(5, Math.max(1, Math.round(authorData.ratings_average))) : null,
      image: imageUrl
    };

    const author = new Author(authorDoc);
    await author.save();
    console.log(`Added author: ${authorName} ${imageUrl ? 'with image ✅' : 'without image ❌'}`);

    return true;
  } catch (error) {
    console.error(`Error processing author ${authorName}:`, error.message);
    return true;
  }
}

// Process books for a single genre
async function fetchAndInsertBooksForGenre(genre) {
  try {
    console.log(`\nStarting to fetch books for genre: ${genre}`);

    let booksInserted = 0;
    let startIndex = 0;

    while (booksInserted < TOTAL_BOOKS_PER_GENRE) {
      const currentBatchSize = Math.min(BATCH_SIZE, TOTAL_BOOKS_PER_GENRE - booksInserted);
      const url = `https://www.googleapis.com/books/v1/volumes?q=subject:${encodeURIComponent(genre)}&startIndex=${startIndex}&maxResults=${currentBatchSize}`;

      console.log(`Fetching batch of ${currentBatchSize} books...`);
      const response = await axios.get(url);

      if (!response.data.items || response.data.items.length === 0) {
        console.log(`No more books found for genre: ${genre}`);
        break;
      }

      const bookPromises = response.data.items.map(async (book) => {
        const bookInfo = book.volumeInfo;
        const authors = bookInfo.authors || ['Unknown'];

        for (const authorName of authors) {
          await getAuthorInfo(authorName);
        }

        return {
          title: bookInfo.title || 'N/A',
          authors: authors,
          publishedDate: bookInfo.publishedDate || 'N/A',
          isbn: bookInfo.industryIdentifiers ? 
                bookInfo.industryIdentifiers.map(id => id.identifier) : [],
          description: bookInfo.description || 'No description available',
          previewLink: bookInfo.previewLink || 'N/A',
          coverImage: bookInfo.imageLinks?.thumbnail || '',
          genre: genre,
          rating: bookInfo.averageRating || null,
          reviewCount: bookInfo.ratingsCount || 0
        };
      });

      const formattedBooks = await Promise.all(bookPromises);

      try {
        await Book.insertMany(formattedBooks, { ordered: false });
        booksInserted += formattedBooks.length;
        startIndex += currentBatchSize;
        console.log(`[${genre}] Inserted ${formattedBooks.length} books (Total: ${booksInserted})`);
      } catch (insertError) {
        if (insertError.code === 11000) {
          console.log(`[${genre}] Skipped ${insertError.writeErrors?.length || 'some'} duplicate books`);
          booksInserted += (formattedBooks.length - (insertError.writeErrors?.length || 0));
        } else {
          throw insertError;
        }
      }
    }

    console.log(`Finished inserting ${booksInserted} books from the ${genre} genre`);
    return booksInserted;
  } catch (error) {
    console.error(`Error fetching books for genre ${genre}:`, error.message);
    return 0;
  }
}

// Main function to process all genres
async function fetchAllGenres() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    const results = {};
    for (const genre of GENRES) {
      results[genre] = await fetchAndInsertBooksForGenre(genre);
    }

    console.log('\nFinal Results:');
    console.table(results);

    const totalBooks = Object.values(results).reduce((sum, count) => sum + count, 0);
    console.log(`\nTotal books inserted: ${totalBooks}`);

  } catch (error) {
    console.error('Error in main process:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Start the process
fetchAllGenres();