const crypto = require("crypto");
const axios = require("axios");
const jwt = require("jsonwebtoken");

const APPLE_ISSUER = "https://appleid.apple.com";
const KEYS_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10000;

const getBundleId = () => process.env.APPLE_BUNDLE_ID || "com.faydhaaneyusufi";

let cachedKeys = null;
let cachedAt = 0;

const fetchAppleKeys = async (forceRefresh = false) => {
    if (!forceRefresh && cachedKeys && Date.now() - cachedAt < KEYS_TTL_MS) {
        return cachedKeys;
    }
    const { data } = await axios.get(`${APPLE_ISSUER}/auth/keys`, {
        timeout: REQUEST_TIMEOUT_MS,
    });
    cachedKeys = data.keys;
    cachedAt = Date.now();
    return cachedKeys;
};

const getSigningKey = async (kid) => {
    let jwk = (await fetchAppleKeys()).find((key) => key.kid === kid);
    // Apple rotates its keys, so refetch once before giving up
    if (!jwk) {
        jwk = (await fetchAppleKeys(true)).find((key) => key.kid === kid);
    }
    if (!jwk) {
        throw new Error("Apple signing key not found");
    }
    return crypto.createPublicKey({ key: jwk, format: "jwk" });
};

/**
 * Verify the identity token returned by Sign in with Apple on the device.
 * rawNonce is the un-hashed nonce the app used; the token carries its SHA-256.
 */
const verifyIdentityToken = async (identityToken, rawNonce) => {
    const decoded = jwt.decode(identityToken, { complete: true });
    if (!decoded || !decoded.header || !decoded.header.kid) {
        throw new Error("Invalid Apple identity token");
    }

    const publicKey = await getSigningKey(decoded.header.kid);
    const payload = jwt.verify(identityToken, publicKey, {
        algorithms: ["RS256"],
        issuer: APPLE_ISSUER,
        audience: getBundleId(),
    });

    if (rawNonce && payload.nonce) {
        const hashedNonce = crypto
            .createHash("sha256")
            .update(rawNonce)
            .digest("hex");
        if (hashedNonce !== payload.nonce) {
            throw new Error("Apple identity token nonce mismatch");
        }
    }

    return {
        sub: payload.sub,
        email: payload.email || null,
        emailVerified:
            payload.email_verified === true || payload.email_verified === "true",
    };
};

// Client secret for Apple's REST API. Returns null until the key is configured.
const getClientSecret = () => {
    const { APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY } = process.env;
    if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY) {
        return null;
    }
    return jwt.sign({}, APPLE_PRIVATE_KEY.replace(/\\n/g, "\n"), {
        algorithm: "ES256",
        keyid: APPLE_KEY_ID,
        issuer: APPLE_TEAM_ID,
        audience: APPLE_ISSUER,
        subject: getBundleId(),
        expiresIn: "5m",
    });
};

const postForm = (endpoint, params) =>
    axios.post(
        `${APPLE_ISSUER}${endpoint}`,
        new URLSearchParams(params).toString(),
        {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            timeout: REQUEST_TIMEOUT_MS,
        }
    );

/**
 * Exchange the one-time authorization code for a refresh token, which is what
 * lets us revoke access when the account is deleted. Returns null on failure.
 */
const exchangeAuthorizationCode = async (authorizationCode) => {
    try {
        const clientSecret = getClientSecret();
        if (!clientSecret || !authorizationCode) {
            return null;
        }
        const { data } = await postForm("/auth/token", {
            client_id: getBundleId(),
            client_secret: clientSecret,
            code: authorizationCode,
            grant_type: "authorization_code",
        });
        return data.refresh_token || null;
    } catch (err) {
        console.error(
            "Apple token exchange failed:",
            err.response?.data || err.message
        );
        return null;
    }
};

// Revoke Sign in with Apple access for a deleted account. Never throws.
const revokeToken = async (refreshToken) => {
    try {
        const clientSecret = getClientSecret();
        if (!clientSecret || !refreshToken) {
            return false;
        }
        await postForm("/auth/revoke", {
            client_id: getBundleId(),
            client_secret: clientSecret,
            token: refreshToken,
            token_type_hint: "refresh_token",
        });
        return true;
    } catch (err) {
        console.error(
            "Apple token revoke failed:",
            err.response?.data || err.message
        );
        return false;
    }
};

module.exports = {
    verifyIdentityToken,
    exchangeAuthorizationCode,
    revokeToken,
};
