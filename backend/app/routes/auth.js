const express = require("express");
const jwt = require("jsonwebtoken");
const passport = require("../../config/passport");
const env = require("../../config/env");
const User = require("../models/User");
const { claimGuestCases } = require("../services/caseService");
const { cookieBase, AUTH_COOKIE } = require("../middlewares/identify");

const router = express.Router();

router.get("/config", (req, res) => {
  res.json({ googleEnabled: env.googleEnabled });
});

router.get("/google", (req, res, next) => {
  if (!env.googleEnabled) {
    return res.redirect(`${env.clientUrl}/?auth=unavailable`);
  }
  return passport.authenticate("google", { session: false, prompt: "select_account" })(req, res, next);
});

router.get(
  "/google/callback",
  (req, res, next) => {
    if (!env.googleEnabled) return res.redirect(`${env.clientUrl}/?auth=unavailable`);
    return passport.authenticate("google", {
      session: false,
      failureRedirect: `${env.clientUrl}/?auth=failed`,
    })(req, res, next);
  },
  async (req, res, next) => {
    try {
      const token = jwt.sign(
        { id: String(req.user._id), email: req.user.email, name: req.user.name },
        env.jwtSecret,
        { expiresIn: "7d" }
      );
      res.cookie(AUTH_COOKIE, token, { ...cookieBase(), maxAge: 7 * 24 * 3600 * 1000 });
      // Cases created before signing in move to the user's account.
      if (req.guestId) await claimGuestCases(req.guestId, req.user._id);
      res.redirect(`${env.clientUrl}/?auth=success`);
    } catch (err) {
      next(err);
    }
  }
);

const profile = async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const user = await User.findById(req.user.id, { email: 1, name: 1, avatar: 1 }).lean();
  if (!user) {
    res.clearCookie(AUTH_COOKIE, cookieBase());
    return res.json({ user: null });
  }
  res.json({ user: { id: String(user._id), email: user.email, name: user.name, avatar: user.avatar } });
};

router.get("/me", profile);
router.get("/profile", profile);

const logout = (req, res) => {
  res.clearCookie(AUTH_COOKIE, cookieBase());
  res.json({ message: "Logged out successfully" });
};
router.post("/logout", logout);
router.get("/logout", logout);

module.exports = router;
