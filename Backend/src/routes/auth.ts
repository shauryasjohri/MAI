import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";
import { credentialsSchema } from "../schemas/auth.js";
import { parse } from "../lib/parse.js";
import { signToken } from "../lib/tokens.js";
import { requireAuth } from "../middleware/auth.js";
import { AppError } from "../lib/errors.js";
import {
  cookieOptions,
  cookieSameSite,
  cookieSecure,
  env,
  isGoogleOAuthConfigured,
  oauthSuccessRedirect
} from "../config/env.js";

const OAUTH_STATE_COOKIE = "mai_oauth_state";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "test"
});

router.use(authLimiter);

router.post("/register", async (req, res) => {
  const { email, password } = parse(credentialsSchema, req.body);

  const existing = await User.findOne({ email });

  if (existing) {
    throw new AppError(409, "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ email, passwordHash });
  const token = signToken({ id: user.id, email: user.email });

  res.cookie(env.COOKIE_NAME, token, cookieOptions);
  res.status(201).json({ user: { id: user.id, email: user.email } });
});

router.post("/login", async (req, res) => {
  const { email, password } = parse(credentialsSchema, req.body);

  const user = await User.findOne({ email });
  const valid = user?.passwordHash
    ? await bcrypt.compare(password, user.passwordHash)
    : false;

  if (!user || !valid) {
    if (user && !user.passwordHash) {
      throw new AppError(401, "This account uses Google sign-in. Continue with Google instead.");
    }
    throw new AppError(401, "Invalid email or password");
  }

  const token = signToken({ id: user.id, email: user.email });

  res.cookie(env.COOKIE_NAME, token, cookieOptions);
  res.json({ user: { id: user.id, email: user.email } });
});

router.post("/logout", (_req, res) => {
  res.clearCookie(env.COOKIE_NAME, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    path: "/"
  });
  res.json({ success: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.user!.id).select("email");

  if (!user) {
    throw new AppError(401, "Invalid or expired session");
  }

  res.json({ user: { id: user.id, email: user.email } });
});

router.get("/providers", (_req, res) => {
  res.json({ google: isGoogleOAuthConfigured });
});

const oauthStateCookieOptions = {
  httpOnly: true,
  secure: cookieSecure,
  sameSite: cookieSameSite,
  path: "/api/auth",
  maxAge: 10 * 60 * 1000
};

router.get("/google", (_req, res) => {
  if (!isGoogleOAuthConfigured) {
    throw new AppError(503, "Google sign-in is not configured");
  }

  const state = crypto.randomBytes(24).toString("hex");
  res.cookie(OAUTH_STATE_COOKIE, state, oauthStateCookieOptions);

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account"
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get("/google/callback", async (req, res) => {
  const fail = (message: string) =>
    res.redirect(`${oauthSuccessRedirect}/?oauth_error=${encodeURIComponent(message)}`);

  try {
    if (!isGoogleOAuthConfigured) {
      return fail("Google sign-in is not configured");
    }

    const { code, state } = req.query;
    const cookieState = req.cookies?.[OAUTH_STATE_COOKIE];
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/api/auth" });

    if (
      typeof code !== "string" ||
      typeof state !== "string" ||
      !cookieState ||
      state !== cookieState
    ) {
      return fail("Invalid or expired Google sign-in request");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code"
      })
    });

    if (!tokenResponse.ok) {
      return fail("Google token exchange failed");
    }

    const tokenData = (await tokenResponse.json()) as { access_token?: string };

    if (!tokenData.access_token) {
      return fail("Google did not return an access token");
    }

    const profileResponse = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );

    if (!profileResponse.ok) {
      return fail("Could not load your Google profile");
    }

    const profile = (await profileResponse.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
    };

    if (!profile.sub || !profile.email || profile.email_verified === false) {
      return fail("Your Google account does not have a verified email");
    }

    const email = profile.email.toLowerCase();
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        email,
        googleId: profile.sub,
        displayName: profile.name
      });
    } else if (!user.googleId) {
      user.googleId = profile.sub;
      if (profile.name && !user.displayName) {
        user.displayName = profile.name;
      }
      await user.save();
    }

    const token = signToken({ id: user.id, email: user.email });
    res.cookie(env.COOKIE_NAME, token, cookieOptions);

    return res.redirect(oauthSuccessRedirect);
  } catch (err) {
    console.error("Google OAuth error", err);
    return fail("Google sign-in failed");
  }
});

export default router;
