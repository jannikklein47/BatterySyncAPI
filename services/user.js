const models = require("../models");
const downsampler = require("downsample-lttb");
const { Op, fn, col, QueryTypes, where } = require("sequelize");

const APIError = require("../utils/error");

const User = models.User;
const Device = models.Device;
const OrderedNotifications = models.OrderedNotifications;
const BatteryLogs = models.batteryLogs;
const sequelize = models.sequelize;

const NotificationService = require("./notification");
const BatteryLogService = require("./batteryLogs");

const GeneralUtils = require("../utils/general");

const bcrypt = require("bcryptjs");

/**
 * Gets a user by their ID.
 * @param {number} userId - The ID of the user.
 * @throws {APIError} If the user could not be found.
 * @returns {Promise<User>} The user object, or null if the user could not be found.
 */
async function getUser(userId) {
  const user = await User.findByPk(userId);
  if (!user) throw APIError.errorUserNotFound();
  return user;
}

/**
 * Gets users by their ids
 * @param {Array<number>} ids - The IDs of the users to find
 * @returns {Promise<Array<User>>} Array of all found Users
 */
async function getUsersByIds(ids = []) {
  const users = await User.findAll({
    where: {
      id: {
        [Op.in]: ids,
      },
    },
  });
  return users;
}

/**
 * Gets a user by their email.
 * @param {string} email - The email address of the user.
 * @throws {APIError} If the user could not be found.
 * @returns {Promise<User>} The user object, or null if the user could not be found.
 */
async function getUserByEmail(email) {
  const user = await User.findOne({
    where: {
      email,
    },
  });
  if (!user) throw APIError.errorUserNotFound();
  return user;
}

/**
 * Retrieves all users from the database.
 * @return {Promise<Array<User>>} - A promise that resolves with an array of all users.
 */
async function getAllUsers() {
  const users = await User.findAll();
  return users;
}

/**
 * Retrieves the admin user from the database.
 * @returns {Promise<User>} The admin user object, or null if the admin user could not be found.
 */
async function getAdmin() {
  const user = await User.findOne({ where: { admin: true } });
  return user;
}

/**
 * Creates a new user in the database.
 * @param {string} email - The email address of the user.
 * @param {string} password - The plaintext password of the user.
 * @param {boolean} [admin=false] - Whether the user is an admin or not.
 * @param {boolean} [tester=false] - Whether the user is a tester or not.
 * @throws {APIError} If the user already exists.
 * @returns {Promise<User>} The user object, or null if the user could not be created.
 */
async function createUser(email, password, admin = false, tester = false) {
  const hash = await bcrypt.hash(password, 11);

  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    throw APIError.errorUserAlreadyExists();
  }

  const user = await User.create({
    email,
    password: hash,
    admin,
    tester,
    lastRename: new Date(),
  });
  return user;
}

/**
 * Resets the password of a user.
 * @param {string} email - The email address of the user.
 * @param {string} password - The plaintext password of the user.
 * @throws {APIError} If the user does not exist.
 * @returns {Promise<void>} A promise that resolves when the password has been reset.
 */
async function resetPassword(email, password) {
  const hash = await bcrypt.hash(password, 11);
  await updateUser(email, { password: hash });
}

/**
 * Validates the login credentials of a user.
 * @param {string} email - The email address of the user.
 * @param {string} password - The plaintext password of the user.
 * @return {Promise<boolean>} A promise that resolves with true if the credentials are valid, and false otherwise.
 */
async function validateLogin(email, password) {
  const user = await getUserByEmail(email);
  try {
    const valid = await bcrypt.compare(password, user.password);
    return valid === true;
  } catch (error) {
    return false;
  }
}

/**
 * Updates a user with the given email address.
 * @param {string} email - The email address of the user to update.
 * @param {Object} data - The data to update the user with.
 * @throws {APIError} If the user does not exist.
 * @returns {Promise<Array<number>>} A promise that resolves with the updated user count.
 */
async function updateUser(email, data) {
  const updated = await User.update(data, { where: { email } });
  if (updated[0] === 0) throw APIError.errorUserNotFound();
  return updated;
}

/**
 * Retrieves an array of user IDs with devices that have a build number matching the given build number and operator.
 * @param {number} buildNumer - The build number to search for.
 * @param {string} operator - The operator to use when searching for the build number. Can be one of: =, <, >, <=, >=.
 * @return {Promise<Array<User>>} A promise that resolves with an array of users.
 */
async function getUsersByBuild(buildNumer, operator) {
  const devicesWithBuild = await Device.findAll({
    where: {
      build: {
        [operator]: buildNumer,
      },
    },
  });

  const ids = devicesWithBuild.map((device) => device.userId);

  const users = await User.findAll({
    where: {
      id: {
        [Op.in]: ids,
      },
    },
  });

  return users;
}

module.exports = {
  getUser,
  getUsersByIds,
  getAllUsers,
  createUser,
  getUserByEmail,
  validateLogin,
  updateUser,
  resetPassword,
  getAdmin,
  getUsersByBuild,
};
