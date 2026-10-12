import { Capacitor, registerPlugin } from '@capacitor/core';
if (Capacitor.getPlatform() === 'ios') window.EarnlyApplePurchases = registerPlugin('ArcadePurchases');
