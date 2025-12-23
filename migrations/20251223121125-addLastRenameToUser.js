"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create the attribute (no default yet)
    await queryInterface.addColumn("Users", "lastRename", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // 2. Set existing users to 32 days ago
    await queryInterface.sequelize.query(`
      UPDATE "Users"
      SET "lastRename" = NOW() - INTERVAL '32 days'
      WHERE "lastRename" IS NULL
    `);

    // 3. Add default value constraint for new users
    await queryInterface.changeColumn("Users", "lastRename", {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal("NOW()"),
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Users", "lastRename");
  },
};
