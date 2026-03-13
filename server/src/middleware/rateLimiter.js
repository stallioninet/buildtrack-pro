import rateLimit from 'express-rate-limit';

const isTest = process.env.NODE_ENV === 'test';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 1000 : 5,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isTest ? 1000 : 3,
  message: { error: 'Too many registration attempts. Please try again after 1 hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 1000 : 20,
  message: { error: 'Too many uploads. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 10000 : 100,
  message: { error: 'Too many requests. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
