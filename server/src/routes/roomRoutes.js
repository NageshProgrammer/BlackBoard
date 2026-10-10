const express = require('express');
const router = express.Router();
const { createRoom, getRoom, listRooms, exportRoom } = require('../controllers/roomController');
const { optionalAuth } = require('../middleware/auth');

router.route('/')
  .post(optionalAuth, createRoom)
  .get(listRooms);

router.route('/:id')
  .get(getRoom);

router.route('/:id/export')
  .post(exportRoom)
  .get(exportRoom);

module.exports = router;
