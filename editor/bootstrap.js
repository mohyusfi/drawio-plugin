// The host has an opaque origin and denies storage/network APIs.
window.urlParams = {offline:'1',local:'1',embed:'0',gapi:'0',gh:'0',gl:'0',od:'0',tr:'0',browser:'0',math:'0',plugins:'0',lang:'en',ui:'kennedy',stealth:'1',noExitBtn:'1',noSaveBtn:'1'};
window.mxLoadResources = false;
window.mxLoadStylesheets = false;
window.mxLanguage = 'en';
window.mxLanguages = ['en'];
window.mxIsElectron = false;
window.isLocalStorage = false;
window.EXPORT_URL = null;
window.DRAWIO_CONFIG = { enableAi: false, enableCustomLibraries: false };
window.mxscript = function(url, onload) { console.warn('Unavailable offline module:',url); };
// Upstream settings probe localStorage at module initialisation.
for (const name of ['localStorage','sessionStorage']) {
  try { Object.defineProperty(window,name,{value:{getItem(){return null},setItem(){},removeItem(){},clear(){}},configurable:true}); } catch {}
}
