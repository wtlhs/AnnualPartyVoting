"use strict";
/**
 * QR Code Generation Demo
 * Demonstrates the enhanced QR code functionality for voting URLs
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.demonstrateQRCodeGeneration = demonstrateQRCodeGeneration;
exports.getWeChatOptimizationTips = getWeChatOptimizationTips;
exports.getPrintOptimizationTips = getPrintOptimizationTips;
const qr_code_url_generator_1 = require("../utils/qr-code-url-generator");
/**
 * Demo function showing various QR code generation options
 */
async function demonstrateQRCodeGeneration() {
    // Create a QR code generator instance
    const generator = (0, qr_code_url_generator_1.createQRCodeURLGenerator)('https://voting.example.com');
    // Sample candidate information
    const candidate = {
        id: 'candidate-001',
        name: '张三',
        category: '最佳员工'
    };
    console.log('=== QR Code Generation Demo ===\n');
    try {
        // 1. Basic QR code generation
        console.log('1. Basic QR code generation:');
        const basicQR = await generator.generateQRCode(generator.generateVotingURL(candidate));
        console.log(`- Format: ${basicQR.format}`);
        console.log(`- Size: ${basicQR.size}px`);
        console.log(`- URL: ${basicQR.url}`);
        console.log(`- Image data length: ${basicQR.imageData.length} characters\n`);
        // 2. WeChat optimized QR code
        console.log('2. WeChat optimized QR code:');
        const wechatQR = await qr_code_url_generator_1.QRCodeHelpers.generateForWeChat(generator, candidate);
        console.log(`- Format: ${wechatQR.format}`);
        console.log(`- Size: ${wechatQR.size}px`);
        console.log(`- Optimized for mobile scanning with high error correction\n`);
        // 3. Print optimized QR code
        console.log('3. Print optimized QR code:');
        const printQR = await qr_code_url_generator_1.QRCodeHelpers.generateForPrint(generator, candidate);
        console.log(`- Format: ${printQR.format}`);
        console.log(`- Size: ${printQR.size}px`);
        console.log(`- High resolution for printing\n`);
        // 4. Custom QR code with specific options
        console.log('4. Custom QR code with specific options:');
        const customOptions = {
            format: 'png',
            size: 300,
            margin: 3,
            errorCorrection: 'H',
            darkColor: '#1a1a1a',
            lightColor: '#f5f5f5',
            quality: 0.95
        };
        const customQR = await generator.generateQRCode(generator.generateVotingURL(candidate), customOptions);
        console.log(`- Format: ${customQR.format}`);
        console.log(`- Size: ${customQR.size}px`);
        console.log(`- Custom colors and high quality\n`);
        // 5. Multiple formats generation
        console.log('5. Multiple formats generation:');
        const multipleFormats = await qr_code_url_generator_1.QRCodeHelpers.generateMultipleFormats(generator, candidate, ['wechat', 'web', 'small']);
        multipleFormats.forEach((qr) => {
            console.log(`- ${qr.preset}: ${qr.size}px, ${qr.format}`);
        });
        console.log();
        // 6. SVG format generation
        console.log('6. SVG format generation:');
        const svgQR = await generator.generateQRCodeBuffer(generator.generateVotingURL(candidate), {
            format: 'svg',
            size: 256
        });
        console.log(`- Format: ${svgQR.format}`);
        console.log(`- MIME type: ${svgQR.mimeType}`);
        console.log(`- Buffer size: ${svgQR.buffer.length} bytes`);
        console.log(`- Scalable vector format for web use\n`);
        // 7. Options validation
        console.log('7. Options validation:');
        const validOptions = {
            size: 256,
            margin: 2,
            quality: 0.9,
            darkColor: '#000000',
            lightColor: '#FFFFFF'
        };
        const validationResult = qr_code_url_generator_1.QRCodeHelpers.validateOptions(validOptions);
        console.log(`- Valid options: ${validationResult.isValid}`);
        console.log(`- Errors: ${validationResult.errors.length}\n`);
        // 8. Invalid options validation
        console.log('8. Invalid options validation:');
        const invalidOptions = {
            size: 32, // Too small
            margin: -1, // Negative
            quality: 1.5, // Too high
            darkColor: 'invalid-color'
        };
        const invalidValidation = qr_code_url_generator_1.QRCodeHelpers.validateOptions(invalidOptions);
        console.log(`- Valid options: ${invalidValidation.isValid}`);
        console.log(`- Errors: ${invalidValidation.errors.join(', ')}\n`);
        console.log('=== Demo completed successfully! ===');
    }
    catch (error) {
        console.error('Demo failed:', error);
    }
}
/**
 * WeChat scanning optimization tips
 */
function getWeChatOptimizationTips() {
    return [
        '使用高错误纠正级别 (H) 提高扫码成功率',
        '保持适当的边距 (2-4 modules) 确保识别',
        '推荐尺寸 256px 适合手机屏幕显示',
        '使用高对比度颜色 (黑白) 提高识别度',
        '避免过小的二维码 (小于 128px)',
        '确保二维码周围有足够的空白区域',
        '测试不同光线条件下的扫码效果'
    ];
}
/**
 * Print optimization tips
 */
function getPrintOptimizationTips() {
    return [
        '使用高分辨率 (512px 或更高) 确保打印清晰',
        '设置较大的边距 (4+ modules) 适应打印机精度',
        '使用最高质量设置 (quality: 1.0)',
        '选择纯黑白颜色避免打印机色彩偏差',
        '测试不同纸张类型的打印效果',
        '考虑二维码在页面中的位置和大小',
        '预留足够的空白边距防止裁切'
    ];
}
// Export demo function for use in other files
exports.default = demonstrateQRCodeGeneration;
//# sourceMappingURL=qr-code-demo.js.map