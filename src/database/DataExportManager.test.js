const DataExportManager = require('./DataExportManager');
const fs = require('fs').promises;
const path = require('path');

describe('DataExportManager', () => {
  let dataExportManager;
  
  beforeEach(() => {
    dataExportManager = new DataExportManager();
  });
  
  afterEach(async () => {
    // Clean up any test files
    try {
      const exportDir = path.join(process.cwd(), 'exports');
      const files = await fs.readdir(exportDir);
      for (const file of files) {
        if (file.startsWith('vote_records_')) {
          await fs.unlink(path.join(exportDir, file));
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('ensureExportDirectory', () => {
    test('should create export directory if it does not exist', async () => {
      await dataExportManager.ensureExportDirectory();
      
      const exportDir = path.join(process.cwd(), 'exports');
      const stats = await fs.stat(exportDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('formatFileSize', () => {
    test('should format file sizes correctly', () => {
      expect(dataExportManager.formatFileSize(0)).toBe('0 B');
      expect(dataExportManager.formatFileSize(1024)).toBe('1 KB');
      expect(dataExportManager.formatFileSize(1048576)).toBe('1 MB');
      expect(dataExportManager.formatFileSize(1073741824)).toBe('1 GB');
    });
  });

  describe('getExportDirectoryStats', () => {
    test('should return directory stats', async () => {
      const stats = await dataExportManager.getExportDirectoryStats();
      
      expect(stats).toHaveProperty('success');
      expect(stats).toHaveProperty('directory');
      expect(stats).toHaveProperty('fileCount');
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('totalSizeFormatted');
      expect(stats).toHaveProperty('files');
      expect(Array.isArray(stats.files)).toBe(true);
    });
  });

  describe('cleanupExpiredFiles', () => {
    test('should return cleanup results', async () => {
      const result = await dataExportManager.cleanupExpiredFiles(24);
      
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('deletedCount');
      expect(result).toHaveProperty('totalSizeFreed');
      expect(result).toHaveProperty('deletedFiles');
      expect(result).toHaveProperty('cleanupTime');
      expect(Array.isArray(result.deletedFiles)).toBe(true);
    });
  });
});