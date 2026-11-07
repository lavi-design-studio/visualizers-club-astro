// The sign-up's sheet (tools/signup-apps-script.gs, its Apps Script web app) and its places: asked by the
// sign-up page (dang-ky.astro) and by the landing page, whose links to it say when the places are gone
export const SIGNUP_URL = 'https://script.google.com/macros/s/AKfycbx3DCU2X8QmRxVt0Q6uzFBMPDvXh92wKVFffXJy3wS_8Oz-t7Rg8_yWqaAKFFgn1O9NIA/exec';
export const CAP = 9;
// the sign-up closed whatever the sheet says: the sign-up page fully booked from the start (those who
// signed up on it still see how their own place stands), the landing page's links to it "hết chỗ".
// false to open it again, as the sheet's places say
export const CLOSED = true;
