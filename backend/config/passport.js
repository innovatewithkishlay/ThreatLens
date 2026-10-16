const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../app/models/User");
const env = require("./env");

if (env.googleEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.google.clientID,
        clientSecret: env.google.clientSecret,
        callbackURL: env.google.callbackURL,
        scope: ["profile", "email"],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const avatar = profile.photos?.[0]?.value;
          const user = await User.findOneAndUpdate(
            { googleId: profile.id },
            {
              $set: { email, name: profile.displayName, avatar, lastLoginAt: new Date() },
              $setOnInsert: { googleId: profile.id },
            },
            { upsert: true, new: true }
          );
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
}

module.exports = passport;
