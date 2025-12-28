function getEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return value;
}

module.exports = { getEnv };

