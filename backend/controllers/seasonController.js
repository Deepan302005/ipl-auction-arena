const Player = require('../models/Player');

/**
 * @desc    Get all available IPL seasons (2008–2026) with player statistics summaries
 * @route   GET /api/seasons
 * @access  Public
 */
const getSeasons = async (req, res, next) => {
  try {
    const pipeline = [];

    // Exclude custom players unless explicitly requested
    if (req.query.includeCustom !== 'true') {
      pipeline.push({ $match: { isCustom: { $ne: true } } });
    }

    pipeline.push(
      { $unwind: '$seasonStats' },
      {
        $group: {
          _id: '$seasonStats.season',
          totalPlayers: { $sum: 1 },
          totalRuns: { $sum: '$seasonStats.runs' },
          totalWickets: { $sum: '$seasonStats.wickets' },
          totalHundreds: { $sum: '$seasonStats.hundreds' },
          totalFifties: { $sum: '$seasonStats.fifties' }
        }
      },
      {
        $project: {
          _id: 0,
          season: '$_id',
          totalPlayers: 1,
          totalRuns: 1,
          totalWickets: 1,
          totalHundreds: 1,
          totalFifties: 1
        }
      },
      { $sort: { season: -1 } }
    );

    const seasonsSummary = await Player.aggregate(pipeline);

    return res.status(200).json({
      success: true,
      count: seasonsSummary.length,
      data: seasonsSummary
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get players who played in a specific season with their season-specific statistics
 * @route   GET /api/seasons/:season/players
 * @access  Public
 */
const getPlayersBySeason = async (req, res, next) => {
  try {
    const seasonYear = parseInt(req.params.season, 10);
    const { role, country, search, page = 1, limit = 20, includeCustom = 'false' } = req.query;

    if (isNaN(seasonYear)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid season year'
      });
    }

    const filter = {
      'seasonStats.season': seasonYear
    };

    // Protect official season statistics from custom players unless requested
    if (includeCustom !== 'true') {
      filter.isCustom = { $ne: true };
    }

    if (role) filter.role = role;
    if (country) filter.country = country;
    if (search && search.trim()) filter.name = { $regex: search.trim(), $options: 'i' };

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [players, totalCount] = await Promise.all([
      Player.find(filter)
        .sort({ 'iplStats.runs': -1, 'iplStats.wickets': -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Player.countDocuments(filter)
    ]);

    // Attach extracted season statistics to each player for instant UI consumption
    const enrichedPlayers = players.map((p) => {
      const statsForSeason = p.seasonStats?.find((s) => s.season === seasonYear) || null;
      return {
        _id: p._id,
        name: p.name,
        role: p.role,
        country: p.country,
        nationality: p.nationality,
        basePriceCr: p.basePriceCr,
        category: p.category,
        season: seasonYear,
        seasonStat: statsForSeason,
        careerStats: p.iplStats
      };
    });

    const totalPages = Math.ceil(totalCount / limitNum) || 1;

    return res.status(200).json({
      success: true,
      season: seasonYear,
      count: enrichedPlayers.length,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages,
        totalCount,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      },
      data: enrichedPlayers
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Filter players across multiple seasons to build a custom or all-time auction pool
 * @route   POST /api/seasons/filter-pool
 * @access  Public
 */
const buildMultiSeasonPool = async (req, res, next) => {
  try {
    const {
      seasons,
      minMatches = 1,
      role,
      country,
      categories,
      includeCustom = false,
      includeRetired = true
    } = req.body;

    const filter = { isAuctionEligible: true };

    if (!includeCustom) {
      filter.isCustom = { $ne: true };
    }

    if (includeRetired === false) {
      filter.isRetired = false;
    }

    if (Array.isArray(seasons) && seasons.length > 0) {
      filter.seasonsPlayed = { $in: seasons.map((s) => parseInt(s, 10)) };
    }

    if (minMatches > 1) {
      filter['iplStats.matches'] = { $gte: minMatches };
    }

    if (role) filter.role = role;
    if (country) filter.country = country;
    if (Array.isArray(categories) && categories.length > 0) {
      filter.category = { $in: categories };
    }

    const pool = await Player.find(filter)
      .select('name role country basePriceCr category iplStats seasonsPlayed franchiseHistory isRetired isCustom isAuctionEligible')
      .sort({ basePriceCr: -1, 'iplStats.runs': -1, 'iplStats.wickets': -1 })
      .lean();

    return res.status(200).json({
      success: true,
      poolSize: pool.length,
      filtersApplied: { seasons, minMatches, role, country, categories, includeCustom, includeRetired },
      data: pool
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSeasons,
  getPlayersBySeason,
  buildMultiSeasonPool
};
