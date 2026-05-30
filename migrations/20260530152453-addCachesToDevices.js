"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.addColumn("Devices", "cyclesCached", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn("Devices", "batteryHealthScoreCached", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 100,
    });
    await queryInterface.addColumn("Devices", "percentHealthyChargesCached", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 100,
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.removeColumn("Devices", "cyclesCached");
    await queryInterface.removeColumn("Devices", "batteryHealthScoreCached");
    await queryInterface.removeColumn("Devices", "percentHealthyChargesCached");
  },
};
