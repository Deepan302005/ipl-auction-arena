const mongoose = require('mongoose');
const Team = require('../models/Team');

/**
 * @desc    Get all 10 IPL franchises
 * @route   GET /api/teams
 * @access  Public
 */
const getTeams = async (req, res, next) => {
  try {
    const teams = await Team.find({ isActive: true }).sort({ trophies: -1, name: 1 });
    return res.status(200).json({
      success: true,
      count: teams.length,
      data: teams
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single franchise by ID, Code (e.g. CSK) or FranchiseId (e.g. csk)
 * @route   GET /api/teams/:id
 * @access  Public
 */
const getTeamById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let team = null;

    // Search by ObjectId if valid
    if (mongoose.Types.ObjectId.isValid(id)) {
      team = await Team.findById(id);
    }

    // Search by franchise code or franchiseId
    if (!team) {
      team = await Team.findOne({
        $or: [
          { code: id.toUpperCase() },
          { franchiseId: id.toLowerCase() }
        ]
      });
    }

    if (!team) {
      return res.status(404).json({
        success: false,
        message: `Franchise with identifier '${id}' not found`
      });
    }

    return res.status(200).json({
      success: true,
      data: team
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTeams,
  getTeamById
};
