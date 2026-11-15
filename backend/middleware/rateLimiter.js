/**
 * Sliding Window In-Memory Rate Limiter Middleware
 * Protects guest session creation and sensitive endpoints from automated flooding and enumeration.
 */

class SlidingWindowRateLimiter {
  constructor(windowMs = 60 * 1000, maxRequests = 30) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.requests = new Map(); // IP -> Array of timestamps

    // Periodically clean up stale records every 2 minutes
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 2 * 60 * 1000);

    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [ip, timestamps] of this.requests.entries()) {
      const valid = timestamps.filter((t) => now - t < this.windowMs);
      if (valid.length === 0) {
        this.requests.delete(ip);
      } else {
        this.requests.set(ip, valid);
      }
    }
  }

  reset() {
    this.requests.clear();
  }

  middleware() {
    return (req, res, next) => {
      // Determine client IP (handles x-forwarded-for if reverse proxied)
      const forwarded = req.headers['x-forwarded-for'];
      const rawIp = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || req.ip || '127.0.0.1';
      const ip = rawIp.replace(/^::ffff:/, ''); // normalize IPv4-mapped IPv6

      const now = Date.now();
      let timestamps = this.requests.get(ip) || [];

      // Filter timestamps within current sliding window
      timestamps = timestamps.filter((t) => now - t < this.windowMs);

      const count = timestamps.length;
      const remaining = Math.max(0, this.maxRequests - count - 1);
      const oldest = timestamps[0] || now;
      const resetTime = Math.ceil((oldest + this.windowMs) / 1000);
      const retryAfterSecs = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));

      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetTime);

      if (count >= this.maxRequests) {
        res.setHeader('Retry-After', retryAfterSecs);
        return res.status(429).json({
          success: false,
          message: `Too many requests from this IP. Please wait ${retryAfterSecs} seconds before trying again.`,
          retryAfter: retryAfterSecs
        });
      }

      timestamps.push(now);
      this.requests.set(ip, timestamps);
      return next();
    };
  }
}

// 30 requests per minute per IP for guest session issuance
const guestSessionLimiter = new SlidingWindowRateLimiter(60 * 1000, 30);

module.exports = {
  SlidingWindowRateLimiter,
  guestSessionLimiter
};
