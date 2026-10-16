const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const env = require("../../config/env");

const GUEST_COOKIE = "tl_guest";
const AUTH_COOKIE = "jwt";

const cookieBase = () => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: "lax",
  path: "/",
});

/**
 * Attach `req.user` (signed-in) and `req.owner` (who owns new/visible cases).
 * Visitors who are not signed in get a signed, random guest id so their
 * cases stay private to their browser.
 */
const identify = (req, res, next) => {
  const token = req.cookies?.[AUTH_COOKIE];
  if (token) {
    try {
      const payload = jwt.verify(token, env.jwtSecret);
      req.user = { id: payload.id, email: payload.email, name: payload.name };
    } catch {
      res.clearCookie(AUTH_COOKIE, cookieBase());
    }
  }

  let guestId = req.signedCookies?.[GUEST_COOKIE];
  if (!guestId || !/^[a-f0-9-]{36}$/.test(guestId)) {
    guestId = crypto.randomUUID();
    res.cookie(GUEST_COOKIE, guestId, {
      ...cookieBase(),
      signed: true,
      maxAge: 365 * 24 * 3600 * 1000,
    });
  }
  req.guestId = guestId;
  req.owner = req.user ? { kind: "user", id: String(req.user.id) } : { kind: "guest", id: guestId };
  next();
};

module.exports = { identify, cookieBase, GUEST_COOKIE, AUTH_COOKIE };
