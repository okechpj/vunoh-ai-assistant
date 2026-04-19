const express = require('express');
const router = express.Router();
const { signup, login, logout, me, updateProfile } = require('../controllers/authController');

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', me);
router.post('/update', updateProfile);

module.exports = router;
