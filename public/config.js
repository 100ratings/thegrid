// Optional shared relay URL, for example https://thegrid-sync.ACCOUNT.workers.dev
// The controller can also configure it in Settings without editing this file
export const RELAY_URL = location.hostname.endsWith('.workers.dev') ? location.origin : ''; 
