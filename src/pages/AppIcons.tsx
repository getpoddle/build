import { Download } from 'lucide-react';

export default function AppIcons() {
  const iconSizes = {
    ios: [
      { size: 1024, name: 'App Store', required: true },
      { size: 180, name: 'iPhone @3x', required: true },
      { size: 167, name: 'iPad Pro @2x', required: true },
      { size: 152, name: 'iPad @2x', required: true },
      { size: 120, name: 'iPhone @2x', required: true },
      { size: 87, name: 'Settings @3x', required: false },
      { size: 80, name: 'Spotlight @2x', required: false },
      { size: 76, name: 'iPad @1x', required: false },
      { size: 60, name: 'Settings @1x', required: false },
      { size: 58, name: 'Settings @2x', required: false },
      { size: 40, name: 'Spotlight @1x', required: false },
      { size: 29, name: 'Settings @1x', required: false },
    ],
    android: [
      { size: 512, name: 'Play Store', required: true },
      { size: 192, name: 'xxxhdpi', required: true },
      { size: 144, name: 'xxhdpi', required: true },
      { size: 96, name: 'xhdpi', required: true },
      { size: 72, name: 'hdpi', required: true },
      { size: 48, name: 'mdpi', required: true },
    ],
  };

  const downloadIcon = (size: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    ctx.clearRect(0, 0, size, size);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const aspect = img.width / img.height;
      let w = size, h = size;
      if (aspect > 1) h = size / aspect;
      else w = size * aspect;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `poddle-icon-${size}x${size}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    };
    img.src = '/images/logos/poddle-mark.png';

    // Download
  };

  const downloadAllIOS = () => {
    iconSizes.ios.forEach((icon, index) => {
      setTimeout(() => downloadIcon(icon.size), index * 300);
    });
  };

  const downloadAllAndroid = () => {
    iconSizes.android.forEach((icon, index) => {
      setTimeout(() => downloadIcon(icon.size), index * 300);
    });
  };

  const downloadSVG = () => {
    const svgContent = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <image href="/images/logos/poddle-mark.png" x="256" y="340" width="512" height="344" />
</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'poddle-app-icon.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">App Icon Downloads</h1>
          <p className="text-slate-600 mb-6">
            Download all the required icon sizes for iOS App Store and Google Play Store submissions.
          </p>

          {/* Preview */}
          <div className="mb-8 flex items-center gap-6 p-6 bg-slate-50 rounded-lg">
            <div className="flex-shrink-0">
              <img src="/app-icon.svg" alt="App Icon Preview" className="w-32 h-32 rounded-2xl shadow-lg" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Poddle App Icon</h2>
              <p className="text-slate-600 mb-4">
                Optimized design for app stores with clear visibility at all sizes.
              </p>
              <button
                onClick={downloadSVG}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download SVG Source
              </button>
            </div>
          </div>
        </div>

        {/* iOS Icons */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">iOS App Store Icons</h2>
              <p className="text-slate-600">Required sizes for Apple App Store submission</p>
            </div>
            <button
              onClick={downloadAllIOS}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Download className="w-5 h-5" />
              Download All iOS
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {iconSizes.ios.map((icon) => (
              <button
                key={`ios-${icon.size}`}
                onClick={() => downloadIcon(icon.size)}
                className="flex flex-col items-center gap-3 p-4 border-2 border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <img src="/app-icon.svg" alt="" className="w-12 h-12 rounded-lg" />
                </div>
                <div className="text-center">
                  <div className="font-semibold text-slate-900">{icon.size}×{icon.size}</div>
                  <div className="text-xs text-slate-600">{icon.name}</div>
                  {icon.required && (
                    <div className="text-xs text-blue-600 font-medium mt-1">Required</div>
                  )}
                </div>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
              </button>
            ))}
          </div>
        </div>

        {/* Android Icons */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Android Play Store Icons</h2>
              <p className="text-slate-600">Required sizes for Google Play Store submission</p>
            </div>
            <button
              onClick={downloadAllAndroid}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              <Download className="w-5 h-5" />
              Download All Android
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {iconSizes.android.map((icon) => (
              <button
                key={`android-${icon.size}`}
                onClick={() => downloadIcon(icon.size)}
                className="flex flex-col items-center gap-3 p-4 border-2 border-slate-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all group"
              >
                <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-green-100 transition-colors">
                  <img src="/app-icon.svg" alt="" className="w-12 h-12 rounded-lg" />
                </div>
                <div className="text-center">
                  <div className="font-semibold text-slate-900">{icon.size}×{icon.size}</div>
                  <div className="text-xs text-slate-600">{icon.name}</div>
                  {icon.required && (
                    <div className="text-xs text-green-600 font-medium mt-1">Required</div>
                  )}
                </div>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-green-600" />
              </button>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">Submission Instructions</h3>
          <div className="space-y-3 text-sm text-slate-700">
            <div>
              <strong className="text-slate-900">iOS App Store:</strong> Upload the 1024×1024 icon when submitting to App Store Connect. Add all other sizes to your Xcode project.
            </div>
            <div>
              <strong className="text-slate-900">Google Play Store:</strong> Upload the 512×512 icon in the Play Console. Include all other sizes in your Android project resources.
            </div>
            <div>
              <strong className="text-slate-900">Design Guidelines:</strong> iOS automatically adds rounded corners. Android icons should follow Material Design guidelines with adaptive icon layers.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
