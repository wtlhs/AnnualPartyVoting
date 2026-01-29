const express = require('express');
const path = require('path');
const { requireAdmin } = require('../middleware/adminAuth');
const router = express.Router();

// Serve static HTML pages
const publicPath = path.join(__dirname, '../../public');

// Home page / Registration page
router.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Profile page
router.get('/profile/:userId', (req, res) => {
  res.sendFile(path.join(publicPath, 'profile.html'));
});

// Scan QR code page
router.get('/scan', (req, res) => {
  res.sendFile(path.join(publicPath, 'scan.html'));
});

// User list page
router.get('/user-list', (req, res) => {
  res.sendFile(path.join(publicPath, 'user-list.html'));
});

// Vote confirmation page
router.get('/vote/:userId', (req, res) => {
  res.sendFile(path.join(publicPath, 'vote.html'));
});

// Admin page
router.get('/admin', (req, res) => {
  res.sendFile(path.join(publicPath, 'admin.html'));
});

// Vote records management page (protected)
router.get('/vote-records', requireAdmin, (req, res) => {
  res.sendFile(path.join(publicPath, 'vote-records.html'));
});

// Computer display ranking page
router.get('/ranking-display', (req, res) => {
  res.sendFile(path.join(publicPath, 'ranking-display.html'));
});

// Mobile statistics page
router.get('/mobile-stats', (req, res) => {
  res.sendFile(path.join(publicPath, 'mobile-stats.html'));
});

// HTTPS protocol test page
router.get('/test-https-protocol', (req, res) => {
  res.sendFile(path.join(publicPath, 'test-https-protocol.html'));
});

module.exports = router;