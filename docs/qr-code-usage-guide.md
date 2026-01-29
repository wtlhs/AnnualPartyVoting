# QR Code Generation Usage Guide

## Overview

The enhanced QR code generation system provides flexible options for creating voting URL QR codes optimized for different use cases, especially WeChat scanning.

## Basic Usage

### Simple QR Code Generation

```typescript
import { createQRCodeURLGenerator } from '../utils/qr-code-url-generator';

const generator = createQRCodeURLGenerator('https://your-domain.com');

const candidate = {
  id: 'candidate-001',
  name: '张三',
  category: '最佳员工'
};

// Generate basic QR code
const qrCode = await generator.generateQRCode(
  generator.generateVotingURL(candidate)
);

console.log(qrCode.imageData); // Base64 encoded image
```

### WeChat Optimized QR Code

```typescript
import { QRCodeHelpers } from '../utils/qr-code-url-generator';

// Generate QR code optimized for WeChat scanning
const wechatQR = await QRCodeHelpers.generateForWeChat(generator, candidate);
```

## Advanced Options

### Custom QR Code Options

```typescript
import { QRCodeGenerationOptions } from '../types/qr-code-voting';

const options: QRCodeGenerationOptions = {
  format: 'png',           // 'png', 'jpeg', 'webp', 'svg'
  size: 512,               // Size in pixels
  margin: 3,               // Margin in modules
  errorCorrection: 'H',    // 'L', 'M', 'Q', 'H'
  darkColor: '#000000',    // Foreground color
  lightColor: '#FFFFFF',   // Background color
  quality: 0.95            // Image quality (0-1)
};

const customQR = await generator.generateQRCode(url, options);
```

### Predefined Presets

```typescript
import { QRCodePresets } from '../utils/qr-code-url-generator';

// Available presets
const presets = {
  wechat: QRCodePresets.wechat,    // WeChat optimized
  print: QRCodePresets.print,      // High resolution for printing
  web: QRCodePresets.web,          // Web optimized
  small: QRCodePresets.small,      // Small size for thumbnails
  svg: QRCodePresets.svg           // Vector format
};

const qrCode = await generator.generateQRCode(url, QRCodePresets.wechat);
```

### Multiple Formats

```typescript
// Generate multiple formats at once
const multipleQR = await QRCodeHelpers.generateMultipleFormats(
  generator,
  candidate,
  ['wechat', 'print', 'web']
);

multipleQR.forEach(qr => {
  console.log(`${qr.preset}: ${qr.size}px`);
});
```

### Buffer Generation

```typescript
// Generate QR code as buffer for server-side processing
const qrBuffer = await generator.generateQRCodeBuffer(url, {
  format: 'png',
  size: 256
});

// Save to file or send as response
fs.writeFileSync('qrcode.png', qrBuffer.buffer);
```

## WeChat Optimization

### Best Practices for WeChat Scanning

1. **Error Correction**: Use 'H' (High) level for better reliability
2. **Size**: 256px is optimal for mobile screens
3. **Margin**: 2-4 modules provide good recognition
4. **Colors**: High contrast (black/white) works best
5. **Quality**: 0.9+ for clear scanning

### WeChat-Specific Features

```typescript
// WeChat preset automatically applies these optimizations:
const wechatPreset = {
  format: 'png',
  size: 256,
  margin: 2,
  errorCorrection: 'H',
  darkColor: '#000000',
  lightColor: '#FFFFFF',
  quality: 0.92
};
```

## Validation

### Options Validation

```typescript
import { QRCodeHelpers } from '../utils/qr-code-url-generator';

const options = {
  size: 128,
  margin: 2,
  quality: 0.8
};

const validation = QRCodeHelpers.validateOptions(options);
if (!validation.isValid) {
  console.error('Invalid options:', validation.errors);
}
```

### URL Validation

```typescript
const isValid = generator.validateURL(url);
if (!isValid) {
  throw new Error('Invalid voting URL');
}
```

## Error Handling

```typescript
try {
  const qrCode = await generator.generateQRCode(url, options);
  // Success
} catch (error) {
  if (error.message.includes('Invalid URL')) {
    // Handle invalid URL
  } else if (error.message.includes('QR code generation failed')) {
    // Handle generation failure
  }
}
```

## Integration Examples

### Express.js Route

```typescript
app.get('/api/qrcode/:candidateId', async (req, res) => {
  try {
    const candidate = await getCandidateById(req.params.candidateId);
    const qrBuffer = await generator.generateQRCodeBuffer(
      generator.generateVotingURL(candidate),
      QRCodePresets.wechat
    );
    
    res.set({
      'Content-Type': qrBuffer.mimeType,
      'Content-Length': qrBuffer.buffer.length
    });
    res.send(qrBuffer.buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### React Component

```typescript
const QRCodeDisplay = ({ candidate }) => {
  const [qrCode, setQRCode] = useState(null);
  
  useEffect(() => {
    const generateQR = async () => {
      const generator = createQRCodeURLGenerator();
      const qr = await QRCodeHelpers.generateForWeChat(generator, candidate);
      setQRCode(qr);
    };
    
    generateQR();
  }, [candidate]);
  
  return qrCode ? (
    <img src={qrCode.imageData} alt="Voting QR Code" />
  ) : (
    <div>Loading...</div>
  );
};
```

## Performance Considerations

1. **Caching**: Cache generated QR codes to avoid regeneration
2. **Async**: Always use async/await for QR code generation
3. **Size**: Larger QR codes take more time to generate
4. **Format**: PNG is fastest, SVG takes longer but is scalable

## Troubleshooting

### Common Issues

1. **QR Code not scanning**: Check error correction level and size
2. **Poor quality**: Increase size and quality settings
3. **WeChat not recognizing**: Use WeChat preset or high error correction
4. **Generation fails**: Validate URL and options before generation

### Debug Tips

```typescript
// Enable debug logging
console.log('URL:', generator.generateVotingURL(candidate));
console.log('Options:', options);
console.log('Validation:', QRCodeHelpers.validateOptions(options));
```