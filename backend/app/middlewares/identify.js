const crypto = require("crypto");
const env = require("../../config/env");

const WORKSPACE_COOKIE = "tl_workspace";
const LEGACY_COOKIE = "tl_guest";
const KEY_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: "lax",
  path: "/",
  signed: true,
  maxAge: 5 * 365 * 24 * 3600 * 1000,
});

const setWorkspace = (res, key) => res.cookie(WORKSPACE_COOKIE, key, cookieOptions());

/**
 * ThreatLens has no user accounts. Every browser gets a private workspace,
 * identified by a random key stored in a signed cookie. Sharing the key gives
 * someone else (or another device) access to the same workspace.
 */
const identify = (req, res, next) => {
  let key = req.signedCookies?.[WORKSPACE_COOKIE] || req.signedCookies?.[LEGACY_COOKIE];
  if (!key || !KEY_PATTERN.test(key)) {
    key = crypto.randomUUID();
    setWorkspace(res, key);
  } else if (!req.signedCookies?.[WORKSPACE_COOKIE]) {
    setWorkspace(res, key);
  }
  req.workspace = key;
  // Stored data uses { kind, id } so ownership checks stay explicit.
  req.owner = { kind: "guest", id: key };
  next();
};

module.exports = { identify, setWorkspace, KEY_PATTERN, WORKSPACE_COOKIE };
