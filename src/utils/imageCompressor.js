/**
 * 图片压缩工具
 * 使用 sharp 库对上传的头像进行压缩和优化
 */

const sharp = require('sharp');

/**
 * 压缩用户头像
 * @param {Buffer} imageBuffer - 原始图片数据
 * @param {Object} options - 压缩选项
 * @returns {Promise<Buffer>} 压缩后的图片数据
 */
async function compressAvatar(imageBuffer, options = {}) {
  const {
    width = 400,           // 目标宽度（提高分辨率以支持大图查看）
    height = 400,          // 目标高度（提高分辨率以支持大图查看）
    quality = 95,          // JPEG 质量 (1-100) - 提高质量确保清晰度
    format = 'jpeg'         // 输出格式
  } = options;

  try {
    // 获取原始图片信息
    const metadata = await sharp(imageBuffer).metadata();
    const originalSize = imageBuffer.length;

    // 如果图片已经很小（< 50KB）且分辨率不高于目标尺寸，不需要压缩
    if (originalSize < 50 * 1024 && metadata.width <= width && metadata.height <= height) {
      console.log(`[Image Compress] Image small enough (${(originalSize / 1024).toFixed(1)}KB), skipping compression`);
      return imageBuffer;
    }

    // 执行压缩
    let pipeline = sharp(imageBuffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      });

    // 根据原格式选择输出格式
    const isPng = metadata.format === 'png';
    const targetFormat = isPng ? 'png' : format;

    if (targetFormat === 'jpeg') {
      pipeline = pipeline.jpeg({ quality, progressive: true, mozjpeg: true });
    } else {
      // PNG 使用压缩
      pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true, palette: true });
    }

    const compressedBuffer = await pipeline.toBuffer();

    const compressedSize = compressedBuffer.length;
    const savings = originalSize - compressedSize;
    const savingsPercent = ((savings / originalSize) * 100).toFixed(1);

    console.log(`[Image Compress] ${metadata.format.toUpperCase()} → ${targetFormat.toUpperCase()}`);
    console.log(`   Original: ${(originalSize / 1024).toFixed(1)}KB`);
    console.log(`   Compressed: ${(compressedSize / 1024).toFixed(1)}KB`);
    console.log(`   Saved: ${savingsPercent}% (${(savings / 1024).toFixed(1)}KB)`);

    // 如果压缩后反而更大，返回原图
    if (compressedSize >= originalSize) {
      console.log(`[Image Compress] Compressed size larger, using original`);
      return imageBuffer;
    }

    return compressedBuffer;
  } catch (error) {
    console.error('[Image Compress] Compression failed:', error);
    // 压缩失败时返回原图
    return imageBuffer;
  }
}

/**
 * 创建压缩后的文件名
 * @param {string} originalFilename - 原始文件名
 * @param {string} format - 输出格式
 * @returns {string} 压缩后的文件名
 */
function createCompressedFilename(originalFilename, format = 'jpg') {
  const basename = originalFilename.replace(/\.[^/.]+$/, '');
  const timestamp = Date.now();
  const random = Math.round(Math.random() * 1000);
  return `${basename}-${timestamp}-${random}.${format}`;
}

/**
 * 检查文件是否为图片
 * @param {string} filename - 文件名
 * @returns {boolean} 是否为图片
 */
function isImageFile(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
}

module.exports = {
  compressAvatar,
  createCompressedFilename,
  isImageFile
};
