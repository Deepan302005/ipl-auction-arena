const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const Player = require('../models/Player');

/**
 * Validates and imports historical player records from a JSON file using bulkWrite with upsert
 * @param {string} jsonFilePath - Path to JSON file
 */
const importPlayers = async (jsonFilePath) => {
  try {
    const historicalPath = path.join(__dirname, '../data/historical_players.json');
    const fallbackPath = path.join(__dirname, '../data/players.json');
    const targetFile = jsonFilePath || (fs.existsSync(historicalPath) ? historicalPath : fallbackPath);

    if (!fs.existsSync(targetFile)) {
      throw new Error(`Player data file not found at: ${targetFile}`);
    }

    console.log(`📖 Reading player dataset from: ${targetFile}`);
    const fileContent = fs.readFileSync(targetFile, 'utf8');
    const playersData = JSON.parse(fileContent);

    if (!Array.isArray(playersData) || playersData.length === 0) {
      throw new Error('Player dataset must be a non-empty array of player records');
    }

    console.log(`Connecting to MongoDB Atlas...`);
    await connectDB();

    // 1. Purge confirmed corrupted franchise-as-player records (Task 3)
    const KNOWN_FRANCHISE_NAMES = [
      'Chennai Super Kings', 'Sunrisers Hyderabad', 'Rajasthan Royals', 'Mumbai Indians',
      'Kolkata Knight Riders', 'Punjab Kings', 'Delhi Capitals', 'Gujarat Titans',
      'Lucknow Super Giants', 'Royal Challengers Bangalore', 'Kings XI Punjab',
      'Royal Challengers Bengaluru', 'Deccan Chargers', 'Delhi Daredevils', 'Pune Warriors',
      'Gujarat Lions', 'Rising Pune Supergiant', 'Rising Pune Supergiants', 'Kochi Tuskers Kerala'
    ];
    await Player.deleteMany({ name: { $in: KNOWN_FRANCHISE_NAMES } });

    // 2. Remove obsolete abbreviated records for the 9 starter pairs and collision artifacts (Task 4)
    const OBSOLETE_ABBREVIATIONS = [
      'PJ Cummins', 'SM Curran', 'MP Stoinis', 'N Pooran', 'PD Salt',
      'M Pathirana', 'M Theekshana', 'AR Patel', 'Rupesh Kumar Singh'
    ];
    await Player.deleteMany({ name: { $in: OBSOLETE_ABBREVIATIONS } });

    // 3. Keep database strictly clean: remove non-custom records not in canonical archive
    const canonicalNames = playersData.map((p) => p.name);
    await Player.deleteMany({
      name: { $nin: canonicalNames },
      isCustom: { $ne: true }
    });

    console.log(`Validating ${playersData.length} player records against Mongoose Player schema...`);
    const validOperations = [];
    let invalidCount = 0;

    for (let i = 0; i < playersData.length; i++) {
      const p = playersData[i];

      // Clean name
      p.name = p.name ? p.name.trim() : `Player ${i}`;

      // Validate against Mongoose schema
      const doc = new Player(p);
      const validationError = doc.validateSync();
      if (validationError) {
        console.warn(`⚠️ Validation failed for player "${p.name}": ${validationError.message}`);
        invalidCount++;
        continue;
      }

      // Add upsert operation (idempotent matching by name)
      validOperations.push({
        updateOne: {
          filter: { name: p.name },
          update: { $set: p },
          upsert: true
        }
      });
    }

    if (validOperations.length === 0) {
      throw new Error('No valid player records passed validation');
    }

    console.log(`🚀 Executing chunked bulkWrite for ${validOperations.length} validated player records (Batches of 200)...`);
    const CHUNK_SIZE = 200;
    let totalMatched = 0;
    let totalUpserted = 0;
    let totalModified = 0;

    for (let i = 0; i < validOperations.length; i += CHUNK_SIZE) {
      const chunk = validOperations.slice(i, i + CHUNK_SIZE);
      const result = await Player.bulkWrite(chunk);
      totalMatched += result.matchedCount || 0;
      totalUpserted += result.upsertedCount || 0;
      totalModified += result.modifiedCount || 0;
      console.log(`   Batch ${Math.floor(i / CHUNK_SIZE) + 1} processed (${chunk.length} items)...`);
    }

    console.log(`\n✅ Player bulkWrite completed: Matched: ${totalMatched}, Upserted: ${totalUpserted}, Modified: ${totalModified}`);

    const totalCount = await Player.countDocuments();
    console.log(`📊 Total players now in database: ${totalCount}`);

    return {
      success: true,
      totalImported: validOperations.length,
      invalidCount,
      totalInDatabase: totalCount
    };
  } catch (error) {
    console.error('❌ Error importing players:', error.message);
    throw error;
  }
};

// Allow direct CLI execution
if (require.main === module) {
  importPlayers()
    .then(() => {
      console.log('Player data import completed successfully.');
      process.exit(0);
    })
    .catch(() => process.exit(1));
}

module.exports = { importPlayers };
