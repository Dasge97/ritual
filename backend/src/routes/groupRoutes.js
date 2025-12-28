const express = require("express");
const { asyncHandler } = require("../middleware/asyncHandler");
const {
  listGroups,
  createGroup,
  acceptInvite,
  getGroup,
  inviteToGroup,
  groupHistory
} = require("../controllers/groupController");

const router = express.Router();

router.get("/", asyncHandler(listGroups));
router.post("/", asyncHandler(createGroup));
router.post("/invites/accept", asyncHandler(acceptInvite));
router.get("/:groupId", asyncHandler(getGroup));
router.post("/:groupId/invite", asyncHandler(inviteToGroup));
router.get("/:groupId/history", asyncHandler(groupHistory));

module.exports = router;
