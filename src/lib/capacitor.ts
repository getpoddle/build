import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();
export const isIOS = platform === 'ios';
export const isAndroid = platform === 'android';
export const isWeb = platform === 'web';

export async function initCapacitor() {
  if (!isNative) return;

  try {
    await StatusBar.setStyle({ style: Style.Light });
    if (isAndroid) {
      await StatusBar.setBackgroundColor({ color: '#2563eb' });
    }
  } catch {}

  try {
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch {}

  if (isAndroid) {
    try {
      Keyboard.addListener('keyboardWillShow', () => {
        document.body.classList.add('keyboard-open');
      });
      Keyboard.addListener('keyboardWillHide', () => {
        document.body.classList.remove('keyboard-open');
      });
    } catch {}
  }
}

export async function setupBackButton(onBack: () => boolean) {
  if (!isNative) return;
  try {
    App.addListener('backButton', ({ canGoBack }) => {
      const handled = onBack();
      if (!handled) {
        if (canGoBack) {
          window.history.back();
        } else {
          App.exitApp();
        }
      }
    });
  } catch {}
}

export async function triggerHaptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (!isNative) return;
  const styleMap = {
    light: ImpactStyle.Light,
    medium: ImpactStyle.Medium,
    heavy: ImpactStyle.Heavy,
  };
  try {
    await Haptics.impact({ style: styleMap[style] });
  } catch {}
}

export function getSafeAreaInsets() {
  if (!isIOS) return { top: 0, bottom: 0, left: 0, right: 0 };
  const style = getComputedStyle(document.documentElement);
  return {
    top: parseInt(style.getPropertyValue('--sat') || '0'),
    bottom: parseInt(style.getPropertyValue('--sab') || '0'),
    left: parseInt(style.getPropertyValue('--sal') || '0'),
    right: parseInt(style.getPropertyValue('--sar') || '0'),
  };
}
