const mongoose = require('mongoose');
const Player = require('../models/Player');

/**
 * @desc    Get players with pagination, filtering & search
 * @route   GET /api/players
 * @access  Public
 */
const getPlayers = async (req, res, next) => {
  try {
    const { role, country, category, search, isRetired, isCustom, isAuctionEligible } = req.query;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = {};

    if (role) filter.role = role;
    if (country) filter.country = country;
    if (category) filter.category = category;
    if (isRetired !== undefined) filter.isRetired = isRetired === 'true';
    if (isCustom !== undefined) filter.isCustom = isCustom === 'true';
    if (isAuctionEligible !== undefined) filter.isAuctionEligible = isAuctionEligible === 'true';

    if (search && search.trim()) {
      filter.name = { $regex: search.trim(), $options: 'i' };
    }

    const [players, totalCount] = await Promise.all([
      Player.find(filter)
        .sort({ basePriceCr: -1, 'iplStats.runs': -1, name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Player.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalCount / limit) || 1;

    return res.status(200).json({
      success: true,
      count: players.length,
      pagination: {
        page,
        limit,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      data: players
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single player by ID
 * @route   GET /api/players/:id
 * @access  Public
 */
const getPlayerById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid player ID format: '${id}'`
      });
    }

    const player = await Player.findById(id);

    if (!player) {
      return res.status(404).json({
        success: false,
        message: `Player with ID '${id}' not found`
      });
    }

    return res.status(200).json({
      success: true,
      data: player
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all distinct player auction categories
 * @route   GET /api/players/categories
 * @access  Public
 */
const getPlayerCategories = async (req, res, next) => {
  try {
    const categories = await Player.distinct('category');
    return res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add a custom player
 * @route   POST /api/players
 * @access  Public (or Protected)
 */
const createCustomPlayer = async (req, res, next) => {
  try {
    const {
      name,
      role = 'All-Rounder',
      country = 'India',
      nationality = 'India',
      battingStyle = 'Right-hand bat',
      bowlingStyle = 'Right-arm medium',
      basePriceCr = 2.0,
      category = 'Custom Set',
      image = '',
      iplStats = {}
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Player name is required'
      });
    }

    const existing = await Player.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Player '${name.trim()}' already exists in database`
      });
    }

    const player = await Player.create({
      name: name.trim(),
      role,
      country,
      nationality,
      battingStyle,
      bowlingStyle,
      basePriceCr: parseFloat(basePriceCr) || 2.0,
      category,
      image,
      iplStats: {
        matches: iplStats.matches || 0,
        runs: iplStats.runs || 0,
        wickets: iplStats.wickets || 0,
        strikeRate: iplStats.strikeRate || 0,
        economy: iplStats.economy || 0,
        fifties: iplStats.fifties || 0,
        hundreds: iplStats.hundreds || 0,
        highestScore: iplStats.highestScore || 0,
        bestBowling: iplStats.bestBowling || '0/0'
      },
      isCustom: true,
      isAuctionEligible: true,
      dataSource: 'Custom User Player'
    });

    return res.status(201).json({
      success: true,
      message: `Custom player '${player.name}' created successfully`,
      data: player
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Edit player details
 * @route   PUT /api/players/:id
 * @access  Public (or Protected)
 */
const updatePlayer = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid player ID' });
    }

    const player = await Player.findById(id);
    if (!player) {
      return res.status(404).json({ success: false, message: 'Player not found' });
    }

    const allowedFields = [
      'name', 'role', 'country', 'nationality', 'battingStyle',
      'bowlingStyle', 'basePriceCr', 'category', 'image',
      'isRetired', 'isAuctionEligible', 'isCapped'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        player[field] = req.body[field];
      }
    }

    player.lastUpdated = new Date();
    await player.save();

    return res.status(200).json({
      success: true,
      message: `Player '${player.name}' updated successfully`,
      data: player
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete player
 * @route   DELETE /api/players/:id
 * @access  Public (or Protected)
 */
const deletePlayer = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid player ID' });
    }

    const player = await Player.findByIdAndDelete(id);
    if (!player) {
      return res.status(404).json({ success: false, message: 'Player not found' });
    }

    return res.status(200).json({
      success: true,
      message: `Player '${player.name}' deleted successfully`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update player base price independently
 * @route   PATCH /api/players/:id/base-price
 * @access  Public
 */
const updateBasePrice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { basePriceCr } = req.body;

    if (basePriceCr === undefined || isNaN(basePriceCr) || parseFloat(basePriceCr) < 0.20) {
      return res.status(400).json({
        success: false,
        message: 'Base price must be a number of at least 0.20 Cr (20 Lakhs)'
      });
    }

    const player = await Player.findByIdAndUpdate(
      id,
      { $set: { basePriceCr: parseFloat(basePriceCr), lastUpdated: new Date() } },
      { new: true }
    );

    if (!player) {
      return res.status(404).json({ success: false, message: 'Player not found' });
    }

    return res.status(200).json({
      success: true,
      message: `Base price for ${player.name} updated to ₹${player.basePriceCr} Cr`,
      data: player
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark player as retired / active
 * @route   PATCH /api/players/:id/retire
 * @access  Public
 */
const toggleRetirePlayer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isRetired } = req.body;

    const player = await Player.findById(id);
    if (!player) {
      return res.status(404).json({ success: false, message: 'Player not found' });
    }

    player.isRetired = isRetired !== undefined ? !!isRetired : !player.isRetired;
    player.lastUpdated = new Date();
    await player.save();

    return res.status(200).json({
      success: true,
      message: `Player '${player.name}' marked as ${player.isRetired ? 'Retired' : 'Active'}`,
      data: player
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Include or exclude player from auction pool
 * @route   PATCH /api/players/:id/eligibility
 * @access  Public
 */
const toggleAuctionEligibility = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isAuctionEligible } = req.body;

    const player = await Player.findById(id);
    if (!player) {
      return res.status(404).json({ success: false, message: 'Player not found' });
    }

    player.isAuctionEligible = isAuctionEligible !== undefined ? !!isAuctionEligible : !player.isAuctionEligible;
    player.lastUpdated = new Date();
    await player.save();

    return res.status(200).json({
      success: true,
      message: `Player '${player.name}' auction status: ${player.isAuctionEligible ? 'Eligible' : 'Excluded'}`,
      data: player
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Export player records as JSON
 * @route   GET /api/players/export/json
 * @access  Public
 */
const exportPlayersJson = async (req, res, next) => {
  try {
    const { category, role, country } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (role) filter.role = role;
    if (country) filter.country = country;

    const players = await Player.find(filter).lean();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="ipl_players_export.json"');
    return res.status(200).send(JSON.stringify(players, null, 2));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Export player records as CSV
 * @route   GET /api/players/export/csv
 * @access  Public
 */
const exportPlayersCsv = async (req, res, next) => {
  try {
    const players = await Player.find({}).lean();

    const headers = [
      'name', 'role', 'country', 'nationality', 'battingStyle',
      'bowlingStyle', 'basePriceCr', 'category', 'iplDebutYear',
      'matches', 'runs', 'wickets', 'strikeRate', 'economy', 'isRetired'
    ];

    const csvRows = [headers.join(',')];

    for (const p of players) {
      const row = [
        `"${p.name || ''}"`,
        `"${p.role || ''}"`,
        `"${p.country || ''}"`,
        `"${p.nationality || ''}"`,
        `"${p.battingStyle || ''}"`,
        `"${p.bowlingStyle || ''}"`,
        p.basePriceCr || 2.0,
        `"${p.category || ''}"`,
        p.iplDebutYear || 2008,
        p.iplStats?.matches || 0,
        p.iplStats?.runs || 0,
        p.iplStats?.wickets || 0,
        p.iplStats?.strikeRate || 0,
        p.iplStats?.economy || 0,
        p.isRetired ? 'true' : 'false'
      ];
      csvRows.push(row.join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="ipl_players_export.csv"');
    return res.status(200).send(csvRows.join('\n'));
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Import player records using JSON payload
 * @route   POST /api/players/import/json
 * @access  Public
 */
const importPlayersJson = async (req, res, next) => {
  try {
    const playersData = req.body;

    if (!Array.isArray(playersData) || playersData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Body must be a non-empty array of player records'
      });
    }

    const bulkOps = [];
    let validCount = 0;

    for (const p of playersData) {
      if (!p.name || !p.name.trim()) continue;
      validCount++;
      bulkOps.push({
        updateOne: {
          filter: { name: p.name.trim() },
          update: { $set: p },
          upsert: true
        }
      });
    }

    if (bulkOps.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid player records found in payload'
      });
    }

    const result = await Player.bulkWrite(bulkOps);

    return res.status(200).json({
      success: true,
      message: `Successfully processed ${validCount} player records`,
      matched: result.matchedCount,
      upserted: result.upsertedCount,
      modified: result.modifiedCount
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Import player records using CSV text payload
 * @route   POST /api/players/import/csv
 * @access  Public
 */
const importPlayersCsv = async (req, res, next) => {
  try {
    const csvContent = typeof req.body === 'string' ? req.body : req.body?.csv;

    if (!csvContent || typeof csvContent !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Please provide CSV content as a string in the body or { csv: "..." }'
      });
    }

    const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'CSV must contain at least a header and one data row'
      });
    }

    const header = lines[0].split(',').map((h) => h.replace(/"/g, '').trim());
    const bulkOps = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.replace(/"/g, '').trim());
      const playerObj = {};

      header.forEach((h, idx) => {
        if (values[idx] !== undefined) {
          playerObj[h] = values[idx];
        }
      });

      if (!playerObj.name) continue;

      playerObj.basePriceCr = parseFloat(playerObj.basePriceCr) || 2.0;

      bulkOps.push({
        updateOne: {
          filter: { name: playerObj.name },
          update: { $set: playerObj },
          upsert: true
        }
      });
    }

    const result = await Player.bulkWrite(bulkOps);

    return res.status(200).json({
      success: true,
      message: `CSV import completed: ${bulkOps.length} records processed`,
      matched: result.matchedCount,
      upserted: result.upsertedCount
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPlayers,
  getPlayerById,
  getPlayerCategories,
  createCustomPlayer,
  updatePlayer,
  deletePlayer,
  updateBasePrice,
  toggleRetirePlayer,
  toggleAuctionEligibility,
  exportPlayersJson,
  exportPlayersCsv,
  importPlayersJson,
  importPlayersCsv
};
