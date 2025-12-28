const express = require("express");
const { asyncHandler } = require("../middleware/asyncHandler");
const {
  createThing,
  listMyPendingThings,
  updateThing,
  deleteThing
} = require("../controllers/thingController");

const router = express.Router();

router.post("/groups/:groupId/things", asyncHandler(createThing));
router.get("/groups/:groupId/my-things", asyncHandler(listMyPendingThings));
router.put("/things/:thingId", asyncHandler(updateThing));
router.delete("/things/:thingId", asyncHandler(deleteThing));

module.exports = router;

