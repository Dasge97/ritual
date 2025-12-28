const express = require("express");
const { asyncHandler } = require("../middleware/asyncHandler");
const {
  startVote,
  castVote,
  ritualState,
  ritualStream,
  ritualCurrent,
  tellCurrent,
  pauseRitual,
  resumeRitual
} = require("../controllers/ritualController");

const router = express.Router();

router.post("/groups/:groupId/rituals/start-vote", asyncHandler(startVote));
router.post("/groups/:groupId/rituals/vote", asyncHandler(castVote));
router.get("/groups/:groupId/rituals/state", asyncHandler(ritualState));
router.get("/groups/:groupId/rituals/stream", asyncHandler(ritualStream));
router.get("/groups/:groupId/rituals/current", asyncHandler(ritualCurrent));
router.post("/groups/:groupId/rituals/tell-current", asyncHandler(tellCurrent));
router.post("/groups/:groupId/rituals/pause", asyncHandler(pauseRitual));
router.post("/groups/:groupId/rituals/resume", asyncHandler(resumeRitual));

module.exports = router;
