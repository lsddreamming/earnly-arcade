import {Capacitor} from '@capacitor/core';
import {Share} from '@capacitor/share';

// Older installed apps keep the web/copy-link fallback until their next build.
window.EarnlyRoomShare={
 available:()=>Capacitor.isNativePlatform()&&Capacitor.isPluginAvailable('Share'),
 share:options=>Share.share(options)
};
