const { z } = require("zod");

const emailSchema = z.string().email();
const nicknameSchema = z.string().min(2).max(50).regex(/^[a-zA-Z0-9._-]+$/);
const nameSchema = z.string().min(2).max(100);
const passwordSchema = z.string().min(6).max(200);
const groupNameSchema = z.string().min(2).max(120);

const thingTypeSchema = z.enum(["anecdote", "important", "difficult"]);
const emotionalWeightSchema = z.enum(["normal", "important", "difficult"]);

module.exports = {
  z,
  emailSchema,
  nicknameSchema,
  nameSchema,
  passwordSchema,
  groupNameSchema,
  thingTypeSchema,
  emotionalWeightSchema
};

