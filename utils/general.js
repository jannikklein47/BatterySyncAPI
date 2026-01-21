const downsampler = require("downsample-lttb");

/**
 * Generates a random string of a given length
 * @param {number} [length=6] - The length of the string to generate
 * @returns {string} - A randomly generated string of the given length
 */
function generateRandomString(length = 6) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    // Generate a random index based on the number of available characters
    const randomIndex = Math.floor(Math.random() * characters.length);
    // Append the character at that index to the result
    result += characters.charAt(randomIndex);
  }

  return result;
}

/**
 * Downsamples a list of BatteryLog entries to reduce the number of data points.
 * @param {Array<BatteryLog>} data - List of BatteryLog entries.
 * @returns {Array<number[]>} - List of downsampled data points in the format of [x, y] where x is the Unix timestamp and y is the battery level in percent.
 */
function downsample(data) {
  const mapped = data.map((entry) => ({
    x: new Date(entry.createdAt).getTime(),
    y: entry.battery * 100,
    //charging: entry.chargingStatus,
  }));

  const standardized = mapped.map((entry) => [entry.x, entry.y]);

  const reduced = downsampler.processData(
    standardized,
    Math.floor(
      Math.sqrt(standardized.length) + 100 / (standardized.length + 10) + 10
    )
    //20,
  );

  return reduced;
}

/**
 * Formats a given number of seconds into a human-readable duration string.
 * The duration string is in the format of "Xd Yh Zm" where X is the number of days, Y is the number of hours, and Z is the number of minutes.
 * If the number of seconds is 0, the function returns "0h".
 * If the number of days is greater than 0, the function returns a string in the format of "Xd Yh".
 * If the number of hours is greater than 0, the function returns a string in the format of "Yh Zm".
 * Otherwise, the function returns a string in the format of "Zm".
 * @param {number} seconds - The number of seconds to format
 * @returns {string} - A human-readable duration string
 */
function formatDuration(seconds) {
  if (!seconds) return "0h";
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

module.exports = { generateRandomString, downsample };
